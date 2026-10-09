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

`db:10words` uses `DATABASE_URL` and the existing Neon WebSocket PostgreSQL driver. It creates `ten_words_lessons` and `ten_words_api_clients`; rerunning it preserves existing data. It does not run the repository's general `db:push` or change other schemas. The standalone SQL files are `migrations/0003_add_ten_words_lessons.sql` and `migrations/0004_add_ten_words_api_clients.sql`; they are not registered in the older Drizzle migration journal.

### Publishing with Replit's managed database

Run the focused migration against **development**, verify the section, then use **Publish** to apply the development schema to the managed production database. Do not redirect `DATABASE_URL` to production and run this script. Do not add schema changes to the production startup or build command. Republishing must preserve production lesson records; do not select an option that overwrites production data with development data.

The new section is distinct from the existing 100 language tutors: it also supports 100 languages, but its saved lessons and audio use their own table. Publishing the schema does not copy development's generated Spanish lesson into production. The first signed-in production request will generate and save its own lesson, unless a record already exists.

For an **external**, unmanaged production database, follow that database's documented migration process after confirming the target. Replit's managed Publish migration does not apply to external databases.

The application still requires its existing database, Google OAuth, session, Stripe and Together configuration for startup. New lesson generation and speech require `OPENAI_API_KEY` and HTTPS access to `api.openai.com`. The variable name is `OPENAI_API_KEY`, not the example file's `OpenAIAPI`. Store credentials in secure environment settings, never source control.

## Fixed lessons and audio

Typing `Lesson 1` selects the saved lesson for that language. On first access only, the service generates structured text, validates exactly ten distinct words and ten sentences, checks native script where applicable, and independently reviews language and word/sentence correspondence. Invalid output is retried once, then reported as an error; English fallback content is never saved.

The database primary key is `(language, lesson_number)`. Inserts do nothing on conflict, then read the persisted winner. Multiple users or server processes therefore receive identical saved content. In-process requests also share generation work. Content is not updated during visits, retries, server restarts or deployments. There is no automatic expiry, regeneration or edit endpoint. Any future editorial change must be explicit and coordinated with saved audio; changing the curriculum file does not change previously saved lessons. Back up this table as part of normal database backups.

Audio uses the original narration flow: one OpenAI TTS request for the saved ten words followed by the saved ten sentences, returned and cached as MP3 at the provider’s default speed. There are no inserted pauses, separate word requests, PCM assembly, or silence verification. Titles, translations, numbering, and other UI text are excluded from narration. Existing MP3s are reused. WAV recordings from the former pause pipeline are replaced on next playback using the unchanged saved text. Replacement uses a compare-and-swap to preserve concurrent audio writes; failures preserve existing data and allow retry. No database migration is required. Refresh the browser after deploying to discard an already loaded WAV recording.

OpenAI's TTS model detects pronunciation from the native text. The catalog includes a language search field. No lessons or recordings are generated simply by listing language choices. Pronunciation quality may vary by language; live language/audio checks require configured API credentials. The browser attempts playback after a requested lesson loads and offers Play if autoplay is blocked. Pause, replay, previous and next controls are provided. Lesson text uses plain paragraphs rather than numbered or bulleted lists. Arabic content is right-to-left.

## API and validation

All endpoints accept either an existing signed-in browser session or the dedicated integration key in an `Authorization: Bearer` header:

- `GET /api/10words/languages` — language catalog and lesson count.
- `POST /api/10words/:language/lesson` with `{"command":"Lesson 1"}` — return or create the fixed lesson.
- `POST /api/10words/:language/lessons/:lessonNumber/audio` — return or create its saved MP3.

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

## Client API keys and voice-agent integration

Run `npm run db:10words` with development’s securely configured `DATABASE_URL` before deploying this update, then follow the managed Publish or external-database migration process described above. It applies the lesson migration plus `0004_add_ten_words_api_clients.sql` idempotently without changing saved lessons. This update replaces the shared `TEN_WORDS_API_KEY`; that environment secret is no longer accepted. Issue a separate client key to each integrating app before switching it over.

Open **10words → API client keys** while signed in. Enter the app’s name, choose its permissions, and set its request limit (1–120/minute). Save the generated key immediately in that app’s backend Secrets: it appears only in the creation/rotation response and cannot be retrieved later. ShareBrain stores only its SHA-256 hash and a short identification prefix. Keys contain 256 bits of cryptographic randomness. Never place keys in browser JavaScript, URLs, source control or chat.

Each client has an owner, permissions, persistent accepted-request count, last-use timestamp, and request limit. The dashboard lists only your clients and lets you revoke or rotate each independently. Rotation invalidates the previous key immediately, preserving client usage and quota state. Revocation is permanent; create a new client to restore access. Requests already authorized may finish after rotation/revocation.

Permissions are `languages:read`, `lessons:read`, and `audio:read`, corresponding to the three lesson endpoints below. A lesson/audio request can generate and save missing content, so grant these permissions only to apps you trust to incur generation costs. Valid key requests consume that client's limit before lesson processing (including downstream validation/provider failures). Missing, revoked or incorrect credentials return 401; missing endpoint permission returns 403; a limit returns 429 with `Retry-After: 60`; database/authentication outages fail closed with 503. Invalid supplied Authorization headers never fall back to a browser session.

Limits are atomic database counters shared across server instances, reset at each database UTC minute. Rotation does not reset them. Counters measure accepted authenticated calls, not billing or successful generation. This is a per-client request limit, not a daily spend cap or a global abuse-protection system. Separate clients have independent limits; avoid issuing multiple clients to bypass your intended budget.

Server-to-server examples (supply environment values securely):

```sh
curl --fail --silent --show-error "$SHAREBRAIN_BASE_URL/api/10words/languages" \
  -H "Authorization: Bearer $TEN_WORDS_CLIENT_KEY"

curl --fail --silent --show-error "$SHAREBRAIN_BASE_URL/api/10words/es/lesson" \
  -H "Authorization: Bearer $TEN_WORDS_CLIENT_KEY" \
  -H "Content-Type: application/json" -d '{"command":"Lesson 1"}'

curl --fail --silent --show-error -X POST "$SHAREBRAIN_BASE_URL/api/10words/es/lessons/1/audio" \
  -H "Authorization: Bearer $TEN_WORDS_CLIENT_KEY" -o lesson.mp3
```

The lesson JSON contains `language`, `lessonNumber`, `words` (ten strings), and `sentences` (ten strings). Audio is binary MP3, not a JSON URL. Map “Spanish lesson one” to `es` / `Lesson 1`, and “French lesson ten” to `fr` / `Lesson 10`. Discover language names and codes from `/languages` rather than maintaining a separate list. Requests for saved lessons reuse their fixed database content.

ReplitJevBrowser should call from its backend and deliver audio through its own authenticated endpoint. Pause recognition while audio plays. Its browser needs no ShareBrain key or cross-origin cookies. Use HTTPS. This change supplies ShareBrain access; the voice-agent integration is a separate change.

Management endpoints under `/api/10words/clients` require a signed-in browser session; Bearer keys cannot manage clients. All responses use `Cache-Control: no-store`, and client-management response bodies are excluded from application request logs.

- `GET /` → `{clients: [...]}` with public metadata only, never hashes or full keys.
- `POST /` with `{name, scopes, rateLimit}` → `{key, client}` (201), key returned once.
- `POST /:id/rotate` with `{}` → `{key, client}`, replacement key returned once.
- `POST /:id/revoke` with `{}` → revoked client metadata.

Mutations require JSON and reject foreign browser origins. All operations enforce owner identity; another owner’s IDs return 404 on mutation. Removing a user also removes their client keys.
