# CMO Training — Basketball Coach & Athlete App (demo)

A mobile-first web app for **CMO Training** ([@cmo.training](https://instagram.com/cmo.training)), a basketball skills
trainer working with late high school, college and pro athletes. It installs to a phone's home screen like an app,
with no App Store.

> **This is a demo with made-up data.** Everything is saved in your own browser only. Payments, text and email
> reminders, and live video calls with a second person are not connected yet.

## What works in the demo

| Part | What you can do |
|---|---|
| **Floor Mode** (coach) | Pick a session, check athletes in with one tap (+50 XP; opens 30 minutes before start), mark no-shows, and assign a homework drill that appears in the athlete's portal right away. Big buttons for use on court. |
| **Film Studio** (coach) | Play a clip, step frame by frame, and draw on the paused frame with finger, pen or mouse (pen, arrow, spotlight circle, four colours). Drawings stay on their moment of the clip. Add timestamped notes and record real voice memos. Load your own film from the device. |
| **Video Room** | Open the room and test your camera and mic, copy an invite link, and keep coaching notes per athlete. *A second person can't join yet; that needs a video service.* |
| **Cancellations & 24h grace** | Real rules on real times: cancel 6+ hours before and the credit comes back; later than that, the credit is held for 24 hours with a live countdown until the coach waives or enforces it (or time runs out). A late-cancelled spot stays locked unless the coach waives it. |
| **Athlete portal** | Book open sessions with a credit, cancel with the rule explained first, see drills and film from the coach, and set reminder preferences. |

Switch between **Coach** and **Athlete** in the top right (a demo switch; there are no logins yet). Use **Reset demo**
to start over with fresh session times. Open the app in two tabs (one coach, one athlete) to see changes appear in both.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev          # http://127.0.0.1:5173 (or the next free port), this computer only
npm run phone        # builds, then serves the built app to phones on the same Wi-Fi
npm test             # the booking, cancellation, credit and drawing rules (Node 23.6+)
npm run build        # production build in dist/
```

Or double-click **Start CMO Training App.command** (Mac) or **Start CMO Training App.bat** (Windows). It installs
packages the first time and opens the app in your browser.

Camera, microphone and home-screen install need a secure address: `localhost` works, a phone on Wi-Fi over plain
`http://` does not. Use the hosted (https) version to try those on a phone.

## Install on a phone

Open the hosted app over https, then **Share → Add to Home Screen** (iPhone, Safari) or **⋮ → Install app**
(Android, Chrome). Once installed it opens without a signal, for example in a gym with bad reception.

## Not built yet

Accounts and logins, payments (Stripe), text/email/push reminders, live two-way video, uploading film to a server,
and a drill video library. Until a server exists, every rule runs in the browser and anyone can change their own
browser data, so the demo must not be used for real bookings or money.

## Tech

React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, self-hosted Inter and Teko fonts (Fontsource). No backend and
no requests to other sites. Data lives in `localStorage` (tabs take turns writing); voice memos and loaded film live
in the browser's IndexedDB. The sample play is an animated diagram made for this demo.
