import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

/**
 * GET /api/doctors
 * List all doctors with their profiles
 */
router.get('/', async (req, res) => {
  try {
    const { data: doctors, error } = await supabaseAdmin
      .from('doctors')
      .select(`
        id,
        specialty,
        bio,
        experience_years,
        profiles:id(email, full_name, phone)
      `)
      .eq('profiles.role', 'doctor');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

/**
 * GET /api/doctors/:id/availability
 * Get doctor's availability slots
 */
router.get('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: slots, error } = await supabaseAdmin
      .from('availability_slots')
      .select('*')
      .eq('doctor_id', id)
      .order('day_of_week', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(slots || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/**
 * GET /api/doctors/:id
 * Get doctor profile with availability slots
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select(`
        id,
        specialty,
        bio,
        experience_years,
        license_number,
        profiles:id(email, full_name, phone)
      `)
      .eq('id', id)
      .single();

    if (docError || !doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const { data: slots, error: slotError } = await supabaseAdmin
      .from('availability_slots')
      .select('*')
      .eq('doctor_id', id);

    if (slotError) {
      return res.status(400).json({ error: slotError.message });
    }

    res.json({ ...doctor, availability_slots: slots || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

/**
 * POST /api/doctors/:id/availability
 * Create or update availability slots (doctors only)
 */
router.post('/:id/availability', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, start_time, end_time, max_patients } = req.body;

    // Verify the doctor is updating their own availability
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Can only update own availability' });
    }

    // Validate inputs
    if (day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: 'Invalid day of week (0-6)' });
    }

    const { data: slot, error } = await supabaseAdmin
      .from('availability_slots')
      .insert({
        doctor_id: id,
        day_of_week,
        start_time,
        end_time,
        max_patients: max_patients || 1,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create availability slot' });
  }
});


export default router;
