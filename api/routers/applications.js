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

const piiSecret = process.env.PII_ENCRYPTION_KEY;
if (!piiSecret) {
  console.error('Missing PII_ENCRYPTION_KEY!');
  process.exit(1);
}
const PII_KEY = crypto.createHash('sha256').update(piiSecret).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', PII_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function runKycCheck(buffer) {
  // TODO: replace with real KYC integration
  return { passed: true };
}

async function fetchCreditScore(ssn) {
  // TODO: replace with real credit bureau integration
  return { score: 650 + Math.floor(Math.random() * 101) };
}

router.post(
  '/',
  upload.single('document'),
  async (req, res) => {
    try {
      const { name, email, ssn, amount } = req.body;

      // ---- Validation ----
      if (!name || !email || !ssn || !amount) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res
          .status(400)
          .json({ message: 'Amount must be a positive number' });
      }

      // ---- KYC ----
      let kyc;
      try {
        kyc = await runKycCheck(req.file?.buffer || null);
      } catch (err) {
        console.error('KYC error:', err);
        return res
          .status(502)
          .json({ message: 'Identity verification service failed' });
      }

      // ---- Credit Score ----
      let credit;
      try {
        credit = await fetchCreditScore(ssn);
      } catch (err) {
        console.error('Credit score error:', err);
        return res
          .status(502)
          .json({ message: 'Credit bureau service failed' });
      }

      // ---- Encrypt SSN ----
      let encryptedSsn;
      try {
        encryptedSsn = encrypt(ssn);
      } catch (err) {
        console.error('Encryption error:', err);
        return res
          .status(500)
          .json({ message: 'Failed to encrypt sensitive data' });
      }

      // ---- Document Upload (optional) ----
      let documentUrl = null;
      if (req.file) {
        const fileName = `${crypto.randomUUID()}_${req.file.originalname}`;
        const { error: uploadErr } = await supabase.storage
          .from('loan-documents')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });
        if (uploadErr) {
          console.error('File upload error:', uploadErr);
          return res
            .status(500)
            .json({ message: 'Failed to upload document' });
        }
        const {
          data: { publicUrl },
        } = supabase.storage
          .from('loan-documents')
          .getPublicUrl(fileName);
        documentUrl = publicUrl;
      }

      // ---- Insert into DB ----
      const { data, error: dbErr } = await supabase
        .from('loan_applications')
        .insert([
          {
            name,
            email,
            ssn: encryptedSsn,
            amount: parsedAmount,
            credit_score: credit.score,
            kyc_passed: kyc.passed,
            document_url: documentUrl,
            submitted_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (dbErr) {
        console.error('DB insert error:', dbErr);
        return res
          .status(500)
          .json({ message: 'Failed to save application' });
      }

      return res.status(201).json({ application: data });
    } catch (err) {
      console.error('Unexpected error in application intake:', err);
      return res
        .status(500)
        .json({ message: 'Internal server error' });
    }
  }
);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('loan_applications')
      .select(
        'id, name, amount, credit_score, kyc_passed, submitted_at, document_url'
      )
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('List applications error:', error);
      return res
        .status(500)
        .json({ message: 'Failed to fetch applications' });
    }

    res.json({ applications: data });
  } catch (err) {
    console.error('Unexpected error listing applications:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
