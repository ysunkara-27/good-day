# Connect Google Calendar to Good day

The implemented flow is **Account → Connect Google Calendar → allow read-only access → return to /dog**. It reads the user's **primary** Google calendar. It never creates, changes, deletes, or checks off Google events. No Google password is entered into this site.

## 1. Create the Google project and client

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project, e.g. **Good day**.
2. In **APIs & Services → Library**, enable **Google Calendar API**.
3. Open **Google Auth Platform**. Complete **Branding** with an app name, your support email, and developer contact email.
   Use these public URLs in Branding after publishing the static site:

   - **Application home page:** your new Good day Vercel domain
   - **Privacy policy:** `<new-domain>/privacy/`
   - **Terms of service:** `<new-domain>/terms/`
   - **Authorized domain:** your new domain

   Both legal pages work without login or JavaScript and are linked from the planner. Their contact address is the site's published `bgn2bs@virginia.edu`; keep it and the consent-screen support contact current. Verify ownership of the domain as required by Google. Confirm all three URLs load publicly after deployment before submitting for verification.

4. Under **Audience**, choose **External** for personal Google accounts. Keep it in **Testing** initially and add your own Google email under **Test users**.
5. Under **Data Access**, add only this scope:

   ```text
   https://www.googleapis.com/auth/calendar.events.readonly
   ```

6. Under **Clients → Create client**, choose **Web application**. Add this exact **Authorized redirect URI**:

   ```text
   https://hooraas-rides-api.sunkarayashaswi.workers.dev/dog/google/callback
   ```

   The callback belongs to the existing Cloudflare Worker, not the static `/dog` page. No JavaScript origin is required for this server-side flow. The Worker returns users to the allowed site origin where they started.

7. Save the **Client ID** and **Client secret** securely. The secret may only be displayed once. Do not put either credential into frontend JavaScript, a committed file, or chat.

For an app available beyond your test users, complete Google's production consent/verification requirements for the read-only calendar scope (including the requested homepage/privacy-policy/domain information). Testing-mode connections may need reauthorization; they are not the final public-launch configuration.

## 2. Put the credentials in Cloudflare

From the repository's `rides/api` directory:

```sh
npx wrangler@4.128.0 secret put GOOGLE_CLIENT_ID
npx wrangler@4.128.0 secret put GOOGLE_CLIENT_SECRET
```

Each command prompts for its value. Paste the corresponding Google value at that prompt, not into a shell command argument.

The existing Worker `SESSION_SECRET` is also required and is reused to encrypt Google tokens with an application-specific key. It is already part of the rides deployment. Do not replace it as part of this setup. If provisioning a completely new Worker, configure a strong random `SESSION_SECRET` before using either app.

**Do not store credentials anywhere in this repository's static publish tree**, including `.dev.vars` files under `rides/`. The site's deployment copies that directory.

## 3. Release the prepared code

From `rides/api`, apply the additive tables and deploy:

```sh
npx wrangler@4.128.0 d1 execute hooraas-rides --remote --file=../../dog/schema.sql
npx wrangler@4.128.0 deploy
```

Publish the static site through its normal deployment process. Existing allowed origins already include `https://ysunkara.com` and `https://www.ysunkara.com`.

Then visit `/dog`, log in, open **Account**, and click **Connect Google Calendar**. Choose the Google test-user account, approve read-only access, and return to the planner. The consent screen can show a testing/unverified notice until the public app is approved.

For code ownership, state transitions, scheduling rules, and data flow, see [Calendar architecture](CALENDAR-ARCHITECTURE.md).

## What users see

- The agenda shows connection status, event count, last refresh time, and local time zone. All / Tasks / Calendar filters change display without changing busy-time scheduling.
- Timed events appear as blue-gray blocks among tasks, with a link to Google when available.
- All-day events appear above the timeline and do not reserve the whole day.
- Automatic tasks avoid busy timed events. Free events remain visible without reserving time.
- Explicit task times stay fixed and show an overlap label when needed.
- Calendar events do not count toward task progress or dog rewards.
- Account has Refresh and Disconnect. Events refresh every five minutes while the page is visible, and when returning after a minute away.
- Refresh failures retain the last successful events with a visible stale-data message; revoked access prompts reconnection.
- Only the primary calendar is included in this version. Shared/secondary calendars are not imported.

## Data and security

Tokens stay on the Worker, encrypted with AES-GCM and bound to the planner account; browser responses never contain Google access/refresh tokens. Short-lived state and PKCE bind authorization to the initiating planner session. The callback carries only a temporary code/state in the URL fragment, which the app removes before finishing authorization in an authenticated POST. Disconnect removes local credentials and pending authorization state and attempts to revoke the Google grant.

Event titles are not stored in D1. The app holds the displayed day in browser memory. Google instances are expanded server-side, paginated, and filtered for cancelled/declined events. Times display in the browser's local time zone. The code requests read-only scope and contains no Google event-write API calls.

## Verification

No Google credentials are needed for the automated checks:

```sh
node --test dog/tests/model.test.mjs dog/tests/google-calendar.test.mjs
node dog/tests/calendar-browser.mjs
```

The provider tests use an in-memory SQL database and fake Google responses. Browser tests use disposable accounts in the isolated local Worker on 8791 and static server on 8095, with Google routes mocked. A real consent round-trip must still be tested after credentials are configured.

Reference: [Google's server-side OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server), [read-only scopes](https://developers.google.com/workspace/calendar/api/auth), [listing calendar events](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
