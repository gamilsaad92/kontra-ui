/**
 * AI Document Intelligence Router — /api/ai/*
 *
 * Uses OpenAI GPT-4o to power document analysis, extraction, and portfolio briefs.
 * Falls back gracefully when the API key is not set.
 *
 * Endpoints:
 *   POST /api/ai/analyze          — classify + extract metrics from any CRE document
 *   POST /api/ai/portfolio-brief  — generate portfolio-level AI summary
 *   GET  /api/ai/loan-brief/:id   — per-loan AI brief from Supabase data
 */

const express  = require('express');
const multer   = require('multer');
const OpenAI   = require('openai');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

router.use(authenticate);

// ── Shared AI call helper ─────────────────────────────────────────────────────
async function callGPT(systemPrompt, userContent, jsonMode = true) {
  if (!openai) throw new Error('OpenAI API key not configured');
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    max_tokens: 1200,
    response_format: jsonMode ? { type: 'json_object' } : undefined,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userContent },
    ],
  });
  const text = resp.choices[0]?.message?.content || '{}';
  return jsonMode ? JSON.parse(text) : text;
}

// ── POST /api/ai/analyze ──────────────────────────────────────────────────────
// Accept: multipart file upload OR JSON body { text }
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    let rawText = '';

    if (req.file) {
      // Try to read as UTF-8 text (works for CSV, Excel exported as CSV, plain text)
      const buf = req.file.buffer;
      const sample = buf.slice(0, Math.min(buf.length, 12000)).toString('utf8');
      // Strip high-ratio binary content
      const nonPrint = sample.replace(/[\t\n\r\x20-\x7E]/g, '').length;
      if (nonPrint / sample.length < 0.3) {
        rawText = sample;
      } else {
        // Binary (PDF, Excel .xlsx) — return structured placeholder with notice
        return res.json({
          doc_type:  'Binary / Unreadable',
          summary:   'File received but binary content (PDF, .xlsx) cannot be read as text. Please paste the text content or export as CSV/text.',
          metrics:   {},
          covenants: [],
          risk_flags:[],
          recommendations: [],
          notice:    'For full AI extraction, paste your document text directly or use a text-based format.',
          raw_filename: req.file.originalname,
        });
      }
    } else if (req.body?.text) {
      rawText = String(req.body.text).slice(0, 12000);
    } else {
      return res.status(400).json({ error: 'Provide a file upload or text body.' });
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Document appears to be empty.' });
    }

    const systemPrompt = `You are a senior CRE (Commercial Real Estate) loan analyst and underwriter.
Analyze the provided document excerpt and return a JSON object with the following structure:
{
  "doc_type": string (one of: "Income Statement", "Rent Roll", "Operating Statement", "Covenant Certificate", "Lease Abstract", "Draw Request", "Inspection Report", "Other"),
  "summary": string (2-3 sentence plain English summary of the document's key findings),
  "metrics": {
    "dscr":       number | null,
    "noi":        number | null  (annual net operating income in dollars),
    "occupancy":  number | null  (percentage 0-100),
    "gross_revenue": number | null,
    "total_expenses": number | null,
    "net_income": number | null
  },
  "covenants": [
    { "name": string, "threshold": string, "actual": string, "status": "compliant"|"breach"|"watch" }
  ],
  "risk_flags": string[],
  "recommendations": string[]
}
Extract numeric values from the document. If a value cannot be determined, use null.
Return only valid JSON. No extra text.`;

    const result = await callGPT(systemPrompt, `Document content:\n\n${rawText}`);

    return res.json({
      ...result,
      raw_filename: req.file?.originalname || 'pasted-text',
    });
  } catch (err) {
    console.error('[ai/analyze]', err?.message);
    // Return a graceful fallback so the UI still works
    return res.json({
      doc_type: 'Unknown',
      summary:  'AI analysis is temporarily unavailable. Your document has been received.',
      metrics:  {},
      covenants:[],
      risk_flags:[],
      recommendations: ['Re-submit when AI service is available.'],
      notice:   err?.message || 'AI unavailable',
    });
  }
});

// ── POST /api/ai/portfolio-brief ──────────────────────────────────────────────
router.post('/portfolio-brief', async (req, res) => {
  try {
    const { data: loans } = await supabase
      .from('loans')
      .select('id, title, status, borrower_name, interest_rate, amount, data')
      .limit(20);

    if (!loans || loans.length === 0) {
      return res.json({ brief: 'No loan data available for portfolio analysis.', signals: [], recommendations: [] });
    }

    // Build a compact portfolio snapshot for the prompt
    const snapshot = loans.map(l => {
      const d = l.data || {};
      return {
        ref:       d.loan_ref      || `LN-${l.id}`,
        property:  d.property_name || l.title || 'Unknown',
        type:      d.property_type || 'Commercial',
        balance:   d.current_balance || Number(l.amount) || 0,
        rate:      Number(l.interest_rate) || 0,
        status:    l.status,
        dscr:      d.dscr  || null,
        ltv:       d.ltv   || null,
        delinq_days: d.delinquency_days || 0,
      };
    });

    const systemPrompt = `You are a senior CRE portfolio manager reviewing a loan portfolio.
Return a JSON object with this structure:
{
  "brief": string (3-4 sentence executive summary of portfolio health),
  "portfolio_score": number (1-100 overall health score),
  "signals": [
    { "type": "positive"|"negative"|"watch", "message": string }
  ],
  "recommendations": string[],
  "watchlist": [
    { "loan_ref": string, "reason": string }
  ]
}
Be specific, reference actual loan refs and metrics where relevant.
Return only valid JSON.`;

    const result = await callGPT(
      systemPrompt,
      `Portfolio snapshot (${loans.length} loans):\n${JSON.stringify(snapshot, null, 2)}`
    );

    return res.json(result);
  } catch (err) {
    console.error('[ai/portfolio-brief]', err?.message);
    return res.json({
      brief: 'Portfolio analysis is temporarily unavailable.',
      portfolio_score: null,
      signals: [],
      recommendations: [],
      watchlist: [],
    });
  }
});

// ── GET /api/ai/loan-brief/:id ────────────────────────────────────────────────
router.get('/loan-brief/:id', async (req, res) => {
  try {
    const loanId = parseInt(req.params.id, 10);
    const { data: loan } = await supabase
      .from('loans')
      .select('*')
      .eq('id', loanId)
      .single();

    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    const d = loan.data || {};
    const prompt = `Loan: ${d.loan_ref || `LN-${loan.id}`}
Property: ${d.property_name || loan.title || 'Unknown'}
Type: ${d.property_type || 'Commercial'}
Balance: $${Number(d.current_balance || loan.amount || 0).toLocaleString()}
Rate: ${loan.interest_rate}%
Status: ${loan.status}
DSCR: ${d.dscr || 'N/A'}
LTV: ${d.ltv || 'N/A'}%
Delinquency days: ${d.delinquency_days || 0}
Maturity: ${d.maturity_date || 'Unknown'}`;

    const systemPrompt = `You are a CRE loan analyst. Given the loan details, return a JSON object:
{
  "risk_label": "Low"|"Medium"|"High"|"Critical",
  "summary": string (2-3 sentence brief),
  "key_metrics": [{ "label": string, "value": string, "flag": boolean }],
  "watch_items": string[],
  "recommended_actions": string[]
}
Return only valid JSON.`;

    const result = await callGPT(systemPrompt, prompt);
    return res.json(result);
  } catch (err) {
    console.error('[ai/loan-brief]', err?.message);
    return res.json({
      risk_label: 'Unknown',
      summary: 'AI brief temporarily unavailable.',
      key_metrics: [], watch_items: [], recommended_actions: [],
    });
  }
});

module.exports = router;
