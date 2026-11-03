# Turn on the real backend (free, about 10 minutes)

Until this is done, the hosted app runs as a **demo**: each phone keeps its own made-up data. After it, everyone shares
one real database: the coach's check-ins show up on athletes' phones, bookings use real credits, and video calls work
between any two devices.

Everything here is on **Supabase's free plan**: no card needed.

## 1. Create the free project
1. Go to <https://supabase.com> and sign in with your GitHub account.
2. **New project** → name it `cmo-training`, pick the region closest to you, set a database password (save it in
   your password manager), keep the **Free** plan, and create it. Wait a minute for it to start.

## 2. Create the tables and rules
1. Open **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql).
3. Near the top, replace `CHANGE-ME@example.com` with **your own e-mail**. The account you create with that address
   becomes the owner (the only one who can use the dev page).
4. Press **Run**. It should finish with "Success". Running it again later is safe.

## 3. Turn off confirmation e-mails
Supabase's free e-mail service only sends to people on your Supabase team, so the app is built to need no e-mails.
**Authentication** → **Sign In / Providers** → **Email** → turn **off** "Confirm email" → Save. Leave sign-ups on.

## 4. Connect the hosted app
1. In Supabase: **Project Settings** → **API**. Copy the **Project URL** and the **anon / publishable key**.
   Both are meant to be public; the database rules protect the data. Never share the `service_role` / secret key.
2. Give the two values to Claude, or add them yourself: GitHub → `cmo-training` repo → **Settings** → **Secrets and
   variables** → **Actions** → **Variables** tab → **New repository variable**:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon / publishable key
3. GitHub → **Actions** → **Deploy to GitHub Pages** → **Run workflow**. About two minutes later the site uses the
   real backend.

## 5. First sign-in
1. Open `https://mbottega16.github.io/cmo-training/dev/` → **Create an account** with the e-mail from step 2.
   You're the owner.
2. **Dev tools → People and roles → Create a coach invite code.** Send the code and the coach page link
   (`…/cmo-training/coach/`) to the coach. They create an account and enter the code once.
3. The coach adds athletes on **Manage**, then taps **Invite** next to each one and sends the athlete the code and the
   athlete page link (`…/cmo-training/athlete/`).

## Good to know
- **Free limits:** 500 MB of data, 1 GB of files (game film counts here; each clip up to 50 MB), 50,000 users.
- **Pausing:** Supabase pauses free projects after 7 days with no use. The repo's "Keep the free backend awake"
  workflow pings it every 3 days, so this shouldn't happen. If it ever does, press **Restore** in the Supabase
  dashboard.
- **Video calls** go straight between the two phones. On some strict mobile or office networks the phones can't
  reach each other directly; the app says so. Wi-Fi on both sides usually fixes it.
- **Your own demo:** on the dev page you can switch your browser back to demo data to try things without touching the
  real data.
