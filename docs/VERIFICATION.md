# Release verification — 25 September 2026

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
