import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/auth/me
 * Returns the current user's profile.
 * Frontend calls this right after login to confirm the token works
 * and to learn the user's role for routing.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.profile });
});

/**
 * GET /api/auth/ping
 * Quick check that auth + role middleware are wired correctly.
 * Try hitting this with each of the 3 roles to verify.
 */
router.get('/ping-admin', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ ok: true, msg: `Hi admin ${req.user.email}` });
});

router.get('/ping-doctor', requireAuth, requireRole('doctor'), (req, res) => {
  res.json({ ok: true, msg: `Hi doctor ${req.user.email}` });
});

router.get('/ping-patient', requireAuth, requireRole('patient'), (req, res) => {
  res.json({ ok: true, msg: `Hi patient ${req.user.email}` });
});

export default router;
