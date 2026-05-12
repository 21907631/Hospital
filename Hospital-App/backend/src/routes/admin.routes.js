import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

/**
 * GET /api/admin/users
 * List all users with their profiles (admins only)
 */
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, phone, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(users || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:id
 * Get detailed user profile (admins only)
 */
router.get('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update user role (admins only)
 */
router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['patient', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Soft delete user (set their account as inactive)
 */
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting the requesting admin
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { data: user, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'patient' }) // Demote to patient instead of hard delete
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ message: 'User deactivated', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/appointments
 * Get all appointments with filters (admins only)
 */
router.get('/appointments', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status, date_from, date_to } = req.query;

    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        patient:patient_id(email, full_name),
        doctor:doctor_id(specialty, profiles:id(email, full_name))
      `)
      .order('appointment_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (date_from) {
      query = query.gte('appointment_date', date_from);
    }

    if (date_to) {
      query = query.lte('appointment_date', date_to);
    }

    const { data: appointments, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(appointments || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

/**
 * GET /api/admin/stats
 * System-wide statistics (admins only)
 */
router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Total users by role
    const { data: usersByRole, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .then((result) => {
        const counts = {
          patient: 0,
          doctor: 0,
          admin: 0,
        };

        result.data?.forEach((user) => {
          counts[user.role]++;
        });

        return { data: counts, error: result.error };
      });

    // Appointment stats
    const { data: allAppointments } = await supabaseAdmin
      .from('appointments')
      .select('status, appointment_date');

    const appointmentStats = {
      total: allAppointments?.length || 0,
      scheduled: allAppointments?.filter((a) => a.status === 'scheduled').length || 0,
      completed: allAppointments?.filter((a) => a.status === 'completed').length || 0,
      cancelled: allAppointments?.filter((a) => a.status === 'cancelled').length || 0,
    };

    // Doctors count
    const { data: doctors } = await supabaseAdmin
      .from('doctors')
      .select('id');

    const stats = {
      users: {
        total:
          (usersByRole?.patient || 0) +
          (usersByRole?.doctor || 0) +
          (usersByRole?.admin || 0),
        byRole: usersByRole,
      },
      appointments: appointmentStats,
      doctors: {
        total: doctors?.length || 0,
      },
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/doctors
 * List all doctors with their statistics (admins only)
 */
router.get('/doctors', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { data: doctors, error } = await supabaseAdmin
      .from('doctors')
      .select(`
        *,
        profiles:id(email, full_name, phone)
      `);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get appointment counts for each doctor
    const doctorsWithStats = await Promise.all(
      (doctors || []).map(async (doctor) => {
        const { data: appointments } = await supabaseAdmin
          .from('appointments')
          .select('id')
          .eq('doctor_id', doctor.id);

        return {
          ...doctor,
          total_appointments: appointments?.length || 0,
        };
      })
    );

    res.json(doctorsWithStats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

/**
 * DELETE /api/admin/appointments/:id
 * Cancel an appointment (admins only)
 */
router.delete('/appointments/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Appointment cancelled', appointment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

export default router;
