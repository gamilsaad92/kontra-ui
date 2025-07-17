const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runKycCheck(buffer) {
  // Placeholder for an identity verification service
  return { passed: true };
}

async function fetchCreditScore(ssn) {
  // Placeholder for credit bureau integration
  const score = 650 + Math.floor(Math.random() * 101);
  return { score };
}

router.post('/', upload.single('document'), async (req, res) => {
  const { name, email, ssn, amount } = req.body;
  if (!name || !email || !ssn || !amount) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const kyc = await runKycCheck(req.file ? req.file.buffer : null);
  const credit = await fetchCreditScore(ssn);

  const { data, error } = await supabase
    .from('loan_applications')
    .insert([
      {
        name,
        email,
        ssn,
        amount,
        credit_score: credit.score,
        kyc_passed: kyc.passed,
        submitted_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Insert application error:', error);
    return res.status(500).json({ message: 'Failed to save application' });
  }

  res.status(201).json({ application: data });
});

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('loan_applications')
    .select('id, name, amount, credit_score, kyc_passed, submitted_at')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('List applications error:', error);
    return res.status(500).json({ message: 'Failed to fetch applications' });
  }
  res.json({ applications: data });
});

module.exports = router;
