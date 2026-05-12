# Debug notes

## Fixed in this version

1. Added missing frontend `package.json`.
2. Added missing frontend `src/main.jsx`, `src/App.jsx`, `src/lib/supabase.js`, and CSS.
3. Mounted the backend admin route in `backend/src/index.js`.
4. Reordered the doctor availability route so `/api/doctors/:id/availability` is not swallowed by `/api/doctors/:id`.
5. Added `supabase/schema.sql` because the setup guide referenced it but it was missing.
6. Added `.env.example` files.

## Run commands

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

## Important

If you shared your Supabase service role key or JWT secret anywhere, rotate/reset them in Supabase before continuing.
