# CMO Training — Session History

## 2026-11-03 — v0.4: three pages, free backend, free hosting, late-cancel fix

- Split into `/coach/`, `/athlete/` and `/dev/` (+ landing). The dev page toggles Coach / Athlete views and has Dev tools: tunable rules (late-cancel hours, grace hours, refill vs lock, XP, check-in window), time travel, athlete edits, demo export/import/reset, people & roles. Coach got a Manage tab (athletes, credits, invites, schedule).
- Free backend on Supabase: `supabase/schema.sql` (tables, row-level security, server-side rule functions on the server clock, invite codes, storage policies, private call channels, pg_cron grace expiry). The app talks to it through a `Backend` interface (`src/backend/`); without the two repo variables it stays in demo mode. SQL tested on real Postgres via PGlite (15 tests: privacy, no self-waive, no direct credit edits, refill, lock, expiry, check-in window, invites, storage and channel access).
- Late-cancel fix: refill rule (a late-cancelled spot reopens; newcomers fill empty spots first, and only when the session is fuller than it could be without the late cancels is a canceller refunded, oldest first; a first version refunded even when a newcomer just took an empty spot, caught by a mutation test that slipped through), trusted time (server clock in the backend; the page's `Date` header in the demo, so changing the phone clock no longer dodges a late cancel), waive/enforce only on the coach page and server-checked.
- Real two-way video calls (WebRTC, free; signalling via Supabase Realtime or BroadcastChannel in the demo).
- Hosting: GitHub Pages workflow (test → build → deploy) and a keep-awake ping for the free backend. MIT licence (code only; brand excluded). `SETUP-BACKEND.md` for the owner.
- Found and fixed while testing: sample clip URL broke on sub-pages; offline athlete page failed because the service worker only had visited pages' scripts (now precaches every built file) and because `Vary: Origin` stopped cache matches (`ignoreVary`); dev header crowded on phones; 5 coach tabs didn't fit 360 px phones.
- Checks: 35/35 tests (mutations of the refill rule caught in both copies); Chrome 49/49 browser checks at 3 sizes with 0 console errors; WebKit 11/11; axe 0 violations on 22 screen/size combinations; script injection blocked.

## 2026-11-03 — v0.3: hardening after the second critique

- Damaged saved data no longer blanks the app: every saved record is checked (`isValidState`), and a crash screen (`ErrorBoundary`) offers Reload / Reset demo data.
- Two tabs can't lose each other's changes: all writes go through a Web Locks lock and re-read storage first (racing for the last spot now gives one booking and one "full").
- Check-in only opens 30 min before a session (until 12 h after); late-cancelled spots stay locked unless waived (matches "late cancellations lock court time").
- Offline: the service worker caches the sample clip and answers video range requests from cache. Fonts self-hosted (Fontsource), no requests to other sites; CSP is `'self'` only. Fonts were briefly inlined as data: URLs and blocked by the CSP; fixed with `assetsInlineLimit: 0`.
- Clickjacking guard (refuses to run framed), persistent-storage request, iPhone "Add to Home Screen" hint. `npm run phone` serves the built app, not the dev server, to Wi-Fi.
- Web-bible review (Vercel Web Interface Guidelines + axe-core): button contrast fixed (white text moved off bright orange/green/blue onto 5:1 shades), small grey text lightened, 44 px tap targets, 16 px phone inputs, tabs are real links, athlete in the URL, per-screen titles, one h1, skip link, `color-scheme: dark`, no `transition: all`, confirm before deleting notes/memos, frame-step buttons announce their visible text. axe: 0 violations.
- Safari engine: storing files in IndexedDB fails in private mode; media now falls back to raw bytes. Found by a new WebKit test (11/11). Chrome 50/50. 16 rule tests; three new mutations each caught.

## 2026-11-03 — v0.2: audit fixes, real demo behaviour, installable

- Audit found 15 bugs plus many fake actions; all 15 fixed. Highlights: drawing works by touch (pointer events), drawings are saved per frame as 0..1 coordinates and survive resize/rotation, attendance is per booking (was per player across sessions), the athlete view no longer jumps to coach view, the camera comes back after off/on and stops when leaving the tab, a denied camera shows a message, play state follows the video, ±1 frame is 1/30 s, pinch zoom allowed.
- Made real without a server: bookings use credits, cancel rules run on real times with live 24h countdowns and auto-forfeit, coach waive/enforce, XP on check-in, voice memos record and play (IndexedDB), film loaded from the device, coach notes saved per athlete, reminder settings saved, invite link copies a real deep link, every view picks any athlete, state saved and synced across tabs, Reset demo.
- The original Google sample video URL now returns 403, so the film studio never had video. Replaced with our own 10 s animated pick-and-roll diagram (`public/samples/pick-and-roll.mp4`, ffmpeg from rendered frames); seeded notes and drawings line up with it.
- Installable: manifest, icons, offline service worker (prod only). Build-time CSP. Stock photos replaced with initials. Dev server bound to 127.0.0.1 so a busy 5173 moves to the next port. Template leftovers removed.
- Rules moved to `src/logic.ts` with 13 Node tests (two deliberate mutations both caught). 44/44 browser checks in Chrome at 390×844, 1366×768 and 1920×1080, zero console errors. Launchers moved into the repo (install on first run, open the right port); the vault folder's launchers find the repo on either computer.

## 2026-11-03 — Initial Proof-of-Concept Scaffold & 4 Core Modules

- Initialized React + Vite + Tailwind CSS app (created at `~/cmo-training`, moved into the vault at `projects/cmo-training/app/` the same day).
- Configured non-rigid, flexible athlete progression and drill structures so any caliber of athlete (high school varsity to pro) can be trained without being locked into narrow boxes.
- Implemented **Virtual Meeting Room**: In-app WebRTC live call interface with camera/mic controls, athlete picture-in-picture, call timer, and live in-call coaching notes drawer.
- Implemented **Cancellation & 24h Grace Engine**: Interactive simulator covering timely cancellations (>6 hours before session with automatic full credit restore) and late cancellations (<6 hours before session with 24-hour countdown warning and Coach Forgiveness / Override panel).
- Implemented **Coach Floor Mode**: High-contrast court mobile tool with 1-tap check-in (+50 XP, credit deduction), no-show tracking, multi-court session switcher, and 1-tap homework drill assigner.
- Implemented **Interactive Film Studio**: Video player with frame stepping (-1f / +1f), HTML5 telestrator canvas (pen, arrows, spotlight circles, multi-color palette), voice memo recording, and timestamped coaching notes that jump to specific video frames.
- Implemented **Athlete Portal View**: Jordan Cole's athlete portal showing upcoming court slots, assigned drill homework with completion checkboxes, coach film breakdown reviews, and 3 notification toggles (SMS, Email, Push).
- Created one-click desktop launchers: `Start CMO Training App.bat` (Windows) and `Start CMO Training App.command` (Mac).
- Verified production bundle with `npm run build` (clean exit, zero TypeScript or JSX errors).
