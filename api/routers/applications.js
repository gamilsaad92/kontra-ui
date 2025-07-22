const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const piiSecret = process.env.PII_ENCRYPTION_KEY || 'default_pii_key';
const PII_KEY = crypto.createHash('sha256').update(piiSecret).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', PII_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

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
  const encryptedSsn = encrypt(ssn);
  
  const { data, error } = await supabase
    .from('loan_applications')
    .insert([
      {
        name,
        email,
        ssn: encryptedSsn,
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
