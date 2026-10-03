# JAYANANDA — My Sādhana Journey

A private devotional journal for hearing, chanting, reading and service. **Consistency · Humility · Service.**

Live: [jayananda.aneeshm059.workers.dev](https://jayananda.aneeshm059.workers.dev). The journal requires sign-in; public source code does not expose journal data.

## Three-pillar companion

The companion has a chanting-first home, a saved Japa session, sequential reading linked to **PrabhupadaBooks.com**, and an embedded YouTube learning space. The local demo and production release were approved by the owner on 28 September 2026, with English-only lecture selections.

- **Chant:** quiet mālā-themed session with ± rounds, optional timer, persisted unfinished session and a saved personal instruction from a lesson. Finishing is idempotent.
- **Soulful Japa reading:** 106 numbered modules and 22 supplementary readings extracted faithfully from the supplied PDF, with all 195 original figures. Open **Chant → Read modules** for the searchable library, comfortable Literata typography, adjustable text size, module bookmarks and completion ticks. Written progress is private, exportable and separate from video lessons. See [source fidelity](docs/SOULFUL-JAPA-SOURCE.md) and [storage/import instructions](docs/SOULFUL-READING.md).
- **Read:** online Bhagavad-gītā As It Is at PrabhupadaBooks.com. Beginning a session saves its book, starting verse and local date. Enter the ending chapter/verse to save a journal report and advance the next-verse bookmark together. Time and notes are optional. Chapter boundaries and grouped source pages follow that site's edition; the final verse completes the reading without silently restarting. Existing bookmarks and journal entries remain available.
- **Hear / Learn:** 100 unique Soulful Japa videos, 21 Happiness & Pleasure sessions, and a verified English lecture from The Acharya. Independent per-course bookmarks, in-app playback, 30-minute Soulful Japa goal, explicit completion/next lesson and source-linked personal instructions. The curated Prabhupāda selection is English-only. See [catalog provenance](docs/LEARNING-SOURCES.md).
- Save playback checkpoints every ten seconds and on pause/visibility changes. Hidden playback pauses. Watched minutes exclude paused/buffered time and large seeks; exact attention cannot be measured. Watching in the external YouTube app requires a manual bookmark. No offline video downloads.
- Gentle rhythm cues appear **inside the app** after chosen times; these are not push notifications. Today's report separately displays actual in-app course viewing and manually entered hearing.
- Authenticated companion data lives in an additive `companion_entries` table with optimistic version checks. Conflicting saves pause and require reload/review. JSON exports include this data. No automatic AI requests or generated spiritual advice are enabled.
- Every original flow remains accessible under **My journal**, **Reflect & grow**, **My journey**, or the phone **More** menu.

Local review: apply `npm run db:local`, seed disposable fixtures if needed, build, and run the built Worker locally with the commands below. Sample accounts contain no production journal data. Apply remote migrations and deploy only for an approved release.

## Version 1

- Compact Today space with Practice/Habits/Reflect tabs, a practice card switcher, daily sankalpa, configurable morning program and wake discipline.
- Japa beads, −1/+1/+4 logging, full sessions, attention reflections and a distraction-free timer.
- Today Report with automatic date, saved details, daily target progress and pending habit check-ins.
- Hearing, daytime reading, separate Krishna Book night reading/timer, seva and association.
- Gentle night-reading check, night reflection and “Offer today to Krishna.”
- Ideal/Minimum Day targets and configurable Sādhana Health weights, without spiritual judgments or competition.
- History calendar and editing; weekly/monthly reviews, charts with accessible tables and sankalpa history.
- Jayananda quality prompts, Śrīla Prabhupāda association, personal purpose, goals and reminder cues.
- Onboarding, timezone/theme/hero settings, JSON/CSV export and password changes.
- Responsive sidebar/mobile navigation, light/dark themes, reduced-motion support and useful empty states.
- Custom habit commitments with daily toggles, optional Extra notes, yearly calendars and dashboard reports.
- Warm sage/pastel styling, grouped navigation, expandable secondary details, saved-effort feedback and a seven-day practice garden. Purpose reminders and weekly encouragement remain available in labelled sections.

**“This reflects consistency of practice, not spiritual advancement.”**

## A calmer daily companion

Today shows one practice at a time. Choose a practice chip or use Previous/Next; switch to Habits for check-ins or Reflect for sankalpa and your evening reflection. Begin a moment jumps straight to the practice controls. Purpose and quality reflections sit under Reflect; Sādhana Health, seven-day totals and reminders expand under Your journey, a little deeper. All existing pages remain in the grouped sidebar or phone More menu. Practice statistics, reviews and inspiration histories use expandable sections without removing entries or actions.

The garden shows one flower for each of the last seven days with meaningful recorded practice or a followed habit. It celebrates showing up, without requiring a perfect day. Correcting the only Japa round to zero removes that day's flower unless another practice is recorded. Flowers are derived from journal data, with no new database tables or stored reward balance. Reduced-motion preferences disable the decorative transitions.

## Today Report and Japa corrections

Open **Today Report** in the sidebar, the dashboard shortcut, or **Report** in the phone navigation. It always uses today in your configured timezone. The report shows Japa rounds, wake-up time, progress against the active Ideal/Minimum Day targets, and active habits still unmarked. Expand recorded entries to see all saved fields and notes, including individual morning practices. Optional practices are not counted as pending; a recorded late wake-up time is still shown as recorded.

Use **−1 round** on Today or Japa to correct the most recent positive session for that date. The count stops at zero and keeps the session’s notes, duration and times. Concurrent requests and retries cannot apply the same correction twice. In focus mode, the minus button corrects only the current unsaved session.

## Daily habits

Habit Tracker starts with Brahmacharya, Soulful Japa and Away from Social Media, each with a one-year commitment beginning on your first visit after this update. Create or edit a habit with its name, start date, end date and what you intend to follow. Archive and restore habits without losing their records.

Daily check-ins have no date picker. The server captures the current date in your configured timezone (Asia/Kolkata by default); an overnight page refreshes to the new day. Mark the toggle only when you followed the habit. Extra notes are optional and save independently, so unticking keeps your notes. History is read-only. Today is reported separately from consistency totals, which cover elapsed past days; unmarked days remain “Not marked.” Habits do not change Sādhana Health scores.

## Install on your phone

Open [Jayananda](https://jayananda.aneeshm059.workers.dev) in your phone's browser:

- **Android / Chrome:** menu → Install and create shortcut → Install (older versions may show Add to Home screen or Install app).
- **iPhone / Safari:** Share → Add to Home Screen → enable Open as Web App if shown → Add.

Launch the Jayananda icon from your home screen for a standalone app window. Sign in normally. An internet connection is required for journal data and saves; the offline screen offers a retry when disconnected. No private pages, entries, API responses or credentials are stored by the service worker. Browser installation labels and support can vary; see [Chrome's instructions](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en) and [Apple's instructions](https://support.apple.com/guide/iphone/iphea86e5236/ios).

The manifest, service worker and icons are in `public/`; the root layout registers the worker on production builds. Regenerate icons from the existing flower mark with `node scripts/generate-pwa-icons.mjs`. Increment the public offline cache version when changing its content. A new worker activates after older app windows close, without interrupting unsaved forms.

## Stack

TypeScript, React, Next.js-compatible App Router through vinext, Tailwind CSS and custom accessible components, Better Auth, Drizzle, Workers and D1. The [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) recommends vinext for new projects; this project's features pass its compatibility check. vinext remains beta, so versions are pinned. See [architecture and schema](docs/ARCHITECTURE.md), [assets](docs/ASSETS.md) and [verification](docs/VERIFICATION.md).

## Local development

Prerequisites: Node.js 22+, npm. A Cloudflare account is needed only for remote resources. `.nvmrc` selects Node 22.

```sh
npm ci
npm run setup:local
npm run db:local
npm run dev -- --port 3000
```

Open `http://localhost:3000`. The setup script generates secrets without printing them and writes account instructions to ignored `.local/LOCAL-SETUP.md`. Use the first-visit link on the login page. Existing `.dev.vars` is preserved.

For disposable sample data instead:

```sh
npm run seed
npm run seed:clear
```

Seeding creates 14 realistic days for `demo@example.test` plus a separate user for isolation tests. The local fixture password is `Local-Journal-Only-2026!`, never a production credential. Scripts use local D1 only and reject remote/production flags. Clearing removes only fixture users and their cascading records. Production deployment never seeds data.

## Configuration

| Name                 | Purpose                                 | Location                         |
| -------------------- | --------------------------------------- | -------------------------------- |
| `DB`                 | D1 binding                              | `wrangler.jsonc`                 |
| `BETTER_AUTH_URL`    | Exact origin, no path                   | Wrangler var / local `.dev.vars` |
| `BETTER_AUTH_SECRET` | Random authentication secret, 32+ bytes | Worker secret / `.dev.vars`      |
| `OWNER_EMAIL`        | Only email allowed for first account    | Worker secret / `.dev.vars`      |
| `SIGNUP_INVITE`      | Random invitation, over 20 characters   | Worker secret / `.dev.vars`      |

Use a cryptographically secure generator. Never put secrets in tracked files or command arguments. `.dev.vars`, `.env*`, `.local/`, build output and Wrangler state are ignored. Keep the auth secret stable across deployments. Invitations work only while the users table is empty. The owner creates their own password; there is no production demo password.

## Cloudflare and migrations

The configuration points to this project's existing account/database. For a separate installation, change account ID, database IDs/name, Worker name and auth URL first.

```sh
npx wrangler login
npx wrangler whoami
# Only for a new installation:
npm run db:create
# Copy the returned database_id into wrangler.jsonc.
npm run types

# After editing lib/db/schema.ts:
npm run db:generate
npm run db:local
# Review SQL and back up before production changes:
npm run db:remote
```

`db:local` uses `.wrangler/state`; `db:remote` explicitly targets production. The initial migration creates 25 tables and their indexes; the habit migration adds two tables. Generate new migrations rather than editing applied ones.

## Build, test and deploy

```sh
npm run typecheck
npm test
npm run check
npm run build
# Serve the actual built Worker with local D1:
npm start -- --port 3000 --persist-to .wrangler/state --env-file .dev.vars
# In another terminal, after local seeding:
npm run test:integration
npm run test:habits
npm run test:japa
npm run test:companion
npm run test:reading

# Optional first-account test, ONLY on disposable local data:
npm run seed:clear
npm run test:bootstrap
npm run seed

npx wrangler deploy --config dist/server/wrangler.json --dry-run
npx wrangler check startup --config dist/server/wrangler.json
npm run db:remote
npm run deploy
```

First deployment can upload secrets atomically with the Worker:

```sh
npm run deploy -- --secrets-file .local/production-secrets.json
```

That ignored JSON file must contain `BETTER_AUTH_SECRET`, `OWNER_EMAIL` and `SIGNUP_INVITE`. Wrangler also supports interactive `wrangler secret put NAME` and `wrangler secret bulk FILE` for changes. Deploy the generated `dist/server/wrangler.json`, which contains the built modules/assets configuration.

For a custom domain, add a Workers Custom Domain for an existing Cloudflare-managed zone, change `BETTER_AUTH_URL` to its HTTPS origin, rebuild and redeploy. A custom domain is optional; workers.dev is sufficient.

## Backups and recovery

In-app JSON exports include user settings, practice records, habit definitions and habit check-ins. CSV is per practice, with a separate Habits export. Keep regular exports somewhere private; import is not implemented yet. D1 [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) provides recovery within the plan's retention window; check the dashboard before relying on it.

```sh
npx wrangler d1 export DB --remote --output .local/jayananda-backup.sql
npx wrangler d1 time-travel info DB
```

Store backups privately and encrypt any off-device copy. For recovery, stop writes, export the current state, choose a known-good bookmark/timestamp in the D1 dashboard or `wrangler d1 time-travel restore`, then verify sign-in/history. Restoration replaces database state and needs deliberate operator action. `wrangler rollback` restores code, not database migrations; check schema compatibility separately.

## Troubleshooting

- **Node errors:** use Node 22+, then `npm ci`.
- **Missing tables:** migrate the correct local/remote DB; use the same `.wrangler/state` path for the built Worker.
- **Sign-in/origin errors:** auth URL must match the browser origin and secrets must exist. Local testing consistently uses `http://localhost:3000`.
- **Invitation rejected:** check the owner email/code. Registration intentionally closes after any user exists; local seeds also close it.
- **Expired session:** sign in again; saved D1 records remain. Japa resumes from its last saved checkpoint. Reading finish drafts can recover in the same browser tab; other unsaved forms must be submitted before leaving.
- **Network failure:** retry the same form; session requests carry idempotency keys. If a save succeeded but refresh failed, the app explicitly says it was saved.
- **Lost password:** Settings changes a known password, but email recovery is not configured. An operator must add Better Auth's verified recovery flow; do not delete the user to reset a password, since that deletes journal records.
- **Remote errors:** check `wrangler whoami`, account/binding and `wrangler tail`. Do not log reflection content or credentials.

## Limits and Version 2

Internet is required. Japa and video playback resume from saved checkpoints; the Krishna Book timer saves on Finish. Reading happens on PrabhupadaBooks.com, and the ending verse is entered when finishing in Jayananda. Reminders are in-app cues without push/email delivery. Historical summaries use current targets/weights. Full exports are intended for a personal-sized journal. There is no email password reset, data import, account deletion UI or additional-user invitation UI. vinext is beta; upgrades require compatibility, Worker and browser checks.

Suggested next steps: broader offline drafts, verified password recovery, import/restore, historical target snapshots, optional push reminders, more sequential books, a sourced quote/story library, Ekādaśī/festival calendar and a yearly PDF journal. Keep them optional and preserve a quiet practice-first experience.
