# Release verification

## Three-pillar companion — approved release, 28 September 2026

The owner approved the working local demo and production release, with English-only hearing suggestions. Both Hindi Prabhupāda selections were removed; catalog refresh uses the verified English allowlist. Historical progress remains intact, and completion counts include only available lessons.

- Final English-only build: 123 tests pass, TypeScript passes, production build and Wrangler deployment dry run pass.
- The preceding local review passed 129 HTTP integration assertions and browser checks for all three players, sequential Bhagavad-gītā reading, interrupted-save recovery, and phone/desktop layouts; details are below.
- The production database was backed up privately and a Time Travel recovery bookmark captured before migration. Only the additive `0002_third_catseye.sql` companion table/index migration is required. Existing journal tables and authentication secrets remain unchanged.

## Gentle companion redesign — 28 September 2026

- TypeScript, production build and 79 unit tests passed, including five tests for honest practice-garden activity, dates, zero corrections and habit check-ins.
- Browser checks covered the dashboard practice switcher, Habit/Reflect tabs, arrow-key tab navigation, grouped phone navigation, expanded weekly statistics, purpose/quality access, quick-start anchor, Japa add/subtract and saved-effort feedback.
- Desktop and 390px phone layouts were visually reviewed. Both 320px and 390px checks found no horizontal page overflow. Temporary browser viewport changes were reset and the single local QA entry removed.
- All original forms, API routes, database schema, exports, reports and PWA assets are preserved. Primary actions remain visible; secondary statistics and histories use labelled expandable sections. The garden uses existing saved data and has no new persistence or service dependency.

Production: all 13 PWA delivery checks passed; the new stylesheet and dashboard bundle match the tested build. Deployment version: `b549ab6a-0c57-482d-9ffd-baf216a1822a`.

## Today Report and Japa corrections — 27 September 2026

- TypeScript and production build passed; 74 unit tests passed. The vinext compatibility check reports 13 supported, 0 issues.
- Local Worker + D1 integration: 40 existing journal assertions, 26 habit assertions and 16 new Japa/report assertions passed.
- Correction checks cover authentication, per-user/date isolation, origin validation, atomic concurrent/retried subtraction, zero boundaries, persisted totals, and preservation of session notes, times, duration and attention.
- Report checks cover today-only totals, partial targets, minimum days, zero targets, late recorded wake times, active habit date boundaries, unchecked notes, archived recorded habits and all saved form fields including selected morning practices.
- Browser testing verified dashboard and Japa-page subtraction, the disabled control at zero, focus-session plus/minus, live report totals, wake-time quick entry with bedtime blank, and expanded morning details. Desktop and 390px phone layouts were reviewed; the phone report had no horizontal page overflow.
- Fixed blank optional time fields blocking wake-up/Japa/Krishna Book form submissions. Invalid times remain rejected.

All write tests used local sample accounts. Browser QA records were removed afterward. No database migration is required.

Production verification passed 13 PWA delivery checks plus the Today Report sign-in redirect, anonymous correction rejection, and both deployed client bundles matching the tested build. Deployment version: `6aeb95e4-baef-4a77-a16a-9fb3733334d8`.

## PWA installation release

Phone installation support adds a standalone web app manifest, Android regular/maskable icons, an iPhone touch icon and metadata, and a service worker with a public offline fallback. Existing journal behavior and database schema are unchanged.

- TypeScript and production build passed; 63 unit tests passed, including 11 service-worker privacy/lifecycle tests.
- 13 HTTP delivery checks passed both locally and in production: manifest identity/scope/display, PNG sizes, Apple/Android metadata, service-worker MIME/cache headers, the canonical offline URL, existing bundle caching, and authenticated API protection.
- Browser testing verified the worker registration, then stopped the actual local server. Reload displayed the cached offline message; after restarting the server, Try again reopened the journal normally.
- The worker caches only the public offline message. API calls, mutations, private page responses and credentials are never added to Cache Storage. Updates wait for old windows to close, preserving open forms.

Install instructions are in the README. Physical Android/iPhone home-screen installation was not performed in this desktop environment.

Deployment version: `728086db-1b4b-443f-a910-08ef4f3cbd22`.

## Habit tracker release

The habit tracker and daily companion update was tested on the built local Cloudflare Worker with local D1. Production received only the additive migration and app deployment; private production records were not used as test fixtures.

| Check                                   | Result                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| TypeScript                              | Passed                                                                                        |
| Unit and calendar validation            | 52 passed                                                                                     |
| Existing journal HTTP integration       | 40 assertions passed                                                                          |
| Habit HTTP integration                  | 26 assertions passed on the final build                                                       |
| vinext compatibility                    | 13 supported, 0 partial, 0 issues                                                             |
| Production build and deployment dry run | Passed; 554.98 KiB gzip                                                                       |
| Production migration                    | Two habit tables and indexes added successfully                                               |
| Cloudflare deployment startup           | 15 ms reported                                                                                |
| Live release checks                     | 9 passed: sign-in, protected pages/APIs, anonymous-write rejection, hero asset and new styles |

Habit checks cover starter creation and retry safety, custom commitments, inclusive dates and leap years, timezone boundaries, automatic daily date assignment, rejection of supplied dates, stale overnight submissions, duplicate taps, independent toggle/notes updates, editing without losing history, archiving/restoring, future and finished commitments, per-user isolation, origin checks, aggregate reports and JSON/CSV exports.

Browser verification covered daily toggles, optional notes, note preservation after unticking and reload, custom habit creation, archive behavior, read-only yearly reports, light/dark themes and layouts at 320, 390, 768 and 1440 pixels. No horizontal page overflow was found at those widths. Today and habit check-in pages contain no date inputs; commitment start/end dates remain in the creation/edit dialog. Returning from an older journal month to Today was also checked. No browser console errors were reported during the functional review.

A private SQL backup and a Time Travel bookmark were captured before applying migration `0001_parallel_maelstrom.sql`. The backup is ignored by Git and restricted to file mode 600. Existing journal tables and credentials were preserved.

Deployment version: `38b37069-4197-4b11-96b8-d1d102ad0cb4`.

Authenticated write flows were exercised locally. Production checks use anonymous requests and do not create an account or write journal entries. This is functional verification, not a comprehensive accessibility or security audit.

## Initial release — 24 September 2026

The production build was tested as an actual local Cloudflare Worker against local D1 before deployment. All example data and write tests were local; the production database was confirmed empty before release.

| Check                         | Result                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| TypeScript                    | Passed, no type errors                                                                |
| Unit/validation suite         | 39 passed                                                                             |
| Worker + D1 HTTP integration  | 40 assertions passed                                                                  |
| First-account bootstrap       | 9 assertions passed; temporary local account removed                                  |
| vinext compatibility          | 13 supported, 0 partial, 0 issues                                                     |
| Production build              | Passed                                                                                |
| Wrangler deployment dry run   | Passed; 545.32 KiB gzip                                                               |
| Local startup profile         | 17.7 ms active sampled CPU; machine-specific                                          |
| Cloudflare deployment startup | 14 ms reported                                                                        |
| npm audit                     | 0 known vulnerabilities at verification time                                          |
| Live release checks           | 8 passed: redirects, login, protected APIs, assets and registration/sign-in rejection |

Unit tests cover weighted practice consistency, ideal/minimum days, missing ratings, multiple sessions, distinct reading nights, calendar boundaries, timezone/DST cases, invalid dates and numeric values, and long reflections.

HTTP integration covers password sign-in, secure session attributes, anonymous rejection, user isolation, cross-origin rejection, validation, idempotent session retries, all practice collections, persistent edits/deletes/settings, daily upserts, atomic reflection/day closure, JSON/CSV export, private registration and sign-out invalidation. Bootstrap tests exercise an empty local database, invitation checks, account creation, onboarding, the full default purpose, signup closure and password change.

Browser checks in the Codex browser exercised sign-in, onboarding with default purpose, quick Japa updates and reload persistence, Japa focus/pause/finish, hearing entry, Krishna Book focus/pause/finish including fractional-minute save, night reflection/offering, weekly/monthly reviews and saved dark theme. Layout checks covered widths 320, 390, 768 and 1440; the 320px horizontal overflow found during review was fixed and rechecked.

Live checks on `https://jayananda.aneeshm059.workers.dev` confirmed anonymous `/` redirects to login, `/login` serves with CSP, `/api/state` and `/api/export` return 401, both hero assets serve successfully, registration without an invitation returns 403, and a nonexistent demo sign-in returns 401. No production account or practice record was created by these checks. Authenticated production use starts when the owner creates their password with the private invitation; those same flows were exercised locally.

Deployment version: `3fc83e16-1441-44ce-8ad8-7a9be01c97c5`.

This is functional verification, not an independent penetration test or a comprehensive screen-reader audit. Known functional limitations are recorded in the README.

## Three-pillar local review (28 September 2026)

Local working branch `codex/three-pillar-companion`; no commit, push, remote migration, or deployment. Additive companion migration applied only to local D1.

- TypeScript, vinext compatibility check and production bundle build pass.
- 101 unit/domain/repository tests pass, including user isolation, optimistic conflicts, bounded source links, playback seek accounting and midnight splitting.
- Existing Worker + local D1 checks: 40 general assertions and 16 Japa/report assertions pass. One initial general run had a transient Wrangler proxy connection failure; the isolated request and complete rerun passed.
- Companion HTTP integration: 25 assertions pass against the built local Worker, covering authentication, origin and payload validation, per-user isolation, optimistic version conflicts, private caching and JSON export. Disposable fixture values were restored after the checks.
- Browser: original Soulful Japa video plays in the embedded player; a 10:30 bookmark survives a full reload; Happiness & Pleasure has an independent bookmark and moves from Session 1 to Session 2 after explicit completion.
- PrabhupadaBooks bookmark and personal note persist after reload; external link returns the exact saved URL. Reading and home layouts checked at phone width (390px) without horizontal overflow.
- Japa browser flow: plus twice, minus once, save unfinished session, reload and restore one round paused, then finish once. The daily total increased by exactly one round and the draft cleared.
- A personal instruction saved from Soulful Japa appears in the chanting space with its source. The learning page also fits the 390px phone viewport without horizontal overflow.

Catalog sources and ordering are documented in `docs/LEARNING-SOURCES.md`. This first demo has local account data only. Recommendations currently use a small verified editorial selection; there are no generated lecture summaries or AI processing of private reflections. Reminder cues are in-app, not push delivery.

### Playback and sequential reading follow-up

- TypeScript and the production bundle pass. All 121 tests pass, including the YouTube loader's failed-load retry and timeout behavior, accurate watch credit, Bhagavad-gītā chapter/verse boundaries, concurrent submissions, and an injected database insert failure that proves report/bookmark rollback.
- Local Worker integration: 40 general, 16 Japa/report, 25 companion, 26 habit and 22 sequential-reading assertions pass. The reading harness restores its isolated fixture bookmark and removes only its own journal rows.
- Browser playback verified for The Acharya's Prabhupada lecture, Happiness & Pleasure Session 2, and Soulful Japa Session 1. Direct Pause/Resume works; independent bookmarks remain. The originally reported failure was intermittent and could not be consistently reproduced. Player startup now has bounded loading, explicit Play/Resume, error messages and Retry; unavailable third-party videos still depend on YouTube.
- Browser reading flow starts at 2:10, captures the start/book/date, saves an ending verse of 2:10, and shows 2:11 after reload. The next session's actual source link is `https://prabhupadabooks.com/bg/2/11`.
- Interrupted-save test stopped the local Worker while submitting the reading form. A visible failure retained the verse and note; navigating away and returning restored the draft. Restarting the Worker and retrying saved the report and advanced the bookmark once. Today Report displayed the verse range and note. Unentered optional minutes are not fabricated.
- Unsaved generic journal forms require an explicit discard before closing; Keep editing preserves the form. Pending playback checkpoints survive route changes in the companion provider and warn before unloading. Reading finish drafts use session storage for recovery within the browser tab.
- Reading and learning layouts fit a 390px phone viewport without horizontal overflow; the reading layout was also reviewed at 1280px. All testing used local sample data. No commit, push, remote migration or deployment has occurred.
