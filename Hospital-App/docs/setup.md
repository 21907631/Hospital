# Setup Guide

This is the one-time setup for each team member.

## 1. Prerequisites

- **Node.js** 20+ (`node --version` to check)
- **Git**
- A Supabase account (free tier is fine)

## 2. Clone & install

```bash
git clone <repo-url> hospital-appointment-scheduler
cd hospital-appointment-scheduler

# Backend
cd backend
npm install

# Frontend — bootstrap with Vite
cd ../frontend
npm create vite@latest . -- --template react
# When prompted: "Ignore files and continue" → Yes
npm install
npm install @supabase/supabase-js react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

After Vite scaffolds, replace `frontend/src/App.jsx` with your app shell and copy `lib/supabase.js` + `contexts/AuthContext.jsx` from this repo into the new `src/` if they got overwritten.

## 3. Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Wait ~2 min for it to provision.
3. **SQL Editor** → New query → paste contents of `supabase/schema.sql` → Run.
4. **Settings → API** — copy these three values:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key (treat like a password)
5. **Settings → API → JWT Settings** — copy the `JWT Secret`.

## 4. Env files

```bash
# backend/.env
cp backend/.env.example backend/.env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET

# frontend/.env
cp frontend/.env.example frontend/.env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## 5. Tailwind

In `frontend/tailwind.config.js`, set the `content` field:
```js
content: ["./index.html", "./src/**/*.{js,jsx}"],
```

In `frontend/src/index.css`, replace contents with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 6. Run

Two terminals:

```bash
# Terminal 1
cd backend && npm run dev
# → API listening on http://localhost:3001

# Terminal 2
cd frontend && npm run dev
# → http://localhost:5173
```

## 7. Smoke test the auth

In the Supabase dashboard → **Authentication → Users**, you should see new users appear when you sign up from the frontend. In **Table Editor → profiles**, you should see matching rows with the role you chose.

Hit the backend directly to verify the JWT flow:
```bash
# After logging in via the frontend, copy the access_token from
# localStorage (key: sb-<project>-auth-token) and:
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <token>"
```
