# Architecture and schema

Browser → Cloudflare Worker (vinext / React App Router) → authorized route handlers → Drizzle → Cloudflare D1. Workers Static Assets serves the versioned client bundles and WebP images. There is one Worker and one production D1 database. No KV, R2, external database, analytics service or localStorage persistence is required. Local Wrangler storage is separate from production.

## Code boundaries

- `app/`: server-protected pages and HTTP handlers.
- `components/`: UI, forms, focus modes, charts and reviews.
- `lib/domain/`: shared validation, timezone/calendar functions and pure calculations.
- `lib/db/`: relational schema, connection and user-scoped repository.
- `lib/auth.ts`, `lib/http.ts`, `proxy.ts`: authentication, request boundaries and headers.
- `migrations/`: Drizzle-generated, Wrangler-applied SQL history.
- `tests/`, `scripts/`: calculations, local-only seed and HTTP integration tests.

## Tables

| Area              | Tables                                                                                                                  | Purpose                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Authentication    | `users`, `sessions`, `accounts`, `verifications`, `rate_limits`                                                         | Better Auth sessions, password hashes and limits.                                           |
| Preferences       | `user_settings`, `app_preferences`                                                                                      | One row per user; typed settings JSON and appearance preferences.                           |
| Daily structure   | `daily_sadhana`, `wake_records`, `daily_sankalpas`                                                                      | One row per user/date; ideal/minimum mode, offered status, morning practices and intention. |
| Practice sessions | `japa_sessions`, `hearing_sessions`, `reading_sessions`, `krishna_book_sessions`, `seva_entries`, `association_entries` | Multiple normalized sessions per user/date. Krishna Book is separate from daytime reading.  |
| Reflection        | `night_reflections`, `weekly_reviews`, `monthly_reviews`, `prabhupada_reflections`                                      | One entry per user and period anchor date.                                                  |
| Inspiration       | `jayananda_qualities`, `quality_reflections`, `personal_purpose`                                                        | Shared quality names, private reflections and editable purpose.                             |
| Intentions        | `goals`, `reminders`                                                                                                    | Private goals and optional on-page reminder cues.                                           |

Personal rows use foreign keys with cascading user deletion. `(user_id, date)` indexes support day/week/month range scans without redundant year/month columns. A state request loads the selected month plus seven days on each side for boundary weeks. History fetches other periods as needed. Exports fetch all of the signed-in user's practice data, excluding authentication tables.

## Privacy and integrity

Better Auth provides password hashing, sessions, password changes and database-backed rate limiting. Production cookies are Secure, HttpOnly and SameSite=Lax. Mutations validate origins; personal APIs validate server sessions and constrain queries by user ID. Clients cannot choose an owner. Zod validates input, mutation bodies are limited to 64 KiB, SQL values are parameterized and table names are allowlisted. Private responses are not cached. CSV formula cells are escaped.

Registration requires a random invitation, the configured owner email, and an empty users table. Constant-time comparison checks the invitation. There is no public signup or journal. The schema supports multiple users, but adding users needs a deliberate future administration flow. Cloudflare administrators retain database access; this is not end-to-end encryption.

New session saves carry idempotency UUIDs, so retrying an uncertain response does not add rounds twice. Daily entries upsert on `(user_id,date)`. Saving a night reflection and closing its day uses an atomic D1 batch; moving/removing the reflection updates the corresponding day state.

## Habit commitments

`habits` stores each user's name, intention, inclusive start/end dates and archive state. `habit_checkins` stores the boolean and optional notes, with a unique `(habit_id, date)` constraint. These tables have dedicated user-scoped routes and are excluded from the generic practice CRUD API. Starter habits are created once per user through an authenticated, origin-checked POST, using unique starter keys to make retries safe.

Daily PATCH bodies accept only `completed` and/or `notes`. The server computes the current day from its clock and the user's timezone. An automatically supplied `x-habit-day` header rejects stale overnight submissions; it cannot select the storage date. The UI refreshes at day rollover and keeps unsaved notes for review. Upserts update only supplied fields, preserving notes when a toggle changes. Future, finished and archived habits reject check-ins. Definition edits cannot move existing check-ins outside the commitment's dates.

Dashboard requests include all habit definitions with aggregate past-day completion counts and the last seven check-in days. Individual calendars load one year at a time. Reports exclude today and future dates from elapsed-day denominators and show today's state separately; they measure recorded consistency only. Archive retains all data; it hides a habit from today's controls rather than pausing its date range. JSON/CSV exports include habits and notes. Habit data does not alter Sādhana Health.

## Practice calculations

Calendar dates use the configured IANA timezone. Weeks start Monday. Weekly/monthly denominators include elapsed days and exclude future dates. Missing ratings do not count as zero. Multiple positive Krishna Book sessions count as one reading night.

Sādhana Health summarizes external practice consistency. Default weights: morning 10, rounds 25, recording Japa quality reflection 15, hearing 10, reading 10, Krishna Book 10, seva 10, night reflection 5, association 5. Attention 1 and 5 earn identical reflection contributions. Completion contributions are capped. Minimum mode removes optional practices from the denominator instead of crediting skipped practices. Historical summaries use current settings, without snapshots of previous targets.

The early-Japa attention insight requires seven distinct recorded days and reports the observed average; it makes no causal or spiritual conclusion. Every health display includes: “This reflects consistency of practice, not spiritual advancement.”
