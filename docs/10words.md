# 10words language agents

A separate language section at `/10words`, linked directly from the sidebar. It does not alter existing language teachers, prompts, chat handling or lesson caches.

One hundred language agents, matching the normal tutor catalog, share a fixed, version-one curriculum of fifty lessons. The progression starts with everyday vocabulary and advances to nuanced, abstract language. Each lesson contains ten vocabulary items (a fixed expression such as “thank you” counts as one item) and ten sentences using the corresponding items. Later sentences reuse earlier vocabulary and become more complex.

## Setup

Use the existing application configuration and a development database. Apply the additive migration before starting the new section:

```sh
npm run db:10words
npm run build
npm run dev
```

`db:10words` uses `DATABASE_URL` and the existing Neon WebSocket PostgreSQL driver. It creates only `ten_words_lessons`; rerunning it preserves existing data. It does not run the repository's general `db:push` or change other schemas. The standalone SQL is `migrations/0003_add_ten_words_lessons.sql`. A deployment using its own migration runner should apply that SQL explicitly; it is not registered in the older Drizzle migration journal.

The application still requires its existing database, Google OAuth, session, Stripe and Together configuration for startup. New lesson generation and speech require `OPENAI_API_KEY` and HTTPS access to `api.openai.com`. The variable name is `OPENAI_API_KEY`, not the example file's `OpenAIAPI`. Store credentials in secure environment settings, never source control. The cloud environment currently does not expose the database or API binding, so the actual database migration and live AI/audio validation remain pending.

## Fixed lessons and audio

Typing `Lesson 1` selects the saved lesson for that language. On first access only, the service generates structured text, validates exactly ten distinct words and ten sentences, checks native script where applicable, and independently reviews language and word/sentence correspondence. Invalid output is retried once, then reported as an error; English fallback content is never saved.

The database primary key is `(language, lesson_number)`. Inserts do nothing on conflict, then read the persisted winner. Multiple users or server processes therefore receive identical saved content. In-process requests also share generation work. Content is not updated during visits, retries, server restarts or deployments. There is no automatic expiry, regeneration or edit endpoint. Any future editorial change must be explicit and coordinated with saved audio; changing the curriculum file does not change previously saved lessons. Back up this table as part of normal database backups.

Audio is generated from the saved ten words followed by the saved ten sentences. Words are narrated separately as 24 kHz mono PCM at 0.9× speech speed, then joined with 600 ms of actual silence between words and a one-second pause before the sentence block. The complete recording is packaged as WAV. Titles, English UI controls, lesson numbers and translations are never part of the speech input. WAV data is saved in the same record, once. Speech failures preserve the text; retries generate only missing audio. Competing audio writes retain the database winner. Existing MP3 recordings are upgraded on first playback using the same saved text. The upgrade uses a compare-and-swap against the previous recording, preserves the old audio if generation fails, and does not require a schema migration. Only audio is refreshed; lesson words and sentences remain fixed. Content is saved before narration, so a temporary audio failure cannot produce a different lesson on retry.

OpenAI's TTS model detects pronunciation from the native text. The catalog includes a language search field. No lessons or recordings are generated simply by listing language choices. Pronunciation quality may vary by language; live language/audio checks require configured API credentials. The browser attempts playback after a requested lesson loads and offers Play if autoplay is blocked. Pause, replay, previous and next controls are provided. Lesson text uses plain paragraphs rather than numbered or bulleted lists. Arabic content is right-to-left.

## API and validation

All new endpoints require the existing authentication middleware:

- `GET /api/10words/languages` — language catalog and lesson count.
- `POST /api/10words/:language/lesson` with `{"command":"Lesson 1"}` — return or create the fixed lesson.
- `POST /api/10words/:language/lessons/:lessonNumber/audio` — return or create its saved WAV.

Only supported language codes and lessons 1–50 are accepted. Generation uses POST to prevent link prefetchers from creating lessons. Database and API failures return an error separately from lesson content.

Run the focused checks:

```sh
npm test -- server/services/tenWords server/routes/tenWords.test.ts
```

These cover fixed content across restarts, simultaneous requests, database-winner semantics, audio reuse and recovery, language review, formatting, curriculum counts, authentication and API errors. They mock external AI and storage calls. The migration was separately exercised in a temporary PostgreSQL engine; UI DOM validation exercised plain target-language display, playback fallback, pause/replay, navigation and audio failures. Real database connectivity and spoken pronunciation still need validation with the configured service credentials. Existing unrelated type-check and chat-test failures are not repaired by this feature.
