# CMO Training — Basketball Coach & Athlete App

A mobile-first web app for **CMO Training** ([@cmo.training](https://instagram.com/cmo.training)), a basketball skills
trainer working with late high school, college and pro athletes. It installs to a phone's home screen like an app,
with no App Store.

**Live:** <https://mbottega16.github.io/cmo-training/> — runs as a demo with made-up data until the free backend is
switched on ([SETUP-BACKEND.md](SETUP-BACKEND.md)).

## Three pages

| Page | Address | For |
|---|---|---|
| **Coach** | `/coach/` | Floor Mode check-ins, film breakdown, video room, cancellations, and **Manage** (athletes, credits, invites, schedule). |
| **Athlete** | `/athlete/` | Book and cancel sessions, drills and film from Coach, video sessions, reminder settings. |
| **Dev** | `/dev/` | The owner's page: switch between the coach and athlete views, and **Dev tools** to change the rules (late-cancel hours, grace window, refill or lock, XP, check-in window), travel in time for testing, edit athletes, export/import/reset demo data, and manage people and roles. |

The front page (`/`) links to the coach and athlete pages. With the backend on, each page needs a sign-in: coaches and
the owner on the coach page, athletes on theirs, only the owner on the dev page.

## What works

- **Floor Mode:** one-tap check-in (+XP, opens 30 minutes before a session), no-shows, homework drills that appear on
  the athlete's phone straight away.
- **Film Studio:** frame-by-frame playback, drawing on the paused frame with finger, pen or mouse (pen, arrow, spotlight
  circle), timestamped notes, recorded voice memos, and the coach's own clips loaded from the device.
- **Video Room:** real two-way video between the coach and the athlete, straight between the two devices (WebRTC),
  free, no Zoom or Meet account. The invite link opens the athlete's room.
- **Cancellations:** cancel 6+ hours before and the credit comes back. Later than that the credit is held for 24 hours
  while the coach waives or enforces it; when the time runs out it's used. **The late-cancelled spot reopens, and if the
  session fills back up (empty spots fill first), the canceller gets the credit back automatically** (or switch the dev page rule
  to keep the spot locked). With the backend these rules run on the server with the server's clock; in the demo, the
  app checks the time against the web server, so changing the phone's clock doesn't help.
- **Installable and offline:** add to the home screen; the coach and athlete pages open with no signal once visited.

Payments are taken outside the app for now (cash, Venmo, e-transfer); the coach adds credits on **Manage**. Text,
e-mail and push reminders are not connected yet.

## Run it on a computer

You need [Node.js](https://nodejs.org) 20 or newer (24 for the tests).

```bash
npm install
npm run dev     # http://127.0.0.1:5173 (or the next free port), this computer only
npm run phone   # builds, then serves the built app to phones on the same Wi-Fi
npm test        # the rules in the browser (tests/logic.test.ts) and in the database (tests/sql.test.ts)
npm run build   # production build in dist/
```

Or double-click **Start CMO Training App.command** (Mac) or **Start CMO Training App.bat** (Windows).

To use the real backend locally, create `.env.local` with `VITE_SUPABASE_URL=…` and `VITE_SUPABASE_ANON_KEY=…`.

## How it's built

React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, self-hosted Inter and Teko fonts. Backend: Supabase (free plan:
Postgres with row-level security, auth, file storage, realtime). Hosting: GitHub Pages, deployed by
`.github/workflows/pages.yml` after the tests pass. The sample play is an animated diagram made for this demo.

## Licence

MIT for the code ([LICENSE](LICENSE)). The "CMO Training" name, logo and brand belong to CMO Training.
