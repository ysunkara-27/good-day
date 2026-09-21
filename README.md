# task pup planner

A static daily planner with a customizable inline SVG puppy, hosted by the `good-day` Vercel project at https://www.taskpup.lol. `npm run build` copies only frontend assets to `dist`; server code, tests and schema are not published. The API uses the existing Cloudflare Worker and D1 database with isolated `dog_*` tables.

Tasks are stored per account and local calendar date. Tasks without a chosen time retain their relative order and fill available gaps from the day’s start. Optional `scheduledStart` is a local minute-of-day (0–1439); fixed tasks retain that time and the final schedule is displayed chronologically. Explicit overlaps are flagged, never silently rescheduled. Existing tasks without this field stay automatic; no schema migration is needed for task times. Completed tasks keep their slot; the next incomplete task is marked. Date selection opens past or future plans. Overnight blocks show a day offset. A local midnight rolls today's view forward; yesterday remains in the date picker. Unfinished tasks carry into today by default at local midnight or when the planner is next opened. Account can disable carryover. Completed tasks stay on their original date; carried tasks lose their old fixed start time and are scheduled around today’s calendar. Transfer is atomic and revision-checked, with a 100-task destination limit; overflow stays on its original dates. There is no background cron or recurring-task creation.

One timer can run independently (default 25 minutes) or for a selected task (its full estimated duration). The user can change the timer duration before starting or while paused. A task’s Start button starts its timer in one click. Start/pause/reset use a wall-clock deadline, so background throttling does not slow the countdown. Selecting another task, changing days, logging out, or reloading resets the timer; it never marks tasks complete automatically. Progress is completed task count, not minutes. The 56px puppy explores safe page space, checks complete routes for content collisions, pauses during editing and focus, and respects reduced motion. If no clear space exists, the header dog menu remains available. Today's saved task completions unlock a meal, a walk with fetch, and bedtime. Care is used once per day; task memories and learned tricks persist. There are no currencies, care meters, or punishments.

Task entry accepts one task or one task per line. Enter submits; Shift+Enter adds a line. Duration presets and a custom number apply to the submitted tasks; grouping and a fixed start time are optional and collapsed by default. With a fixed time, a pasted batch is placed consecutively from that time; a batch whose next task would start tomorrow is rejected with guidance to use that date. Click a displayed task time to edit it, or clear it to restore automatic placement.

Signup includes a dog name, four coats, and three collars. Existing accounts default to Biscuit and can customize from the dog menu. Appearance and the wandering preference persist in `dog_profiles`, independently of daily plans. Rerun the idempotent schema when upgrading to add this table.

## Hosting and account continuity

The authenticated API remains `https://hooraas-rides-api.sunkarayashaswi.workers.dev/dog/`. Production Worker ownership is still in `reyash/rides/api`, which imports `reyash/dog/api.mjs`. Editing the backend copies in this frontend repository alone does **not** deploy the shared Worker. Keep backend changes synchronized with that source and deploy using its explicit config. Do not replace the shared Worker with a dog-only entrypoint: it also serves rides.

Both Taskpup origins are allowlisted. Porkbun manages DNS; Vercel serves HTTPS; Cloudflare runs the API and D1. The old `/dog` pages redirect to Taskpup. Existing usernames, passwords, plans, colors, care and Google connections remain in the same D1 database. Visitors must sign in once on the new origin because browser sessions cannot transfer across domains. Do not rotate `SESSION_SECRET` or create a fresh database during this migration.

## Local preview

```sh
# From the sibling reyash checkout (shared backend):
npx wrangler@4.128.0 d1 execute hooraas-rides --config rides/api/wrangler.jsonc --local --persist-to /private/tmp/taskpup-migration-d1 --file dog/schema.sql
npx wrangler@4.128.0 dev --config rides/api/wrangler.jsonc --port 8791 --persist-to /private/tmp/taskpup-migration-d1 --var ALLOWED_ORIGIN:http://127.0.0.1:8097
```

From the repository root, in another terminal:

```sh
npm ci
python3 -m http.server 8097 --bind 127.0.0.1
```

Open http://127.0.0.1:8097/. Create a disposable account. This uses a separate local database and does not touch production.

## Checks

```sh
npm test
npm run test:api
npm run test:browser
npm run build
```

Integration tests target the isolated local ports above. Browser checks use this repository's Playwright dependency and installed Chrome. Tests create disposable local accounts. Authentication is rate limited to 20 attempts per IP per 15 minutes, so repeated runs can hit that limit. `RUN_LIVE_TASKPUP=1 node tests/live-migration.mjs` explicitly tests production and creates a disposable account; its username is recorded in `/private/tmp/taskpup-smoke-account.json` for cleanup. Google provider exchanges are mocked locally; a real Google consent/verification check requires an authorized Google account.

## Production release

For backend changes, synchronize the shared backend source and run from the `reyash` checkout. Apply additive schema changes before deploying:

```sh
npx wrangler@4.128.0 d1 execute hooraas-rides --config rides/api/wrangler.jsonc --remote --file dog/schema.sql
npx wrangler@4.128.0 deploy --config rides/api/wrangler.jsonc
```

Then deploy this repository as its own Vercel project. The production domain is `https://taskpup.lol/`; add it to the Vercel project and to the Worker `ALLOWED_ORIGIN` variable. The optional Google connection needs its Client ID and Client secret; see [Google Calendar setup](GOOGLE-CALENDAR-SETUP.md).

Accounts use lowercase usernames, random salts, and PBKDF2-SHA256 (100,000 iterations, the existing Workers-compatible hashing pattern). Passwords are never returned or stored in plaintext. Random 256-bit bearer sessions last 30 days, are stored hashed in D1, and are revoked on logout. The client keeps the bearer token in localStorage on the existing site origin. All same-origin scripts share this trust boundary. There is no email, password recovery, or account management in v1; the sign-in screen explains this. Auth endpoints rate-limit by IP. Every plan read/write derives its owner from the session. Writes use revision checks; failed saves leave the form intact, and conflicts offer a reload.

`model.mjs` is the pure validation and scheduling boundary. A future calendar adapter can translate external busy intervals into this model without coupling calendar APIs to the UI. A read-only Google Calendar connector now supplies busy intervals and display events. See [Google Calendar setup](GOOGLE-CALENDAR-SETUP.md) for the required Google client, Cloudflare secrets, migration, and release steps. Until configured, Account accurately reports that setup is unfinished.

### Earned care and companion behavior

The current dog has daily food, exercise, and comfort needs. Completing the first task, half the plan, and the full plan unlocks those actions. Care and task memories persist in `dog_care_days` / `dog_care_receipts`; apply the additive `schema.sql` migration before deploying this version. Tricks are earned at 3/8/15 unique task-day completions. Timers and Google events never earn care. Existing accounts need no profile migration.

Research, design tradeoffs, and the unrun human usability protocol: [RESEARCH-AND-UX.md](RESEARCH-AND-UX.md).

Care tests are included in `npm test` and `npm run test:browser`.

## Desktop workspace

The signed-in planner fits the viewport, with long schedules scrolling in a keyboard-focusable region. At sizes of at least 1100 × 740 CSS pixels, it uses three columns: task entry, the daily schedule, and the timer/dog. Smaller windows open task entry in an Add task dialog and keep dog controls in the header menu. Phones also open the timer in a dialog. Existing form and timer elements move between panels and dialogs, preserving drafts and timer state. Extra dog controls can scroll within the sidebar. `workspace.css` and `workspace.mjs` scope this behavior to the planner; legal pages keep their reading layout.

The connected calendar data flow and UI state model are documented in [Calendar architecture](CALENDAR-ARCHITECTURE.md).

Carryover adds `dog_settings` and a transient `dog_rollover_moves` table. Apply `schema.sql` before deploying the updated Worker. Tests: `node --test dog/tests/rollover.test.mjs` and `node dog/tests/rollover-api.mjs`. Calendar setup is shown in Account and optional post-signup onboarding; only an active connection appears in the agenda. Direct iCloud calendars are not supported.

Task group colors are account-wide, case-insensitive assignments. Add/edit a task, enter its group, then choose Group color (Automatic or one of six themed colors). Changes immediately apply across days, including carried tasks. `dog_group_colors` is additive in `schema.sql`; apply the schema before deploying this API update.

Startup uses root-relative asset URLs and an inline, styled loading/recovery screen. The planner is revealed only after its stylesheets and modules load. Failed or stalled loads show a retry link after at most 12 seconds; disabled JavaScript gets an explicit message. API load failures show a retry card and recover when connectivity returns. Retry preserves browser storage. These paths are included in the loading and recovery browser tests.

## Companion club and request log

The dog menu opens a dedicated club with meal selection, keyboard/touch ball play, pats, and earned tricks. Each unique saved task-day completion earns 10 XP; ten completions add a level. One completion a day builds a streak, with yesterday kept alive until today ends. Best streak permanently unlocks Mochi the cat (3 days), Pepper (7), Cocoa (14), and Luna the cat (30). Selecting a companion persists its appearance in the existing profile; other earned companions remain in the collection. A missed day never removes companions. Profile species is optional, so existing dogs need no migration.

Only the authenticated username `yash` receives the playground capability. Its toggle previews all companions, meals, and tricks without writing completions, care, or stats. Normal care still uses the existing server-side earning rules even for Yash. Original encouragement rotates on each hour boundary and refreshes on returning to the page; no push notifications or external quote service.

Ideas & requests opens a compact public log backed by the shared Worker's `/requests?site=dog` endpoint. Rides uses `site=rides`; logs are separate, latest 50 entries, 5–400 characters, and at most five submissions per IP hash per hour. Tables and indexes are created idempotently on first use. No new secrets or schema migration are required. `feature-log.mjs` is copied to rides so both frontend deployments remain self-contained.

Tests: `npm test` in this repository; shared rides tests remain in the portfolio repository. The fixture-only desktop/mobile browser suite is `node scripts/test-playful-sites.mjs` from the portfolio root with a static server on port 8106. It mocks every API request and does not write real plans, rides, or scores.

## Optional browser companion

`companion-bridge.mjs` publishes a display-only snapshot for the personal Task Pup Chrome extension: pet appearance/name, care flags, signed-in state, and a focus boolean. No session token, username, task text, calendar data, or care memories are exported. The bridge answers a DOM handshake and only broadcasts when the display state changes. It requires no backend changes. The extension lives in the portfolio repository's `taskpup-extension/` directory and is installed with Chrome's Load unpacked workflow.
