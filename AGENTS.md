# CMO Training — rules & map (read this first)

Mobile-first Progressive Web App for CMO Training (professional basketball skills training business).

**History:** `HISTORY.md`, newest first. **Business side:** `context.md`.

## What this is
- **What:** Basketball coaching PWA with live video rooms, interactive telestrator film breakdown, court-ready floor mode, flexible skill progression, and smart 6-hour cancellation with 24-hour grace.
- **For:** Professional basketball coach (CMO Training) and high school, collegiate, and pro athletes.
- **Platform / stack:** React, Vite, Tailwind CSS, Lucide icons, PWA-ready.
- **Money:** Stripe (drop-ins, packages, monthly recurring with rollover).
- **What "done" looks like:** A polished, court-tested app where the coach manages roster check-ins on the floor in seconds, breaks down film with drawings/audio, and meets clients virtually.

## Settled decisions (don't re-argue)
- PWA home screen installation (avoids 30% Apple App Store tax and app review delays).
- 4 core priority modules: Virtual Meeting Room, Cancellation & 24h Grace Engine, Coach Floor Mode, and Interactive Film Studio.
- Skill rubrics and progression tiers remain dynamic and flexible (not rigid pre-locked taxonomy).
- 6-hour cancellation threshold with 24-hour grace countdown and coach forgiveness override.
- Unused monthly subscription sessions roll over.

## How it's built
- `app/src/components/VirtualMeetingRoom.tsx` — In-app WebRTC live video room.
- `app/src/components/CancellationEngine.tsx` — Interactive policy engine (6h/24h grace).
- `app/src/components/CoachFloorMode.tsx` — On-court mobile attendance and drill assigner.
- `app/src/components/FilmBreakdownStudio.tsx` — HTML5 video player with telestrator canvas and voice notes.
- `app/src/components/PlayerView.tsx` — Athlete portal preview (sessions, homework, film feedback).
- `app/src/mockData.ts` — Realistic initial athletes, sessions, and sample basketball film.
- `Start CMO Training App.bat` / `.command` — One-click cross-platform launchers.

## Commands & Verification
- **Dev Server:** `cd app && npm run dev` (starts on `http://localhost:5173`)
- **Build Verification:** `cd app && npm run build`
- **Launchers:** Double-click `Start CMO Training App.bat` (Windows) or `Start CMO Training App.command` (Mac).

## Never Read / Noise Zones (Do Not Scan)
- `app/node_modules/`, `app/dist/`, `.git/`

## Rules & Gotchas
- When testing the Telestrator, drawing on the canvas automatically pauses the video so the coach can freeze and illustrate the exact frame.
- Cancellation engine allows coach manual override ("Waive & Excuse") at any time during the 24-hour grace window.

## Session Handoff (Last Worked On · Current State · Next Up)
- **Last Worked On (2026-11-03):** Initialized proof-of-concept app in `projects/cmo-training/app/` with all 4 priority modules built, type-checked, and verified via `npm run build`.
- **Current State:** Working interactive prototype ready for hands-on review. Launchers tested.
- **Next Up:** Present prototype to coach, collect revision notes, and prepare Supabase/Stripe backend wiring.
