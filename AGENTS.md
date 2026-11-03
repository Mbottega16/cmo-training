# CMO Training — rules & map (read this first)

Mobile-first installable web app (PWA) for CMO Training, a basketball skills trainer. Currently a **demo with no backend**.

**History:** `HISTORY.md`, newest first. **Business side:** the vault's `projects/cmo-training/context.md`.

## What this is
- **What:** Coach + athlete app: court check-ins (Floor Mode), film breakdown with drawings and voice memos, a video room, booking, and a 6-hour cancellation rule with a 24-hour grace window.
- **For:** The coach behind CMO Training and their high school, college and pro athletes.
- **Platform / stack:** React 19, TypeScript 7, Vite 8, Tailwind 3, Lucide. Static site, no server yet.
- **Money:** Planned Stripe (drop-ins, packages, monthly with rollover). Not connected.
- **What "done" looks like:** A court-tested app with real accounts and data, where the coach checks in a roster in seconds, breaks down film, and meets athletes on video.

## Settled decisions (don't re-argue)
- Installable web app, not an App Store app.
- Four core parts: video room, cancellation & grace engine, Floor Mode, film studio.
- Skill levels and drill categories stay free text, not a fixed ladder.
- Cancel 6+ hours before: credit restored. Under 6 hours: credit held 24 hours; coach can waive or enforce; it is used when the window runs out. Exactly 6 hours counts as on time.
- A credit is used at **booking**, not at check-in. Check-in only gives XP (+50) and is open from 30 min before start to 12 h after end.
- A late cancel keeps its spot locked (pending or forfeited); a timely cancel or a coach waiver frees it.
- Unused monthly sessions roll over (no UI yet).
- The public repo holds **mock data only**. No real athlete names, phones, emails or film, ever.

## How it's built
- `src/App.tsx` — shell, hash routing (`#/coach/<floor|film|room|policy>`, `#/athlete/<id>/<portal|film|room>`), demo banner, reset.
- `src/logic.ts` — **every rule** as pure functions (book, cancel, waive, enforce, grace expiry, attendance/XP, drawing frames, saved-data validation). No React, no browser APIs.
- `src/seed.ts` — demo data with session times relative to "now" (one live, one under 6h, others later). Bump `STATE_VERSION` when the saved shape changes.
- `src/store.ts` — `useDemoStore`: every change runs inside a Web Locks lock shared by all tabs, re-reads `localStorage`, applies the rule, saves. Grace expiry every 15 s. `run`/`update` are async.
- `src/components/ErrorBoundary.tsx` — crash screen with Reload / Reset demo data. `src/main.tsx` also refuses to run inside another site's frame and asks for persistent storage.
- `src/media.ts` — IndexedDB for voice memos and film loaded from the device (falls back to raw bytes where Safari private mode refuses files; clips capped at 300 MB).
- `src/format.ts` — dates, countdowns, video time, plurals, `useNow`.
- `src/components/` — `CoachFloorMode`, `FilmBreakdownStudio` (coach + read-only athlete mode), `VirtualMeetingRoom` (coach + athlete mode), `CancellationEngine`, `PlayerView`, `Navigation`, `ui.tsx` (Avatar, Modal, Toast, Switch, pickers).
- `public/` — `manifest.webmanifest`, `sw.js` (offline shell; prod only), icons, `samples/pick-and-roll.mp4` (our own animated diagram, 10 s; seeded notes/drawings line up with it at 3.2 s and 7.8 s).
- `vite.config.ts` — `base: './'`, dev bound to 127.0.0.1, `assetsInlineLimit: 0` (inlined data: fonts would be blocked by the CSP), CSP meta tag injected at build only.
- `Start CMO Training App.command` / `.bat` — launchers (install on first run, open the right port).

## Commands & Verification
- `npm run dev` — local only, 127.0.0.1:5173 or the next free port (5173 is often taken by other projects on the Mac).
- `npm run phone` — build, then serve the built app to the Wi-Fi network (never the dev server). Camera/mic/install won't work over plain http on a phone.
- `npm test` — 16 rule tests (`tests/logic.test.ts`, Node 23.6+ runs the TypeScript directly).
- `npm run build` — `tsc` + Vite build. Must pass with zero errors.
- Browser check: there is no committed browser suite. Verify UI changes in real Chrome at phone (390×844), laptop (1366×768) and desktop (1920×1080) sizes; headless Chromium can't play the H.264 sample, use `channel: 'chrome'`. Also run Playwright `webkit` for Safari behaviour (no fake camera there). Playwright screenshots trigger two harmless CSP warnings in WebKit.

## Never Read / Noise Zones (Do Not Scan)
- `node_modules/`, `dist/`, `.git/`, `public/samples/*.mp4`, `public/icons/*.png`.

## Rules & Gotchas
- Rules live in `logic.ts` only; components call them. Add a test for any rule change and check it can fail.
- Everything is client-side, so any athlete can edit their own credits in DevTools. Fine for a demo; the backend must re-run these rules on the server.
- Drawings are stored as 0..1 coordinates per frame (±0.15 s) and only show while paused.
- The video element in the room stays mounted during a call; unmounting it loses the camera stream. Leaving the tab stops all tracks.
- The service worker registers only in production builds; it precaches the sample clip and answers video byte-range requests from that cached copy (bump `CACHE` in `public/sw.js` when its file list changes).
- Don't add outside image/video/font hosts: the build CSP is `'self'` only. Update `vite.config.ts` CSP if a new host is truly needed.

## Session Handoff (Last Worked On · Current State · Next Up)
- **Last Worked On (2026-11-03):** v0.3 hardening (see HISTORY). Before that, v0.2. Fixed all 15 audit bugs, made the fake parts real where possible without a server (bookings, cancels with live countdowns, XP, voice memos, drawings on frames, per-athlete views, saving, invite links), added install-to-home-screen + offline, CSP, our own sample clip (the old Google sample URL returns 403), launchers, and rule tests.
- **Current State:** `npm test` 16/16, build clean, 50/50 browser checks in Chrome (phone/laptop/desktop) with 0 console errors, 11/11 in WebKit. Not hosted anywhere yet. Remaining issues all need a server or the owner (see vault context.md).
- **Next Up:** Show the coach and collect notes. Then decide the backend (accounts, database, Stripe, messaging, video service) — all need the owner's sign-off on cost. Hosting on GitHub Pages needs a yes too.
