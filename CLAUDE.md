# CMO Training — rules & map (read this first)

Mobile-first installable web app (PWA) for CMO Training, a basketball skills trainer. Three pages (coach, athlete, dev),
a demo mode with no backend, and a free Supabase backend that switches on with two repository variables.

**History:** `HISTORY.md`, newest first. **Business side:** the vault's `projects/cmo-training/context.md`.
**Live:** https://mbottega16.github.io/cmo-training/ (GitHub Pages; a push to master deploys after tests pass).

## What this is
- **What:** Coach + athlete app: court check-ins (Floor Mode), film breakdown with drawings and voice memos, two-way
  video calls, booking, a late-cancel policy with a grace window and refill refunds, and a coach admin (Manage).
- **For:** The coach behind CMO Training (the owner's stepbrother) and their high school, college and pro athletes.
- **Platform / stack:** React 19, TypeScript 7, Vite 8 (multi-page), Tailwind 3, Lucide. Supabase free plan. GitHub Pages.
- **Money:** Payments outside the app for now; the coach adds credits on Manage. Stripe later needs the owner's yes.
- **What "done" looks like:** The coach runs real sessions from the coach page, athletes book and get film on theirs.

## Settled decisions (don't re-argue)
- Installable web app, not an App Store app. Free hosting (GitHub Pages) and a free backend (Supabase free plan).
- Separate pages: `/coach/`, `/athlete/`, `/dev/` (owner: view toggle + Dev tools). Landing `/` links coach and athlete.
- Rules are tunable settings (`Settings` in `types.ts`, `settings` table): late-cancel hours (6), grace hours (24),
  `lateSpot` 'refill' (default) or 'lock', check-in XP (50), check-in opens 30 min before / closes 12 h after.
- A credit is used at **booking**. Check-in only gives XP. Exactly 6 hours counts as on time.
- **Refill rule:** a late-cancelled spot reopens. Newcomers fill empty spots first; only when
  `confirmed > maxCapacity − lateCancels` was a late spot needed, and then held late cancellers (pending or forfeited,
  oldest first, before the session starts) are refunded one per needed spot with `decisionReason: 'refilled'`.
  Coach-waived late cancels count as already refunded. 'lock' keeps late spots held instead.
- Every money/time/role rule exists twice and must match: `src/logic.ts` (demo) and `supabase/schema.sql` (server,
  server clock). Change both, and the tests for both.
- No e-mails needed: sign-in is e-mail + password with confirmation off; access comes from 8-character invite codes.
- The public repo holds **mock data only**. No real athlete names, phones, emails or film, ever.

## How it's built
- `index.html`, `coach/index.html`, `athlete/index.html`, `dev/index.html` → `src/entries/*.tsx` → `src/apps/boot.tsx`
  (frame guard, error boundary, backend choice, clock sync, service worker) → `src/apps/pages.tsx` (CoachPage,
  AthletePage, DevPage, Landing) → `src/apps/screens.tsx` (coach and athlete screens, reused by the dev page).
- Routing is the hash: coach `#/<tab>/<athleteId?>`, athlete `#/<tab>/<athleteId?>`, dev `#/coach/…`, `#/athlete/…`,
  `#/tools`. `src/router.ts` (`useHashParts`, `pageUrl` for sibling pages under any base path).
- `src/logic.ts` — every rule; `applyCommand(state, Command, now)` is the one way state changes.
- `src/backend/` — `types.ts` (Backend, AuthApi), `local.ts` (demo: localStorage + Web Locks + IndexedDB +
  BroadcastChannel), `supabase.ts` (RPCs, tables, storage, realtime, private call channels), `mapping.ts` (rows ↔
  state), `index.ts` (picks Supabase when `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set, unless the dev page
  forced demo in this browser; supabase-js is lazy-loaded).
- `src/store.ts` — `useAppStore(backend)`: `state`, `dispatch(cmd, {quiet})`, page-wide `problem`.
- `src/clock.ts` — `now()` = device time + server offset (from the page's `Date` header) + dev-page time travel.
- `src/rtc.ts` — 1-on-1 WebRTC call; signalling via `backend.signal(room)`; room = athlete id; Google STUN, no TURN.
- `supabase/schema.sql` — tables, RLS, rule functions (`book_session`, `cancel_booking`, `waive_late_cancel`, …),
  invites, storage policies (`films|memos/<athlete id>/…`), realtime call-channel policies, pg_cron grace expiry.
- `src/components/` — screens plus `CoachManage`, `DevTools`, `AuthGate`, `Shell`, `Navigation` (Header, TabBar), `ui`.
- `public/` — `coach.webmanifest`, `athlete.webmanifest`, `sw.js` (precache list + cache name injected at build),
  icons, `samples/pick-and-roll.mp4`.
- `.github/workflows/pages.yml` (test → build → deploy), `keep-backend-awake.yml` (pings Supabase every 3 days).

## Commands & Verification
- `npm run dev` — 127.0.0.1:5173 or the next free port (other projects on the Mac use 5173). `npm run phone` serves
  the built app to Wi-Fi.
- `npm test` — 19 rule tests (`tests/logic.test.ts`) + 17 database tests (`tests/sql.test.ts`, real Postgres via
  PGlite with stand-ins for Supabase's auth/storage/realtime). Node 23.6+.
- `npm run build` — `tsc` + Vite. Must pass with zero errors.
- Browser checks (not committed; recipe in the vault's `skills/web-bible`): real Chrome (`channel: 'chrome'`) at
  390×844, 1366×768, 1920×1080 with fake camera/mic, WebKit for Safari, axe-core for WCAG 2.2 AA, attack pass.
- Never verified against a real Supabase project until the owner creates one (see SETUP-BACKEND.md); the SQL is tested
  on PGlite and the JS adapter is type-checked only.

## Never Read / Noise Zones (Do Not Scan)
- `node_modules/`, `dist/`, `.git/`, `public/samples/*.mp4`, `public/icons/*.png`.

## Rules & Gotchas
- UI follows the vault's `web-bible` skill (Vercel Web Interface Guidelines + house rules).
- White text only on `brand-action` / `brand-success` / `brand-info`. `brand-orange` fails behind white text.
- Sample clip URLs are site-root relative: resolve with `pageUrl('')`, never relative to the page.
- The service worker matches cached files with `ignoreVary` (servers send `Vary: Origin`; module scripts carry Origin).
- Media keys must be `films/<athleteId>/…` or `memos/<athleteId>/…` (storage RLS reads the second folder).
- CSP is `'self'` plus the Supabase origin when configured. `assetsInlineLimit: 0` keeps fonts out of `data:` URLs.
- Demo data is per browser and editable by its owner; real trust needs the backend. Coach/dev pages are open in demo.

## Session Handoff (Last Worked On · Current State · Next Up)
- **Last Worked On (2026-11-03):** v0.4. Split into coach/athlete/dev pages + landing; Dev tools (rules, time travel,
  athlete edits, demo export/import/reset, people & roles); coach Manage tab; free Supabase backend (schema + RLS +
  server-side rules + invites + storage + realtime + cron) behind a Backend interface; real two-way WebRTC calls;
  late-cancel fix (refill refunds, trusted clock, staff-only waive); GitHub Pages deploy + keep-awake; MIT licence.
- **Current State:** 36/36 unit+SQL tests; Chrome 49/49 browser checks, 0 console errors; WebKit 11/11; axe 0
  violations on 22 screen/size combinations. Pages deploys in demo mode until the Supabase variables exist.
- **Next Up:** Owner creates the free Supabase project (SETUP-BACKEND.md), then verify the live backend end to end
  (sign-up, invites, booking on two phones, a call across two networks). Then: reminders (web push), Stripe (needs a yes).
