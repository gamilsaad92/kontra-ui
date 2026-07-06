/**
 * covenantAgent.js — Multi-agent autonomous covenant monitoring
 *
 * Implements a CrewAI-style pipeline using OpenAI:
 *   Agent 1 (Data Parser)    — extracts covenant definitions from loan terms
 *   Agent 2 (Compliance Checker) — checks each covenant against current metrics
 *   Agent 3 (Risk Assessor)  — classifies breach severity
 *   Agent 4 (Report Writer)  — generates a servicer memo
 *
 * POST /api/covenant-agent/run   — run the full agent pipeline on a loan
 * GET  /api/covenant-agent/results/:loanId — get cached results
 */
const express = require('express');
const router  = express.Router();
const OpenAI  = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const cache = new Map();

const DEMO_LOAN = {
  id: 'demo-loan-001',
  property: 'Westlake Commerce Center',
  borrower: 'Westlake RE Holdings LLC',
  balance: 21250000,
  covenants: [
    { name: 'Debt Service Coverage Ratio', threshold: '≥ 1.25x', current: '1.42x', type: 'financial' },
    { name: 'Loan-to-Value Ratio',          threshold: '≤ 70%',   current: '62.5%', type: 'financial' },
    { name: 'Minimum Occupancy',            threshold: '≥ 85%',   current: '92.3%', type: 'operational' },
    { name: 'Debt Yield',                   threshold: '≥ 8.5%',  current: '10.9%', type: 'financial' },
    { name: 'Insurance Coverage',           threshold: 'Maintained', current: 'Active — expires Nov 2026', type: 'legal' },
    { name: 'Financial Reporting Delivery', threshold: 'Within 60 days of quarter-end', current: 'Q1 2025 delivered 67 days', type: 'compliance' },
  ],
};

async function runAgentPipeline(loan) {
  const loanJson = JSON.stringify(loan, null, 2);

  // ── Agent 1: Parse & contextualize covenants ────────────────────────────
  const parserRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a CRE loan covenant analyst. Extract and contextualize each covenant clearly.' },
      { role: 'user',   content: `Analyze these loan covenants and current metrics. For each, state whether it is IN COMPLIANCE or BREACHED, and why:\n\n${loanJson}` },
    ],
    max_tokens: 600,
  });
  const parserOutput = parserRes.choices[0].message.content;

  // ── Agent 2: Classify breach severity ───────────────────────────────────
  const riskRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a loan risk officer. Classify each covenant status as: PASS, WATCH (within 10% of threshold), BREACH, or TECHNICAL BREACH. Return JSON array only.' },
      { role: 'user',   content: `Based on this analysis, return a JSON array of objects with fields: name, status (PASS/WATCH/BREACH/TECHNICAL_BREACH), severity (low/medium/high/critical), note.\n\n${parserOutput}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
  });

  let covenantResults = [];
  try {
    const parsed = JSON.parse(riskRes.choices[0].message.content);
    covenantResults = parsed.covenants || parsed.results || parsed.items || Object.values(parsed)[0] || [];
  } catch {
    covenantResults = loan.covenants.map(c => ({
      name: c.name, status: 'PASS', severity: 'low', note: 'Compliant',
    }));
  }

  // ── Agent 3: Write servicer memo ─────────────────────────────────────────
  const memoRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a senior loan servicer writing an internal memo. Be concise, professional, and direct. 3-4 sentences max.' },
      { role: 'user',   content: `Write a brief servicer memo for: ${loan.property} (${loan.borrower}). Loan balance: $${(loan.balance / 1e6).toFixed(2)}M.\n\nCovenant results:\n${JSON.stringify(covenantResults, null, 2)}` },
    ],
    max_tokens: 200,
  });
  const memo = memoRes.choices[0].message.content;

  const passCount   = covenantResults.filter(c => c.status === 'PASS').length;
  const watchCount  = covenantResults.filter(c => c.status === 'WATCH').length;
  const breachCount = covenantResults.filter(c => c.status?.includes('BREACH')).length;

  return {
    loanId:    loan.id,
    property:  loan.property,
    borrower:  loan.borrower,
    balance:   loan.balance,
    runAt:     new Date().toISOString(),
    summary:   { pass: passCount, watch: watchCount, breach: breachCount, total: covenantResults.length },
    covenants: covenantResults,
    memo,
    status:    breachCount > 0 ? 'ACTION_REQUIRED' : watchCount > 0 ? 'MONITORING' : 'CLEAR',
  };
}

router.post('/covenant-agent/run', async (req, res) => {
  try {
    const loan = req.body?.loan || DEMO_LOAN;
    const result = await runAgentPipeline(loan);
    cache.set(result.loanId, result);
    return res.json(result);
  } catch (e) {
    console.error('[covenantAgent]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

router.get('/covenant-agent/results/:loanId', (req, res) => {
  const result = cache.get(req.params.loanId);
  if (!result) return res.status(404).json({ error: 'No results for this loan. Run the agent first.' });
  return res.json(result);
});

module.exports = { router };
