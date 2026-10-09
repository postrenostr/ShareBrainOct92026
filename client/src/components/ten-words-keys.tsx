import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Client = { id: string; name: string; keyPrefix: string; scopes: string[]; rateLimit: number; usageCount: number; lastUsedAt: string | null; revokedAt: string | null };
const permissions = ["languages:read", "lessons:read", "audio:read"];
export default function TenWordsKeys() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(permissions);
  const [limit, setLimit] = useState("120");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function call(path = "", body?: unknown) {
    const response = await fetch(`/api/10words/clients${path}`, { credentials: "include",
      ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Client keys could not be loaded.");
    return data;
  }
  async function reload() { setClients((await call()).clients); }
  useEffect(() => { void reload().catch(err => setError(err.message)); }, []);
  async function change(path: string, body: unknown) {
    setBusy(true); setError(""); setSecret("");
    try {
      const data = await call(path, body);
      if (data.key) setSecret(data.key);
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Client key could not be updated."); }
    finally { setBusy(false); }
  }
  return <section className="mt-10 rounded-xl border p-6" aria-label="10words API clients">
    <h2 className="text-xl font-semibold">API client keys</h2>
    <p className="mt-2 text-sm text-muted-foreground">Create a separate key for each app. Store it securely on that app’s backend.</p>
    <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void change("", { name, scopes, rateLimit: Number(limit) }); }}>
      <label className="block">Client name<Input required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <fieldset><legend>Permissions</legend>{permissions.map(scope => <label key={scope} className="mr-4 inline-flex gap-2">
        <input type="checkbox" checked={scopes.includes(scope)} onChange={event => setScopes(event.target.checked ? [...scopes, scope] : scopes.filter(item => item !== scope))} />{scope === "languages:read" ? "Languages" : scope === "lessons:read" ? "Lesson text" : "Audio"}
      </label>)}</fieldset>
      <label className="block">Requests per minute<Input type="number" min={1} max={120} required value={limit} onChange={event => setLimit(event.target.value)} /></label>
      <Button disabled={busy || !scopes.length}>Create client key</Button>
    </form>
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    {secret && <div className="mt-4 rounded border p-4" role="status">
      <p>Save this key now. It will only be shown once.</p><code className="block break-all select-all mt-2">{secret}</code>
      <Button className="mt-3" variant="outline" onClick={() => setSecret("")}>I’ve saved it</Button>
    </div>}
    <ul className="mt-6 space-y-4">{clients.map(client => <li key={client.id} className="rounded border p-4">
      <p className="font-semibold">{client.name} {client.revokedAt && "· Revoked"}</p>
      <p className="text-sm">{client.keyPrefix}… · {client.rateLimit}/minute · {client.usageCount} accepted requests</p>
      <p className="text-sm">{client.scopes.join(", ")} · Last used: {client.lastUsedAt ? new Date(client.lastUsedAt).toLocaleString() : "Never"}</p>
      {!client.revokedAt && <div className="mt-3 flex gap-3">
        <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Rotate ${client.name}? Its current key will stop working immediately.`)) void change(`/${client.id}/rotate`, {}); }}>Rotate</Button>
        <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Revoke ${client.name}? Its key will stop working immediately.`)) void change(`/${client.id}/revoke`, {}); }}>Revoke</Button>
      </div>}
    </li>)}</ul>
  </section>;
}
