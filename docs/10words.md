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

`db:10words` uses `DATABASE_URL` and the existing Neon WebSocket PostgreSQL driver. It creates only `ten_words_lessons`; rerunning it preserves existing data. It does not run the repository's general `db:push` or change other schemas. The standalone SQL is `migrations/0003_add_ten_words_lessons.sql`; it is not registered in the older Drizzle migration journal.

### Publishing with Replit's managed database

Run the focused migration against **development**, verify the section, then use **Publish** to apply the development schema to the managed production database. Do not redirect `DATABASE_URL` to production and run this script. Do not add schema changes to the production startup or build command. Republishing must preserve production lesson records; do not select an option that overwrites production data with development data.

The new section is distinct from the existing 100 language tutors: it also supports 100 languages, but its saved lessons and audio use their own table. Publishing the schema does not copy development's generated Spanish lesson into production. The first signed-in production request will generate and save its own lesson, unless a record already exists.

For an **external**, unmanaged production database, follow that database's documented migration process after confirming the target. Replit's managed Publish migration does not apply to external databases.

The application still requires its existing database, Google OAuth, session, Stripe and Together configuration for startup. New lesson generation and speech require `OPENAI_API_KEY` and HTTPS access to `api.openai.com`. The variable name is `OPENAI_API_KEY`, not the example file's `OpenAIAPI`. Store credentials in secure environment settings, never source control.

## Fixed lessons and audio

Typing `Lesson 1` selects the saved lesson for that language. On first access only, the service generates structured text, validates exactly ten distinct words and ten sentences, checks native script where applicable, and independently reviews language and word/sentence correspondence. Invalid output is retried once, then reported as an error; English fallback content is never saved.

The database primary key is `(language, lesson_number)`. Inserts do nothing on conflict, then read the persisted winner. Multiple users or server processes therefore receive identical saved content. In-process requests also share generation work. Content is not updated during visits, retries, server restarts or deployments. There is no automatic expiry, regeneration or edit endpoint. Any future editorial change must be explicit and coordinated with saved audio; changing the curriculum file does not change previously saved lessons. Back up this table as part of normal database backups.

Audio is generated from the saved ten words followed by the saved ten sentences. Words are narrated separately as 24 kHz mono PCM at 0.9× speech speed, then joined with 600 ms of actual silence between words and a one-second pause before the sentence block. The complete recording is packaged as WAV. Titles, English UI controls, lesson numbers and translations are never part of the speech input. WAV data is saved in the same record, once. Speech failures preserve the text; retries generate only missing audio. Competing audio writes retain the database winner. Existing MP3 recordings are upgraded on first playback using the same saved text. The upgrade uses a compare-and-swap against the previous recording, preserves the old audio if generation fails, and does not require a schema migration. Only audio is refreshed; lesson words and sentences remain fixed. Content is saved before narration, so a temporary audio failure cannot produce a different lesson on retry.

If a saved MP3 cannot be upgraded because narration is unavailable, the existing MP3 is returned with `Content-Type: audio/mpeg` rather than stranding the recording. Successful upgrades and new recordings use `audio/wav`. Consumers must respect the response content type instead of assuming every response is WAV. Failed upgrades leave saved text and audio unchanged; a later request can retry the upgrade.

OpenAI's TTS model detects pronunciation from the native text. The catalog includes a language search field. No lessons or recordings are generated simply by listing language choices. Pronunciation quality may vary by language; live language/audio checks require configured API credentials. The browser attempts playback after a requested lesson loads and offers Play if autoplay is blocked. Pause, replay, previous and next controls are provided. Lesson text uses plain paragraphs rather than numbered or bulleted lists. Arabic content is right-to-left.

## API and validation

All endpoints accept either an existing signed-in browser session or the dedicated integration key in an `Authorization: Bearer` header:

- `GET /api/10words/languages` — language catalog and lesson count.
- `POST /api/10words/:language/lesson` with `{"command":"Lesson 1"}` — return or create the fixed lesson.
- `POST /api/10words/:language/lessons/:lessonNumber/audio` — return or create its saved WAV.

Only supported language codes and lessons 1–50 are accepted. Generation uses POST to prevent link prefetchers from creating lessons. Database and API failures return an error separately from lesson content.

Run the focused checks:

```sh
npm test -- server/services/tenWords server/routes/tenWords.test.ts
```

These cover fixed content across service restarts, simultaneous requests, database-winner semantics, audio reuse and recovery, language review, formatting, curriculum counts, authentication and API errors. Automated tests mock external AI and storage calls. The API integration checks use the real router and lesson service with isolated storage and provider doubles, including repeated lesson/audio requests and a fresh service instance.

### Bounded smoke test

After the table is available, sign in and open **10words → Spanish**. Request **Lesson 1** and confirm:

- Exactly ten distinct Spanish vocabulary items and ten Spanish sentences appear.
- Play starts the saved narration; autoplay may require pressing Play.
- Requesting Lesson 1 again returns exactly the same text and narration.
- Reloading or restarting the app does not regenerate the saved lesson.

Test only this lesson: first-time text generation and narration incur OpenAI charges. Do not pre-generate every lesson. Production verification must use the actual signed-in flow; do not bypass authentication for testing.

Development verification on 2026-10-09 confirmed the real managed database table, a successful OpenAI Spanish Lesson 1 generation, and saved MP3 narration. Repeated requests and a fresh service reused identical saved text/audio with no additional generation. The MP3 contains decodable audio; this does not establish pronunciation quality or real signed-in browser playback. Subsequent read-only inspection confirmed the production table exists. The latest 100-language, audio-compatibility and API-key changes still require user-approved code publication. Recheck authenticated playback after publishing rather than treating a development smoke test as production proof.

Known limits outside this setup: no generation quota, no cross-worker generation lock (database uniqueness preserves the saved winner but not the cost of competing generations), and a curriculum distinct from the existing tutors. Audio playback failure recovery also needs separate attention.

## Connecting another program or voice agent

Configure a dedicated `TEN_WORDS_API_KEY` secret on the ShareBrain server and the same value on the ReplitJevBrowser backend. Use 32–256 non-whitespace characters; a securely generated 32-byte hex token is suitable. Generate it in your secure deployment tooling and store it in environment Secrets. Never put the key in browser JavaScript, URLs, source control, or chat. No database migration is needed for this authentication change.

This integration key grants access only to the 10words endpoints. Existing general agent API keys are not accepted here. If `TEN_WORDS_API_KEY` is unset, server-to-server key access is disabled and normal browser-session access continues to work. Rotate or revoke the key by updating or removing the configured value on the deployment, then restarting/applying its runtime configuration. The code reads the active environment value per request.

Example server-to-server requests (environment values are supplied securely by your deployment):

```sh
curl --fail --silent --show-error "$SHAREBRAIN_BASE_URL/api/10words/languages" \
  -H "Authorization: Bearer $TEN_WORDS_API_KEY"

curl --fail --silent --show-error "$SHAREBRAIN_BASE_URL/api/10words/es/lesson" \
  -H "Authorization: Bearer $TEN_WORDS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"Lesson 1"}'

curl --fail --silent --show-error -X POST "$SHAREBRAIN_BASE_URL/api/10words/es/lessons/1/audio" \
  -H "Authorization: Bearer $TEN_WORDS_API_KEY" -o lesson.wav
```

The lesson JSON contains `language`, `lessonNumber`, `words` (ten strings), and `sentences` (ten strings). Audio is binary WAV, not a JSON URL; legacy MP3 fallback is possible when an upgrade is unavailable, so use the response `Content-Type`. Map “Spanish lesson one” to `es` / `Lesson 1`, and “French lesson ten” to `fr` / `Lesson 10`. Discover language names and codes from `/languages` rather than maintaining a separate list. Requests for saved lessons reuse their fixed database content.

ReplitJevBrowser should make these calls from its backend and deliver the returned audio through its own authenticated endpoint. Pause recognition while audio plays, so the lesson does not become another command. The browser needs no ShareBrain API key, cross-site cookies or direct cross-origin requests. Use HTTPS in deployment.

Invalid, missing or revoked key credentials return 401. Supplied invalid Authorization headers do not fall back to a session. Key-authenticated calls share a 120-request-per-minute limit per server process; 429 includes `Retry-After`. Browser-session requests retain their existing behavior. API-key values are never logged by this middleware. Multiple server instances enforce independent limits; this is not a distributed quota. Generation and database errors still return 503 and do not save fallback lesson text.
