const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const requireOrg = require('../middlewares/requireOrg');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLANS = [
  {
    name: 'basic',
    price: 0,
    features: ['Up to 3 users', 'Community support']
  },
  {
    name: 'pro',
    price: 50,
    features: ['Up to 10 users', 'Priority support']
  },
  {
    name: 'enterprise',
    price: 200,
    features: ['Unlimited users', 'Dedicated support']
  }
];

const router = express.Router();

router.get('/plans', (_req, res) => {
  res.json({ plans: PLANS });
});

router.get('/subscription', requireOrg, async (req, res) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', req.orgId)
    .single();
  if (error) return res.status(500).json({ message: 'Failed to fetch subscription' });
  res.json({ plan: data.plan || 'basic' });
});

router.post('/subscription', requireOrg, async (req, res) => {
  const { plan } = req.body || {};
  if (!PLANS.some(p => p.name === plan)) {
    return res.status(400).json({ message: 'Invalid plan' });
  }
  const { error } = await supabase
    .from('organizations')
    .update({ plan })
    .eq('id', req.orgId);
  if (error) return res.status(500).json({ message: 'Failed to update subscription' });
  res.json({ plan });
});

module.exports = router;
