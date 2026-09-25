# JAYANANDA — My Sādhana Journey

A private devotional journal for hearing, chanting, reading and service. **Consistency · Humility · Service.**

Live: [jayananda.aneeshm059.workers.dev](https://jayananda.aneeshm059.workers.dev). The journal requires sign-in; public source code does not expose journal data.

## Version 1

- Time-aware cinematic Today page, daily sankalpa, configurable morning program and wake discipline.
- Japa beads, +1/+4 logging, full sessions, attention reflections and a distraction-free timer.
- Hearing, daytime reading, separate Krishna Book night reading/timer, seva and association.
- Gentle night-reading check, night reflection and “Offer today to Krishna.”
- Ideal/Minimum Day targets and configurable Sādhana Health weights, without spiritual judgments or competition.
- History calendar and editing; weekly/monthly reviews, charts with accessible tables and sankalpa history.
- Jayananda quality prompts, Śrīla Prabhupāda association, personal purpose, goals and reminder cues.
- Onboarding, timezone/theme/hero settings, JSON/CSV export and password changes.
- Responsive sidebar/mobile navigation, light/dark themes, reduced-motion support and useful empty states.
- Custom habit commitments with daily toggles, optional Extra notes, yearly calendars and dashboard reports.
- More readable controls, a visible daily purpose reminder, a suggested next practice and gentle weekly encouragement.

**“This reflects consistency of practice, not spiritual advancement.”**

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
- **Expired session:** sign in again; saved D1 records remain. Unsaved forms/timers do not survive a full reload.
- **Network failure:** retry the same form; session requests carry idempotency keys. If a save succeeded but refresh failed, the app explicitly says it was saved.
- **Lost password:** Settings changes a known password, but email recovery is not configured. An operator must add Better Auth's verified recovery flow; do not delete the user to reset a password, since that deletes journal records.
- **Remote errors:** check `wrangler whoami`, account/binding and `wrangler tail`. Do not log reflection content or credentials.

## Limits and Version 2

Internet is required. Timers save only after Finish; reloading loses an unfinished session. Reminders are in-app cues without push/email delivery. Historical summaries use current targets/weights. Full exports are intended for a personal-sized journal. There is no email password reset, data import, account deletion UI or additional-user invitation UI. vinext is beta; upgrades require compatibility, Worker and browser checks.

Suggested next steps: offline drafts, verified password recovery, import/restore, historical target snapshots, optional push reminders, book progress, a sourced quote/story library, Ekādaśī/festival calendar and a yearly PDF journal. Keep them optional and preserve a quiet practice-first experience.
