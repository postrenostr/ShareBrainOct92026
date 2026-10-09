import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, AudioLines, Check, CircleAlert, Loader2, RefreshCw, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HdUpgradeStatus as UpgradeStatus } from "@shared/tenWordsHdUpgrade";

const START_CONFIRMATION = "UPGRADE SAVED AUDIO";
const RETRY_CONFIRMATION = "RETRY UNSUCCESSFUL AUDIO";

async function readStatus(response: Response): Promise<UpgradeStatus> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || "The HD audio status could not be loaded.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as UpgradeStatus;
}

export default function TenWordsHdUpgrade() {
  const [status, setStatus] = useState<UpgradeStatus | null>(null);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"error" | "info" | "success">("info");
  const [startPhrase, setStartPhrase] = useState("");
  const [retryPhrase, setRetryPhrase] = useState("");
  const mounted = useRef(false);
  const stopRequested = useRef(false);
  const operationActive = useRef(false);

  const showNotice = useCallback((message: string, kind: "error" | "info" | "success" = "info") => {
    if (!mounted.current) return;
    setNotice(message);
    setNoticeKind(kind);
  }, []);

  const refresh = useCallback(async (quiet = false): Promise<UpgradeStatus | null> => {
    if (!quiet && mounted.current) {
      setLoading(true);
      setNotice("");
    }
    try {
      const response = await fetch("/api/10words/hd-upgrade", {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const next = await readStatus(response);
      if (mounted.current) {
        setStatus(next);
        setVisible(true);
      }
      return next;
    } catch (error) {
      const code = (error as Error & { status?: number }).status;
      if (code === 401 || code === 403) {
        if (mounted.current) setVisible(false);
        return null;
      }
      if (mounted.current && !quiet) {
        setNotice(error instanceof Error ? error.message : "Could not load HD audio status. Check your connection and refresh.");
        setNoticeKind("error");
      }
      return null;
    } finally {
      if (mounted.current && !quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      stopRequested.current = true;
    };
  }, [refresh]);

  async function post(path: "start" | "step" | "retry", body: object): Promise<UpgradeStatus> {
    const response = await fetch(`/api/10words/hd-upgrade/${path}`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify(body),
    });
    return readStatus(response);
  }

  function explainMutationError(error: unknown): string {
    const code = (error as Error & { status?: number }).status;
    if (code === 409) return `${error instanceof Error ? error.message : "Another HD audio operation is active."} No further request was started. Refresh status before taking another action.`;
    if (code === 503) return "The operation is unavailable. Refresh status and check database access; if the progress tables are missing in production, publish the schema before trying again.";
    return error instanceof Error ? error.message : "The request failed. Check status before taking another action.";
  }

  async function recoverAfterFailure(error: unknown) {
    const code = (error as Error & { status?: number }).status;
    if (code === 401 || code === 403) {
      if (mounted.current) setVisible(false);
      return;
    }
    showNotice(explainMutationError(error), "error");
    // A lost response may still have completed on the server. Read status, never replay the mutation.
    const latest = await refresh(true);
    if (latest && code !== 409 && mounted.current) {
      showNotice(`${explainMutationError(error)} Status was refreshed. Review it before choosing another action.`, "error");
    }
  }

  async function begin(kind: "start" | "continue" | "retry") {
    if (operationActive.current || !mounted.current) return;
    operationActive.current = true;
    stopRequested.current = false;
    setWorking(true);
    setStopping(false);
    setNotice("");
    try {
      if (kind === "start") {
        const next = await post("start", { confirmation: START_CONFIRMATION });
        if (!mounted.current) return;
        setStatus(next);
      } else if (kind === "retry") {
        const next = await post("retry", { confirmation: RETRY_CONFIRMATION });
        if (!mounted.current) return;
        setStatus(next);
      }

      while (mounted.current && !stopRequested.current) {
        const next = await post("step", {});
        if (!mounted.current) return;
        setStatus(next);
        if (stopRequested.current) break;
        if (next.counts.pending <= 0) {
          const latest = await refresh(true);
          if (latest && mounted.current) {
            setStatus(latest);
            showNotice(
              latest.counts.failed || latest.counts.conflict
                ? "This pass has stopped with unsuccessful lessons listed below. Review them before retrying."
                : latest.counts.running > 0
                  ? "A lesson is still marked running. Refresh status before continuing; retry will only requeue work the server considers interrupted."
                  : "HD audio maintenance is complete. Refresh lesson audio when you return to a lesson.",
              latest.counts.failed || latest.counts.conflict ? "error" : latest.counts.running > 0 ? "info" : "success",
            );
          }
          break;
        }
      }
      if (stopRequested.current && mounted.current) showNotice("Stopped after the current server request finishes. No further lesson will be started.", "info");
    } catch (error) {
      if (mounted.current) await recoverAfterFailure(error);
    } finally {
      operationActive.current = false;
      if (mounted.current) {
        setWorking(false);
        setStopping(false);
      }
    }
  }

  function requestStop() {
    stopRequested.current = true;
    setStopping(true);
    showNotice("Stop requested. The server will finish the current lesson request; no next lesson will be started.", "info");
  }

  if (!visible) return null;
  const hasJob = Boolean(status?.job);
  const counts = status?.counts;
  const hasUnsuccessful = Boolean(counts && (counts.failed + counts.conflict > 0));
  const hasRetryable = Boolean(counts && (counts.failed + counts.conflict + counts.running > 0));
  const canContinue = Boolean(hasJob && counts && counts.pending > 0 && counts.running === 0);
  const successful = Boolean(hasJob && counts && counts.total > 0 && counts.complete === counts.total && counts.pending === 0 && counts.running === 0);

  return (
    <section aria-labelledby="hd-upgrade-heading" className="mb-7 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AudioLines className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="hd-upgrade-heading" className="text-lg font-semibold tracking-tight">HD audio maintenance</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Administrator
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Replace saved lesson audio with the HD voice, one lesson at a time.</p>
          <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            Paid text-to-speech requests may incur charges. Keep this page open. If interrupted, a provider request may still complete and its charge can be uncertain.
          </p>
        </div>
        {status && <div className="shrink-0 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Environment <span className="ml-1 font-semibold text-foreground">{status.environment}</span>
        </div>}
      </div>

      {loading && !status ? (
        <div className="mt-4 space-y-2" role="status" aria-label="Loading HD audio status">
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      ) : !status ? (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm">HD audio status is unavailable.</p>
          {notice && <p role="alert" className="mt-1 text-sm text-destructive">{notice}</p>}
          <Button className="mt-3" variant="outline" size="sm" onClick={() => void refresh()}> <RefreshCw className="h-4 w-4" /> Refresh status</Button>
        </div>
      ) : <>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6" aria-label="HD audio lesson counts">
          {([
            ["Total", counts!.total],
            ["Pending", counts!.pending],
            ["Running", counts!.running],
            ["Complete", counts!.complete],
            ["Failed", counts!.failed],
            ["Conflict", counts!.conflict],
          ] as [string, number][]).map(([label, value]) => (
            <div key={label} className="rounded-md border border-border/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 font-mono text-lg tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {!hasJob && (
          <div className="mt-4 rounded-md border border-border bg-muted/35 p-3 sm:p-4">
            <p className="text-sm font-medium">{status.existingLessons} saved lessons are available. Starting captures a fixed snapshot; it does not change lesson text.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Review the environment above before starting. Each generated audio file is a paid TTS request; this will process the snapshot sequentially and will not run automatically.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-xs font-medium" htmlFor="hd-start-confirmation">
                Type <code className="rounded bg-muted px-1 py-0.5">{START_CONFIRMATION}</code> to authorize
                <Input id="hd-start-confirmation" className="mt-1" value={startPhrase} onChange={event => setStartPhrase(event.target.value)} autoComplete="off" />
              </label>
              <Button disabled={working || startPhrase !== START_CONFIRMATION} onClick={() => void begin("start")}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Start upgrade
              </Button>
            </div>
          </div>
        )}

        {hasJob && (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              <p>Snapshot started {new Date(status.job!.createdAt).toLocaleString()}.</p>
              {counts!.running > 0 && <p className="mt-1 text-amber-800">A lesson is marked running. A refresh cannot cancel a request already processing; retry will only requeue it if the server considers it interrupted.</p>}
              {successful && <p className="mt-1 flex items-center gap-1 text-foreground"><Check className="h-3.5 w-3.5" /> All saved lesson audio is complete. Refresh lesson audio when you next open a lesson.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={loading || working} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /> Refresh status</Button>
              {working ? (
                <Button size="sm" variant="outline" onClick={requestStop}><Square className="h-3.5 w-3.5" /> {stopping ? "Stopping after current" : "Stop after current"}</Button>
              ) : canContinue ? (
                <Button size="sm" disabled={loading} onClick={() => void begin("continue")}>Continue pending lessons</Button>
              ) : null}
              {hasRetryable && !working && (
                <div className="w-full rounded-md border border-amber-700/30 bg-amber-700/5 p-3 sm:w-auto sm:max-w-md">
                  <p className="text-xs leading-relaxed">Retry only requeues failed, conflicted, or interrupted lessons. A running item is requeued only if the server considers it interrupted. Completed audio is never regenerated.</p>
                  <label className="mt-2 block text-xs font-medium" htmlFor="hd-retry-confirmation">
                    Type <code className="rounded bg-muted px-1 py-0.5">{RETRY_CONFIRMATION}</code> to authorize
                    <Input id="hd-retry-confirmation" className="mt-1" value={retryPhrase} onChange={event => setRetryPhrase(event.target.value)} autoComplete="off" />
                  </label>
                  <Button className="mt-2" size="sm" variant="outline" disabled={loading || retryPhrase !== RETRY_CONFIRMATION} onClick={() => void begin("retry")}>Retry unsuccessful audio</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {notice && (
          <div role={noticeKind === "error" ? "alert" : "status"} aria-live="polite" className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${noticeKind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>
            {noticeKind === "error" ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">{noticeKind === "success" ? <Check className="h-4 w-4" /> : null}</span>}
            <span>{notice}</span>
            {notice.includes("refresh") && <Button className="ml-auto h-7 shrink-0" size="sm" variant="outline" disabled={loading || working} onClick={() => void refresh()}>Refresh</Button>}
          </div>
        )}

        {hasJob && (hasUnsuccessful || counts!.running > 0) && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Needs attention</h3>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {status.items.filter(item => item.status === "failed" || item.status === "conflict" || item.status === "running").map(item => (
                <li key={`${item.language}-${item.lessonNumber}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded px-2 py-2 text-xs hover:bg-muted/60">
                  <span className="font-medium">{item.language} · Lesson {item.lessonNumber}</span>
                  <span className={`font-semibold uppercase tracking-wide ${item.status === "failed" ? "text-destructive" : item.status === "conflict" ? "text-amber-800" : "text-muted-foreground"}`}>{item.status}</span>
                  {item.message && <span className="col-span-2 mt-1 break-words text-muted-foreground">{item.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>}
    </section>
  );
}
