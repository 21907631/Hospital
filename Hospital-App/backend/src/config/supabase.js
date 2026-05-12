import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in the keys.'
  );
}

/**
 * Admin client — uses the service_role key and BYPASSES Row Level Security.
 * Use this for server-side queries the API has already authorized via the
 * `requireAuth` middleware. NEVER expose this client to the frontend.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Anon client — uses the public anon key and respects RLS.
 * Mostly used here for any "as-the-user" operations we want to delegate to
 * Postgres policies. For now we lean on the admin client + middleware.
 */
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
