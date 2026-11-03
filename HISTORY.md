# CMO Training — Session History

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
