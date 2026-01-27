const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { isFeatureEnabled } = require('../featureFlags');
const { handleMissingSchemaError } = require('../lib/schemaErrors');
const {
  parseDocumentBuffer,
  autoFillFields,
  advancedCreditScore,
  detectFraud,
} = require('../services/underwriting');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FALLBACK_LOAN_APPLICATIONS = [
  {
    id: 'demo-001',
    name: 'Alex Johnson',
    amount: 50000,
    credit_score: 710,
    kyc_passed: true,
    decision: 'approved',
    status: 'funded',
    submitted_at: '2024-02-12T09:30:00.000Z',
    document_url: null,
  },
  {
    id: 'demo-002',
    name: 'Jordan Smith',
    amount: 25000,
    credit_score: 665,
    kyc_passed: true,
    decision: 'review',
    status: 'under_review',
    submitted_at: '2024-02-10T14:45:00.000Z',
    document_url: null,
  },
  {
    id: 'demo-003',
    name: 'Morgan Lee',
    amount: 15000,
    credit_score: 640,
    kyc_passed: false,
    decision: 'pending',
    status: 'needs_documents',
    submitted_at: '2024-02-08T11:20:00.000Z',
    document_url: null,
  },
];

const piiSecret = process.env.PII_ENCRYPTION_KEY;
const PII_KEY = crypto.createHash('sha256').update(piiSecret).digest();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

function parseJsonField(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

function parseNumberArray(value) {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parseNumberArray(parsed);
      }
    } catch (err) {
      // ignore
    }
    return value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry));
  }
  return [];
}

function computeAiScorecard(baseScore, credit, fraud, amount, autoFields = {}) {
  const adjustment = credit.score - baseScore;
  const fraudPenalty = fraud?.suspicious ? 0.15 : 0;
  const delinquencyRaw = (700 - credit.score) / 500 + fraudPenalty;
  const delinquencyRisk = Math.max(0.05, Math.min(0.95, delinquencyRaw));
  const lossRate = Number((delinquencyRisk * 0.4).toFixed(3));
  const lossRatePct = Number((lossRate * 100).toFixed(1));
  const normalizedAmount = Number.isFinite(Number(amount))
    ? Number(amount)
    : Number.isFinite(Number(autoFields?.amount))
      ? Number(autoFields?.amount)
      : null;
  const projectedLossExposure = Number.isFinite(normalizedAmount)
    ? Number((normalizedAmount * lossRate).toFixed(2))
    : null;
  const fundingReadiness = Math.max(
    0,
    Math.min(100, Math.round((credit.score / 850) * 100 - (fraud?.suspicious ? 12 : 0)))
  );

  const recommendations = [];
  if (fraud?.suspicious && Array.isArray(fraud.anomalies) && fraud.anomalies.length) {
    recommendations.push(`Investigate anomalies: ${fraud.anomalies.join('; ')}`);
  }
  if (credit.score < 680) {
    recommendations.push('Strengthen collateral or require reserves for sub-680 credit.');
  } else if (adjustment > 10) {
    recommendations.push('AI suggests accelerated decisioning based on positive payment history.');
  }
  if (autoFields?.income && autoFields?.taxes) {
    const ratio = Number(autoFields.taxes) / Number(autoFields.income || 1);
    if (Number.isFinite(ratio) && ratio > 0.3) {
      recommendations.push('Verify debt-to-income; tax burden appears elevated.');
    }
  }
  if (!recommendations.length) {
    recommendations.push('Proceed with standard underwriting checklist and document verification.');
  }

  const narrative = `AI projects ${Math.round(delinquencyRisk * 100)}% delinquency risk with ${fundingReadiness}% funding readiness after a ${adjustment >= 0 ? '+' : ''}${adjustment}pt adjustment.`;

  return {
    baseScore,
    adjustedScore: credit.score,
    adjustment,
    fundingReadiness,
    delinquencyRisk: Number(delinquencyRisk.toFixed(3)),
    forecast: {
      expectedLossRate: lossRatePct,
      projectedLossExposure,
      windowMonths: 12,
    },
    recommendations,
    narrative,
  };
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', PII_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function runKycCheck(buffer) {
  if (!isFeatureEnabled('kyc')) {
    return { passed: true };
  }
  if (!process.env.KYC_API_URL || !process.env.KYC_API_KEY) {
    throw new Error('KYC provider not configured');
  }
  try {
    const resp = await fetch(process.env.KYC_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KYC_API_KEY}` },
      body: buffer,
    });
    if (!resp.ok) {
      throw new Error(`status ${resp.status}`);
    }
    const data = await resp.json();
    return { passed: !!data.passed };
  } catch (err) {
    throw err;
  }  
}

async function fetchCreditScore(ssn) {
  if (!isFeatureEnabled('credit')) {
    return { score: 650 + Math.floor(Math.random() * 101) };
  }
  if (!process.env.CREDIT_API_URL || !process.env.CREDIT_API_KEY) {
    throw new Error('Credit score provider not configured');
  }
  try {
    const resp = await fetch(
      `${process.env.CREDIT_API_URL}?ssn=${encodeURIComponent(ssn)}`,
      {
        headers: { Authorization: `Bearer ${process.env.CREDIT_API_KEY}` },
      }
    );
    if (!resp.ok) {
      throw new Error(`status ${resp.status}`);
    }
    const data = await resp.json();
    return { score: data.score };
  } catch (err) {
    throw err;
  }
}

router.post(
  '/orchestrations',
  upload.single('package'),
  async (req, res) => {
    try {
      const metadata = parseJsonField(req.body.metadata, {});
      const applicantInput = parseJsonField(req.body.applicant, {});
      const borrower = Object.assign({}, metadata?.applicant || {}, applicantInput || {});

      const fallbackKeys = ['name', 'email', 'ssn', 'amount', 'address', 'income', 'taxes'];
      fallbackKeys.forEach((key) => {
        if (req.body[key] !== undefined && borrower[key] === undefined) {
          borrower[key] = req.body[key];
        }
      });

      if (req.file) {
        if (!ALLOWED_DOC_TYPES.includes(req.file.mimetype)) {
          return res.status(400).json({ message: 'Unsupported document type' });
        }
        if (req.file.size > MAX_FILE_SIZE) {
          return res.status(400).json({ message: 'Document too large' });
        }
      }

      let documentFields = {};
      let autofillFields = {};
      if (req.file) {
        documentFields = parseDocumentBuffer(req.file.buffer);
        autofillFields = await autoFillFields(req.file.buffer);
      }

      const baseScoreInput = req.body.bureauScore ?? borrower.bureauScore ?? req.body.baseScore;
      const baseScore = Number.isFinite(Number(baseScoreInput)) ? Number(baseScoreInput) : 680;
      const historySource =
        parseJsonField(req.body.history, req.body.history) ??
        parseJsonField(borrower.history, borrower.history) ??
        req.body.credit_history ??
        borrower.credit_history;
      const creditHistory = parseNumberArray(historySource);

      const credit = advancedCreditScore(baseScore, creditHistory);
      const fraud = detectFraud({ ...borrower, ...autofillFields });
      const scorecard = computeAiScorecard(
        baseScore,
        credit,
        fraud,
        borrower.amount ?? req.body.amount,
        autofillFields
      );

      const structuredOutputs = {
        documentFields,
        autoFill: autofillFields,
        credit,
        fraud,
        scorecard,
      };

      const nowIso = new Date().toISOString();
      const taskAudit = {
        parseDocument: { status: 'completed', completed_at: nowIso, output: documentFields },
        autoFill: { status: 'completed', completed_at: nowIso, output: autofillFields },
        creditScore: { status: 'completed', completed_at: nowIso, output: credit },
        detectFraud: { status: 'completed', completed_at: nowIso, output: fraud },
      };

      let documentUrl = null;
      if (req.file) {
        try {
          const fileName = `${crypto.randomUUID()}_${req.file.originalname}`;
          const { error: uploadErr } = await supabase.storage
            .from('loan-documents')
            .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
          if (uploadErr) {
            console.error('Package upload error:', uploadErr);
          } else {
            const {
              data: { publicUrl },
            } = supabase.storage.from('loan-documents').getPublicUrl(fileName);
            documentUrl = publicUrl;
          }
        } catch (err) {
          console.error('Failed to upload borrower package artifact:', err);
        }
      }

      const recordPayload = {
        applicant: borrower,
        status: 'completed',
        outputs: structuredOutputs,
        tasks: taskAudit,
        document_url: documentUrl,
        package_filename: req.file?.originalname ?? null,
        review_status: 'pending',
        submitted_at: nowIso,
      };

      const { data: orchestration, error: orchestrationError } = await supabase
        .from('application_orchestrations')
        .insert([recordPayload])
        .select()
        .single();

      if (orchestrationError) {
        console.error('Failed to persist orchestration:', orchestrationError);
        return res.status(500).json({ message: 'Failed to persist orchestration results' });
      }

      return res.status(201).json({
        orchestration: {
          ...orchestration,
          outputs: structuredOutputs,
        },
      });
    } catch (err) {
      console.error('Application orchestration error:', err);
      return res.status(500).json({ message: 'Failed to orchestrate borrower package' });
    }
  }
);

router.get('/orchestrations', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const { data, error } = await supabase
      .from('application_orchestrations')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (error) {
            if (handleMissingSchemaError(res, error, 'Orchestrations', { orchestrations: [] })) {
        return;
      }
      console.error('Failed to list orchestration runs:', error);
      return res.status(500).json({ message: 'Failed to fetch orchestration runs' });
    }

    return res.json({ orchestrations: data });
  } catch (err) {
       if (handleMissingSchemaError(res, err, 'Orchestrations', { orchestrations: [] })) {
      return;
    }
    console.error('Unexpected error listing orchestrations:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/orchestrations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('application_orchestrations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
            if (handleMissingSchemaError(res, error, 'Orchestration detail', { orchestration: null })) {
        return;
      }
      if (error.code === 'PGRST116') {
        return res.status(404).json({ message: 'Orchestration not found' });
      }
      console.error('Failed to fetch orchestration:', error);
      return res.status(500).json({ message: 'Failed to fetch orchestration' });
    }

    return res.json({ orchestration: data });
  } catch (err) {
        if (handleMissingSchemaError(res, err, 'Orchestration detail', { orchestration: null })) {
      return;
    }
    console.error('Unexpected error fetching orchestration:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

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

            if (req.file) {
        if (!ALLOWED_DOC_TYPES.includes(req.file.mimetype)) {
          return res
            .status(400)
            .json({ message: 'Unsupported document type' });
        }
        if (req.file.size > MAX_FILE_SIZE) {
          return res.status(400).json({ message: 'Document too large' });
        }
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

           // ---- Decision & Status ----
      let decision = 'review';
      let status = 'under_review';
      if (credit.score >= 700 && kyc.passed) {
        decision = 'approve';
        status = 'approved';
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
            decision,
            status,
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
    const selectFields =
      'id, name, amount, credit_score, kyc_passed, decision, status, submitted_at, document_url';
    let { data, error } = await supabase
      .from('loan_applications')
       .select(selectFields)
      .order('submitted_at', { ascending: false });

    if (error) {
           if (handleMissingSchemaError(res, error, 'Loan applications', { applications: [], from_cache: false })) {
        return;
      }
      console.error('List applications error:', error);
      return res.json({
        applications: FALLBACK_LOAN_APPLICATIONS,
        from_cache: true,
      });
    }

    return res.json({ applications: data, from_cache: false });
  } catch (err) {
       if (handleMissingSchemaError(res, err, 'Loan applications', { applications: [], from_cache: false })) {
      return;
    }
    console.error('Unexpected error listing applications:', err);
    return res.json({
      applications: FALLBACK_LOAN_APPLICATIONS,
      from_cache: true,
    });
  }
});

module.exports = router;
