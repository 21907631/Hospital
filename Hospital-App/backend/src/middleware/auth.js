import { jwtVerify } from 'jose';
import { supabaseAdmin } from '../config/supabase.js';

const JWT_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

/**
 * requireAuth — verifies the Supabase access token sent in:
 *     Authorization: Bearer <token>
 *
 * On success, attaches `req.user` = { id, email, role, profile } and calls next().
 * On failure, responds 401.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Verify the JWT signature + expiry using the Supabase JWT secret.
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      // Supabase tokens carry "authenticated" as the audience
      audience: 'authenticated',
    });

    // payload.sub is the user's UUID — same as auth.users.id and profiles.id
    const userId = payload.sub;

    // Load the profile row so we have the role for authorization checks
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, phone')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(401).json({ error: 'Profile not found' });
    }

    req.user = {
      id: userId,
      email: profile.email,
      role: profile.role,
      profile,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * requireRole(...roles) — middleware factory.
 * Use AFTER requireAuth:
 *     router.get('/admin/users', requireAuth, requireRole('admin'), handler)
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    }
    next();
  };
}
