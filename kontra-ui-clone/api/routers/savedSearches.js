const express = require('express');
const { z, ZodError } = require('../lib/zod');
const { supabase } = require('../db');
const authenticate = require('../middlewares/authenticate');

const router = express.Router();
router.use(authenticate);

const searchSchema = z.object({
  search_text: z.string().optional(),
  filters: z
    .object({
      par_amount_min: z.number().optional(),
      par_amount_max: z.number().optional(),
      coupon_bps_min: z.number().optional(),
      coupon_bps_max: z.number().optional(),
      spread_bps_min: z.number().optional(),
      spread_bps_max: z.number().optional(),
      ltv_min: z.number().optional(),
      ltv_max: z.number().optional(),
      dscr_min: z.number().optional(),
      dscr_max: z.number().optional()
    })
    .optional(),
  notify_email: z.boolean().default(false),
  notify_sms: z.boolean().default(false)
});

router.post('/', async (req, res) => {
  try {
    const input = searchSchema.parse(req.body);
    const { data, error } = await supabase
      .from('exchange_saved_searches')
      .insert([{ ...input, user_id: req.user.id }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
   if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    console.error('Create saved search error:', err);
    res.status(500).json({ error: 'Failed to save search' });
  }
});

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('exchange_saved_searches')
    .select('*')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ searches: data || [] });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('exchange_saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});

module.exports = router;
