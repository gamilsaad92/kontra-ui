// index.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');          // ← v4+ default export
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── OpenAI Client (v4+ SDK) ────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const { handleVoice, handleVoiceQuery } = require('./voiceBot');

// Define the functions that the assistant can “call.”
const functions = [
  {
    name: 'get_loans',
    description: 'Retrieve a list of active loans',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_draws',
    description: 'Fetch the five most recent draw requests',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
    },
  {
    name: 'get_escrow_balance',
    description: 'Retrieve escrow balance for a given loan id',
    parameters: {
      type: 'object',
      properties: {
        loan_id: { type: 'integer', description: 'Loan id' }
      },
      required: ['loan_id']
    }
  },
  {
    name: 'get_payoff_instructions',
    description: 'Provide instructions for requesting a payoff quote',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Helper implementations for those functions:
async function get_loans() {
  const { data } = await supabase
    .from('loans')
    .select('id, borrower_name, amount, status')
    .order('created_at', { ascending: false });
  return data;
}

async function get_draws() {
  const { data } = await supabase
    .from('draw_requests')
    .select('id, project, amount, status')
    .order('submitted_at', { ascending: false })
    .limit(5);
  return data;
}

async function get_escrow_balance({ loan_id }) {
  const { data } = await supabase
    .from('escrows')
    .select('escrow_balance')
    .eq('loan_id', loan_id)
    .maybeSingle();
  return data;
}

async function get_payoff_instructions() {
  const text = fs.readFileSync(
    path.join(__dirname, 'docs', 'payoff_instructions.txt'),
    'utf8'
  );
  return { instructions: text };
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Checks ──────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Kontra API is running'));
app.get('/api/test', (req, res) => res.send('✅ API is alive'));

// ── AI Photo Validation ────────────────────────────────────────────────────
app.post('/api/validate-photo', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ result: 'No file uploaded' });
  const fileSizeKB = req.file.size / 1024;
  const result =
    fileSizeKB < 30
      ? 'Image too small — likely blurry ❌'
      : 'Image passed validation ✅';
  res.json({ result });
});

// ── Mock KYC & Credit Checks ──────────────────────────────────────────────
async function runKycCheck(buffer) {
  // Placeholder for an identity verification service
  return { passed: true };
}

async function fetchCreditScore(ssn) {
  // Placeholder for credit bureau integration
  const score = 650 + Math.floor(Math.random() * 101); // 650-750
  return { score };
}

// ── Intelligent Underwriting Helpers ───────────────────────────────────────
function parseDocumentBuffer(buffer) {
  // Stub OCR/NLP logic. In reality this would call a service like Textract.
  const text = buffer.toString('utf8');
  const fields = {};
  if (/income/i.test(text)) fields.income = 100000;
  if (/tax/i.test(text)) fields.taxes = 20000;
  return fields;
}

function advancedCreditScore(bureauScore, history) {
  let score = bureauScore;
  if (Array.isArray(history) && history.length) {
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    score += Math.round((avg - 650) / 10);
  }
  const explanation = `Base ${bureauScore} adjusted with ${history?.length || 0} historical points`;
  return { score, explanation };
}

function detectFraud(applicant) {
  const anomalies = [];
  if (applicant.address && /p\.o\. box/i.test(applicant.address)) {
    anomalies.push('PO boxes are suspicious');
  }
  if (applicant.income && applicant.income > 1000000) {
    anomalies.push('Income unusually high');
  }
  return { suspicious: anomalies.length > 0, anomalies };
}

// ── Loan Application Endpoints ─────────────────────────────────────────────
app.post('/api/loan-applications', upload.single('document'), async (req, res) => {
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
        submitted_at: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Insert application error:', error);
    return res.status(500).json({ message: 'Failed to save application' });
  }

  res.status(201).json({ application: data });
});

app.get('/api/loan-applications', async (req, res) => {
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

// ── Risk-Scoring Logic ─────────────────────────────────────────────────────
function calculateRiskScore({ amount, description, lastSubmittedAt }) {
  let score = 100;
  if (amount > 100000) score -= 20;
  if (description.length < 15) score -= 10;
  if (lastSubmittedAt) {
    const lastDate = new Date(lastSubmittedAt);
    const now = new Date();
    const diffInDays = (now - lastDate) / (1000 * 60 * 60 * 24);
    if (diffInDays < 7) score -= 15;
  }
  return Math.max(score, 0);
}

// ── Draw Request Submission ─────────────────────────────────────────────────
app.post('/api/draw-request', async (req, res) => {
  const { project, amount, description, project_number, property_location } = req.body;
  if (!project || !amount || !description || !project_number || !property_location) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // 1) Fetch the very last draw for this project to compute risk
  const { data: lastDraw, error: lastDrawError } = await supabase
    .from('draw_requests')
    .select('submitted_at')
    .eq('project', project)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastDrawError) {
    console.error('Error fetching last draw:', lastDrawError);
   // Continue without previous draw information
  }

  // 2) Compute risk score
  const riskScore = calculateRiskScore({
    amount,
    description,
    lastSubmittedAt: lastDraw?.submitted_at
  });

  // 3) Insert new draw entry
  const { data, error } = await supabase
    .from('draw_requests')
    .insert([{
      project,
      amount,
      description,
      project_number,
      property_location,
      status: 'submitted',
      risk_score: riskScore,
      submitted_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ message: 'Failed to submit draw request' });
  }

  console.log('📥 Submitted draw with risk score:', data.risk_score);
  res.status(200).json({ message: 'Draw request submitted!', data });
});

// ── Review/Approve Draw ─────────────────────────────────────────────────────
app.post('/api/review-draw', async (req, res) => {
  const { id, status, comment } = req.body;
  if (!id || !status) return res.status(400).json({ message: 'Missing id or status' });

  const updates = { status, reviewed_at: new Date().toISOString() };
  if (status === 'approved') updates.approved_at = new Date().toISOString();
  if (status === 'rejected') {
    updates.rejected_at = new Date().toISOString();
    updates.review_comment = comment || '';
  }

  const { data, error } = await supabase
    .from('draw_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update error:', error);
    return res.status(500).json({ message: 'Failed to update draw request' });
  }

  console.log('🔄 Updated draw request:', data);
  res.status(200).json({ message: 'Draw request updated', data });
});

// ── Get All Draws (flatten/alias fields) ────────────────────────────────────
app.get('/api/get-draws', async (req, res) => {
  const { data, error } = await supabase
    .from('draw_requests')
    .select(`
      id,
      project,
      amount,
      description,
      project_number,
      property_location,
      status,
      submitted_at    as submittedAt,
      reviewed_at     as reviewedAt,
      approved_at     as approvedAt,
      rejected_at     as rejectedAt,
      review_comment  as reviewComment,
      risk_score      as riskScore
    `)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Get draws error:', error);
    return res.status(500).json({ message: 'Failed to fetch draw requests' });
  }
  res.json({ draws: data });
});

// ── Upload & Verify Lien Waiver ───────────────────────────────────────────────
app.post('/api/upload-lien-waiver', upload.single('file'), async (req, res) => {
  const { draw_id, contractor_name, waiver_type } = req.body;
  if (!draw_id || !contractor_name || !waiver_type || !req.file) {
    return res.status(400).json({ message: 'Missing required fields or file' });
  }

  // 1) Upload file to Supabase Storage bucket “draw-inspections”
  const filePath = `lien-waivers/${draw_id}/${Date.now()}_${req.file.originalname}`;
  const { error: uploadError } = await supabase
    .storage
    .from('draw-inspections')
    .upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    return res.status(500).json({ message: 'File upload failed' });
  }
  const fileUrl = supabase
    .storage
    .from('draw-inspections')
    .getPublicUrl(filePath)
    .publicURL;

  // 2) Call AI-service stub (could parse PDF, etc.)
  const aiReport = await Promise.resolve({ errors: [], fields: {} }); // replace with real aiService.verifyLienWaiver
  const passed = aiReport.errors.length === 0;

  // 3) Insert record into lien_waivers table
  const { data, error } = await supabase
    .from('lien_waivers')
    .insert([{
      draw_id: parseInt(draw_id, 10),
      contractor_name,
      waiver_type,
      file_url: fileUrl,
      verified_at: new Date().toISOString(),
      verification_passed: passed,
      verification_report: aiReport
    }])
    .select()
    .single();

  if (error) {
    console.error('Insert lien waiver error:', error);
    return res.status(500).json({ message: 'Failed to save waiver' });
  }

  res.status(200).json({ message: 'Lien waiver uploaded', data });
});

// ── List All Lien Waivers for a Given Draw ─────────────────────────────────
app.get('/api/list-lien-waivers', async (req, res) => {
  const { draw_id } = req.query;
  if (!draw_id) return res.status(400).json({ message: 'Missing draw_id' });

  const { data, error } = await supabase
    .from('lien_waivers')
    .select('id, contractor_name, waiver_type, file_url, verified_at, verification_passed')
    .eq('draw_id', draw_id)
    .order('verified_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to list waivers' });
  res.json({ waivers: data });
});

// ── List Inspections by Draw or Project ─────────────────────────────────────
app.get('/api/list-inspections', async (req, res) => {
  const { draw_id, project_id } = req.query;
  if (!draw_id && !project_id) {
    return res.status(400).json({ message: 'Missing draw_id or project_id' });
  }

  let query = supabase
    .from('inspections')
    .select('id, inspection_date, notes, draw_id, project_id');

  if (draw_id) query = query.eq('draw_id', draw_id);
  if (project_id) query = query.eq('project_id', project_id);

  query = query.order('inspection_date', { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ message: 'Failed to list inspections' });
  res.json({ inspections: data });
});

// ── Create a Loan ───────────────────────────────────────────────────────────
app.post('/api/loans', async (req, res) => {
  const { borrower_name, amount, interest_rate, term_months, start_date } = req.body;
  if (!borrower_name || !amount || !interest_rate || !term_months || !start_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('loans')
    .insert([{ borrower_name, amount, interest_rate, term_months, start_date }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create loan' });
  res.status(201).json({ loan: data });
});

// ── List All Loans ──────────────────────────────────────────────────────────
app.get('/api/loans', async (req, res) => {
  const { data, error } = await supabase
    .from('loans')
    .select('id, borrower_name, amount, interest_rate, term_months, start_date, status, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to fetch loans' });
  res.json({ loans: data });
});

// ── Generate Amortization Schedule ──────────────────────────────────────────
app.post('/api/loans/:loanId/generate-schedule', async (req, res) => {
  const { loanId } = req.params;

  // Fetch loan details
  const { data: loan, error: loanErr } = await supabase
    .from('loans')
    .select('amount, interest_rate, term_months, start_date')
    .eq('id', loanId)
    .single();

  if (loanErr || !loan) return res.status(404).json({ message: 'Loan not found' });

  const P = parseFloat(loan.amount);
  const r = parseFloat(loan.interest_rate) / 100 / 12; // monthly rate
  const n = parseInt(loan.term_months, 10);
  const A = P * r / (1 - Math.pow(1 + r, -n)); // standard amortization formula

  const inserts = [];
  let balance = P;
  let date = new Date(loan.start_date);

  for (let i = 1; i <= n; i++) {
    const interestDue = balance * r;
    const principalDue = A - interestDue;
    balance -= principalDue;

    inserts.push({
      loan_id: parseInt(loanId, 10),
      due_date: date.toISOString().slice(0, 10),
      principal_due: principalDue,
      interest_due: interestDue,
      balance_after: balance
    });

    // Advance one month
    date.setMonth(date.getMonth() + 1);
  }

  const { data: scheduleData, error: insertErr } = await supabase
    .from('amortization_schedules')
    .insert(inserts)
    .select();

  if (insertErr) return res.status(500).json({ message: 'Failed to generate schedule' });
  res.json({ schedule: scheduleData });
});

// ── List Amortization Schedule ─────────────────────────────────────────────
app.get('/api/loans/:loanId/schedule', async (req, res) => {
  const { data, error } = await supabase
    .from('amortization_schedules')
    .select('*')
    .eq('loan_id', req.params.loanId)
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to fetch schedule' });
  res.json({ schedule: data });
});

// ── Record a Payment ───────────────────────────────────────────────────────
app.post('/api/loans/:loanId/payments', async (req, res) => {
   const { amount, date } = req.body;
  if (!amount || !date) {
    return res.status(400).json({ message: 'Missing amount or date' });
  }
  const { data: lastPayment, error: lastErr } = await supabase
    .from('payments')
    .select('remaining_balance')
    .eq('loan_id', req.params.loanId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) return res.status(500).json({ message: 'Failed to fetch last payment' });

  const prevBalance = lastPayment ? parseFloat(lastPayment.remaining_balance) : null;

  // If no previous payment, fetch loan principal
  const { data: loan, error: loanErr } = await supabase
    .from('loans')
    .select('amount')
    .eq('id', req.params.loanId)
    .single();

  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  let balance = prevBalance !== null ? prevBalance : parseFloat(loan.amount);

  // Get the loan’s interest rate for interest calculation
  const { data: loan2 } = await supabase
    .from('loans')
    .select('interest_rate')
    .eq('id', req.params.loanId)
    .single();

  const r = parseFloat(loan2.interest_rate) / 100 / 12;
  const interest = balance * r;
  const principal = Math.max(0, amount - interest);
  const remaining = balance - principal;

  const { data: paymentData, error: paymentErr } = await supabase
    .from('payments')
    .insert([{
      loan_id: parseInt(req.params.loanId, 10),
      date,
      amount,
      applied_principal: principal,
      applied_interest: interest,
      remaining_balance: remaining
    }])
    .select()
    .single();

  if (paymentErr) return res.status(500).json({ message: 'Failed to record payment' });
  res.status(201).json({ payment: paymentData });
});

// ── Escrow Routes ──────────────────────────────────────────────────────────
app.get('/api/escrows', async (req, res) => {
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance');

  if (error) return res.status(500).json({ message: 'Failed to fetch escrows' });
  res.json({ escrows: data });
});

app.get('/api/loans/:loanId/escrow', async (req, res) => {
  const { loanId } = req.params;
  if (isNaN(parseInt(loanId, 10))) {
    return res.status(400).json({ message: 'Invalid loan id' });
  }
  const { data, error } = await supabase
    .from('escrows')
    .select('loan_id, tax_amount, insurance_amount, escrow_balance')
    .eq('loan_id', loanId)
    .maybeSingle();

  if (error) return res.status(500).json({ message: 'Failed to fetch escrow' });
  if (!data) return res.status(404).json({ message: 'Escrow not found' });
  res.json({ escrow: data });
});

// ── Underwriting Tasks CRUD ───────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  const { data, error } = await supabase
    .from('underwriting_tasks')
    .select('*')
    .order('id');

  if (error) return res.status(500).json({ message: 'Failed to fetch tasks' });
  res.json({ tasks: data });
});

app.post('/api/tasks', async (req, res) => {
  const { assign, comment, status } = req.body;
  if (!assign) return res.status(400).json({ message: 'Missing assign' });

  const { data, error } = await supabase
    .from('underwriting_tasks')
    .insert([{ assign, comment: comment || '', status: status || 'Underwriting' }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create task' });
  res.status(201).json({ task: data });
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { assign, comment, status } = req.body;
  const updates = {};
  if (assign !== undefined) updates.assign = assign;
  if (comment !== undefined) updates.comment = comment;
  if (status !== undefined) updates.status = status;

  const { data, error } = await supabase
    .from('underwriting_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to update task' });
  res.json({ task: data });
});

// ── Document Generation from Templates ─────────────────────────────────────
const Handlebars = require('handlebars');
const PDFDocument = require('pdfkit');

app.post('/api/documents', async (req, res) => {
  const { template, data } = req.body;
  if (!template) return res.status(400).json({ message: 'Missing template' });

  const templatePath = path.join(__dirname, 'templates', `${template}.hbs`);
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ message: 'Template not found' });
  }

  const source = fs.readFileSync(templatePath, 'utf8');
  const compiled = Handlebars.compile(source);
  const text = compiled(data || {});

  const doc = new PDFDocument();
  const buffers = [];
  doc.on('data', b => buffers.push(b));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfData);
  });

  doc.text(text);
  doc.end();
});

// ── Virtual-Assistant Endpoint: `/api/ask` ───────────────────────────────────
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    // ← v4+ chat completion call:
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
         { role: 'system', content: 'You are Kontra AI, a customer care assistant for loan servicing.' },
        { role: 'user', content: question }
      ],
      functions,
      function_call: 'auto'
    });

    const msg = response.choices[0].message;

    // If OpenAI is instructing a function call, run it
    if (msg.function_call) {
      let result;
      if (msg.function_call.name === 'get_loans') {
        result = await get_loans();
      } else if (msg.function_call.name === 'get_draws') {
        result = await get_draws();
        } else if (msg.function_call.name === 'get_escrow_balance') {
        const args = JSON.parse(msg.function_call.arguments || '{}');
        result = await get_escrow_balance(args);
      } else if (msg.function_call.name === 'get_payoff_instructions') {
        result = await get_payoff_instructions();
      }
      return res.json({ assistant: msg, functionResult: result });
    }

    // Otherwise, return the assistant’s text
    res.json({ assistant: msg });
  } catch (err) {
    console.error('OpenAI error:', err);
    res.status(500).json({ error: 'AI service failed' });
  }
});

// ── Collections CRUD ──────────────────────────────────────────────────────
app.get('/api/collections', async (req, res) => {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) return res.status(500).json({ message: 'Failed to fetch collections' });
  res.json({ collections: data });
});

app.post('/api/collections', async (req, res) => {
  const { loan_id, amount, due_date, status } = req.body;
  if (!loan_id || !amount || !due_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('collections')
    .insert([{ loan_id, amount, due_date, status: status || 'pending' }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create collection entry' });
  res.status(201).json({ collection: data });
});

// ── Investor Reports CRUD ─────────────────────────────────────────────────-
app.get('/api/investor-reports', async (req, res) => {
  const { data, error } = await supabase
    .from('investor_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to fetch reports' });
  res.json({ reports: data });
});

app.post('/api/investor-reports', async (req, res) => {
  const { title, file_url } = req.body;
  if (!title || !file_url) return res.status(400).json({ message: 'Missing title or file_url' });

  const { data, error } = await supabase
    .from('investor_reports')
    .insert([{ title, file_url }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create report' });
  res.status(201).json({ report: data });
});

// ── Asset Management CRUD ─────────────────────────────────────────────────-
app.get('/api/assets', async (req, res) => {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ message: 'Failed to fetch assets' });
  res.json({ assets: data });
});

app.post('/api/assets', async (req, res) => {
  const { name, value, status } = req.body;
  if (!name) return res.status(400).json({ message: 'Missing name' });

  const { data, error } = await supabase
    .from('assets')
    .insert([{ name, value, status }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: 'Failed to create asset' });
  res.status(201).json({ asset: data });
});

// ── Intelligent Underwriting Endpoints ─────────────────────────────────────-
app.post('/api/parse-document', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });
  const fields = parseDocumentBuffer(req.file.buffer);
  res.json({ fields });
});

app.post('/api/credit-score', (req, res) => {
  const { bureauScore, history } = req.body || {};
  if (bureauScore === undefined) {
    return res.status(400).json({ message: 'Missing bureauScore' });
  }
  const result = advancedCreditScore(parseInt(bureauScore, 10), history || []);
  res.json(result);
});

app.post('/api/detect-fraud', (req, res) => {
  const result = detectFraud(req.body || {});
  res.json(result);
});

// ── Predictive Analytics Endpoints ─────────────────────────────────────────
const { forecastDelinquency, optimizeLoanOffer } = require('./analytics');

app.post('/api/predict-delinquency', (req, res) => {
  const { credit_score, months_since_origination, ltv, dti } = req.body || {};
  if (
    credit_score === undefined ||
    months_since_origination === undefined ||
    ltv === undefined ||
    dti === undefined
  ) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const result = forecastDelinquency({
    credit_score: parseFloat(credit_score),
    months_since_origination: parseFloat(months_since_origination),
    ltv: parseFloat(ltv),
    dti: parseFloat(dti)
  });
  res.json(result);
});

app.post('/api/optimize-loan-offer', (req, res) => {
  const { current_rate, current_term_months, credit_score, yield_target } = req.body || {};
  if (
    current_rate === undefined ||
    current_term_months === undefined ||
    credit_score === undefined ||
    yield_target === undefined
  ) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const offer = optimizeLoanOffer({
    current_rate: parseFloat(current_rate),
    current_term_months: parseInt(current_term_months, 10),
    credit_score: parseFloat(credit_score),
    yield_target: parseFloat(yield_target)
  });
  res.json({ offer });
});

// ── Voice Bot Endpoints ────────────────────────────────────────────────────
app.post('/api/voice', express.urlencoded({ extended: false }), handleVoice);
app.post('/api/voice/query', express.urlencoded({ extended: false }), handleVoiceQuery);

// ── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5050;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kontra API listening on port ${PORT}`);
  });
}

module.exports = app;
