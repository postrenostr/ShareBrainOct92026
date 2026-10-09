import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { BookOpen, Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lessonLevel, parseLessonCommand, tenWordsLanguages, TEN_WORDS_LESSON_COUNT, type TenWordsLesson } from "@shared/tenWords";

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.message || "Something went wrong. Please try again.");
}

export default function TenWords() {
  const [location] = useLocation();
  const base = location.startsWith("/test/") ? "/test/10words" : "/10words";
  const [, params] = useRoute(`${base}/:language`);
  const language = tenWordsLanguages.find(item => item.code === params?.language);
  const [command, setCommand] = useState("Lesson 1");
  const [lesson, setLesson] = useState<TenWordsLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [audioMessage, setAudioMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const lessonRequest = useRef<AbortController | null>(null);
  const audioRequest = useRef<AbortController | null>(null);

  function clearAudio() {
    audioRequest.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }

  useEffect(() => {
    lessonRequest.current?.abort();
    clearAudio();
    setLesson(null);
    setCommand("Lesson 1");
    setError("");
    setAudioMessage("");
    setLoading(false);
    setAudioLoading(false);
    setPlaying(false);
    return () => { lessonRequest.current?.abort(); clearAudio(); };
  }, [language?.code]);

  async function playLesson(saved: TenWordsLesson) {
    const audio = audioRef.current;
    if (!audio) return;
    audioRequest.current?.abort();
    const controller = new AbortController();
    audioRequest.current = controller;
    setAudioMessage("");
    try {
      if (!audioUrl.current) {
        setAudioLoading(true);
        const response = await fetch(`/api/10words/${saved.language}/lessons/${saved.lessonNumber}/audio`, {
          method: "POST", credentials: "include", signal: controller.signal,
        });
        if (!response.ok) throw await responseError(response);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        audioUrl.current = URL.createObjectURL(blob);
        audio.src = audioUrl.current;
      }
      if (controller.signal.aborted) return;
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      if (controller.signal.aborted) return;
      setPlaying(false);
      setAudioMessage(err instanceof Error && err.name === "NotAllowedError"
        ? "Your lesson is ready. Press Play to hear it."
        : err instanceof Error ? err.message : "Audio is unavailable. Please try again.");
    } finally {
      if (audioRequest.current === controller) setAudioLoading(false);
    }
  }

  async function loadLesson(number: number) {
    if (!language) return;
    lessonRequest.current?.abort();
    const controller = new AbortController();
    lessonRequest.current = controller;
    clearAudio();
    setPlaying(false);
    setAudioLoading(false);
    setAudioMessage("");
    setError("");
    setLesson(null);
    setLoading(true);
    setCommand(`Lesson ${number}`);
    try {
      const response = await fetch(`/api/10words/${language.code}/lesson`, {
        method: "POST", credentials: "include", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: `Lesson ${number}` }),
      });
      if (!response.ok) throw await responseError(response);
      const saved: TenWordsLesson = await response.json();
      if (controller.signal.aborted) return;
      setLesson(saved);
      // Only new, explicitly requested lessons autoplay; opening the catalog stays quiet.
      void playLesson(saved);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "The lesson could not be loaded.");
    } finally {
      if (lessonRequest.current === controller) setLoading(false);
    }
  }

  if (!language) return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <h1 className="text-3xl font-bold">10words language agents</h1>
      <p className="mt-3 text-muted-foreground">Ten words. Ten sentences. Hear only the language you’re learning.</p>
      <p className="mt-2 text-sm text-muted-foreground">Fifty saved lessons, from simple everyday words to more challenging ideas. Choose your language.</p>
      {params?.language && <p role="alert" className="mt-4">That language is not available. Choose one below.</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tenWordsLanguages.map(item => (
          <Link key={item.code} href={`${base}/${item.code}`} className="rounded-xl border border-border p-6 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <BookOpen className="mb-4 h-6 w-6" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p lang={item.code} dir={item.direction} className="mt-1 text-muted-foreground">{item.nativeName}</p>
          </Link>
        ))}
      </div>
    </main>
  );

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <Link href={base} className="text-sm text-muted-foreground hover:underline">All 10words languages</Link>
        <h1 className="mt-4 text-3xl font-bold">10words · {language.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter “Lesson 1” to begin. Each saved lesson stays the same every time you return.</p>
        <form className="mt-6 flex gap-3" onSubmit={event => {
          event.preventDefault();
          const number = parseLessonCommand(command);
          if (number === null) setError("Enter Lesson 1 through Lesson 50.");
          else void loadLesson(number);
        }}>
          <label htmlFor="lesson-command" className="sr-only">Lesson command</label>
          <Input id="lesson-command" value={command} onChange={event => setCommand(event.target.value)} placeholder="Lesson 1" disabled={loading} />
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" /> : "Start lesson"}</Button>
        </form>
        {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
        {loading && <p role="status" className="mt-6 text-muted-foreground">Loading your lesson…</p>}
        {lesson && <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Lesson {lesson.lessonNumber} · {lessonLevel(lesson.lessonNumber)}</p>
            <Button disabled={audioLoading} onClick={() => {
              if (playing) { audioRef.current?.pause(); setPlaying(false); }
              else void playLesson(lesson);
            }}>
              {audioLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing audio</>
                : playing ? <><Square className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> Play</>}
            </Button>
          </div>
          {audioMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{audioMessage}</p>}
          <section aria-label={`${language.name} lesson content`} lang={language.code} dir={language.direction}
            className="mt-5 rounded-xl border border-border p-6 text-xl leading-relaxed">
            <p className="whitespace-pre-line">{lesson.words.join("\n")}</p>
            <p className="mt-8 whitespace-pre-line">{lesson.sentences.join("\n")}</p>
          </section>
          <div className="mt-6 flex justify-between gap-4">
            <Button variant="outline" disabled={loading || lesson.lessonNumber <= 1} onClick={() => void loadLesson(lesson.lessonNumber - 1)}>Previous lesson</Button>
            <Button variant="outline" disabled={loading || lesson.lessonNumber >= TEN_WORDS_LESSON_COUNT} onClick={() => void loadLesson(lesson.lessonNumber + 1)}>Next lesson</Button>
          </div>
        </>}
        <audio ref={audioRef} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onError={() => { setPlaying(false); setAudioMessage("Audio could not be played. Please try again."); }} />
      </div>
    </main>
  );
}
