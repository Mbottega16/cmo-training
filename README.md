# CMO Training — Basketball Coach & Athlete PWA

A mobile-first Progressive Web App built for **CMO Training** ([@cmo.training](https://instagram.com/cmo.training)), an elite basketball skill development brand servicing late high school, collegiate, and professional athletes.

## Features
- **📹 In-App Virtual Court Room:** Live WebRTC video meeting room with camera/mic controls, participant picture-in-picture, and real-time in-session coaching notes.
- **⏱️ Cancellation Policy & 24h Grace Engine:**
  - Cancellations > 6 hours before session: 100% automatic credit restore.
  - Cancellations < 6 hours before session (Late Cancel): Triggers 24-hour grace countdown with coach emergency/medical pardon override.
- **📋 Coach Floor Mode:** High-contrast court mobile tool with 1-tap check-in (+50 XP, session credit deduction), multi-court switcher, and 1-tap homework drill assigner.
- **🎬 Interactive Film Studio:** Video player with frame-stepping (-1f / +1f), interactive HTML5 telestrator canvas (drawing pen, arrows, spotlight circles, multi-color palette), voice memo recording, and timestamped coaching cues.
- **📱 Athlete Portal Preview:** Athletes can view upcoming gym slots, complete assigned homework drills, and toggle SMS/Email/Push notification preferences.

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

## Tech Stack
- React 18
- Vite
- Tailwind CSS
- Lucide React
- Prepared for Supabase (Auth, Postgres, Realtime, Storage) & Stripe Checkout.
