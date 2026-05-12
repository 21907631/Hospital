import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

/**
 * POST /api/appointments
 * Book an appointment (patients only)
 */
router.post('/', requireAuth, requireRole('patient'), async (req, res) => {
  try {
    const { doctor_id, appointment_date, start_time, end_time, reason } = req.body;
    const patient_id = req.user.id;

    // Validate inputs
    if (!doctor_id || !appointment_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if doctor exists
    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('id', doctor_id)
      .single();

    if (docError || !doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check for conflicts with existing appointments
    const { data: conflicts, error: conflictError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('appointment_date', appointment_date)
      .eq('status', 'scheduled')
      .gte('start_time', start_time)
      .lt('start_time', end_time);

    if (conflictError) {
      return res.status(400).json({ error: conflictError.message });
    }

    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({ error: 'Doctor has a conflicting appointment' });
    }

    // Book the appointment
    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        reason: reason || '',
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

/**
 * GET /api/appointments
 * List appointments for the current user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = supabaseAdmin
      .from('appointments')
      .select(`
        *,
        doctor:doctor_id(specialty, profiles:id(email, full_name)),
        patient:patient_id(profiles:id(email, full_name))
      `);

    // Patients see only their own; doctors see their patients' appointments; admins see all
    if (userRole === 'patient') {
      query = query.eq('patient_id', userId);
    } else if (userRole === 'doctor') {
      query = query.eq('doctor_id', userId);
    }

    const { data: appointments, error } = await query.order('appointment_date', {
      ascending: false,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(appointments || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

/**
 * GET /api/appointments/:id
 * Get appointment details
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        *,
        doctor:doctor_id(specialty, profiles:id(email, full_name)),
        patient:patient_id(profiles:id(email, full_name))
      `)
      .eq('id', id)
      .single();

    if (error || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check authorization
    const isOwnAppointment =
      userId === appointment.patient_id || userId === appointment.doctor_id;
    const isAdmin = userRole === 'admin';

    if (!isOwnAppointment && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

/**
 * PUT /api/appointments/:id
 * Update appointment status (cancel, etc.) — patients can cancel own; doctors can update status
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const { data: appointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Authorization check
    const isPatient = userId === appointment.patient_id;
    const isDoctor = userId === appointment.doctor_id;
    const isAdmin = userRole === 'admin';

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Patients can only cancel; doctors/admins can update status
    const updateData = {};
    if (status) {
      if (isPatient && status !== 'cancelled') {
        return res.status(400).json({ error: 'Patients can only cancel appointments' });
      }
      updateData.status = status;
    }
    if (reason && isPatient) {
      updateData.reason = reason;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

export default router;
