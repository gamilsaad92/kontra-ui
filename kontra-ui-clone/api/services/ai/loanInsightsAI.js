const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function computeConfidence(snapshot) {
  let score = 0.55;
  if (snapshot?.loan) score += 0.1;
  if (snapshot?.metrics?.dscr !== null) score += 0.05;
  if (snapshot?.metrics?.noi_target !== null) score += 0.05;
  if (snapshot?.metrics?.occupancy_rate !== null) score += 0.05;
  if (Array.isArray(snapshot?.payments) && snapshot.payments.length > 0) score += 0.05;
  if (Array.isArray(snapshot?.documents?.present) && snapshot.documents.present.length > 0) score += 0.05;
  if (Array.isArray(snapshot?.draws) && snapshot.draws.length > 0) score += 0.05;
  if (Array.isArray(snapshot?.inspections) && snapshot.inspections.length > 0) score += 0.05;
  return Math.min(0.9, Math.max(0.2, Number(score.toFixed(2))));
}

function buildSummaryLines(snapshot, exceptions, confidence) {
  const loan = snapshot?.loan || {};
  const metrics = snapshot?.metrics || {};
  const lines = [];
  const identifier = loan.loan_number || loan.id || 'this loan';

  lines.push(`Loan ${identifier} for ${loan.borrower_name || 'borrower'} is ${loan.status || 'active'}.`);

  if (metrics.dscr !== null) {
    const target = metrics.target_dscr !== null ? ` vs target ${metrics.target_dscr}` : '';
    lines.push(`DSCR is ${formatNumber(metrics.dscr)}${target}.`);
  }

  if (metrics.actual_noi !== null || metrics.noi_target !== null) {
    lines.push(
      `NOI is ${formatNumber(metrics.actual_noi) ?? 'N/A'} against target ${
        formatNumber(metrics.noi_target) ?? 'N/A'
      }.`
    );
  }

  if (metrics.occupancy_rate !== null) {
    lines.push(`Occupancy is ${formatNumber(metrics.occupancy_rate)}%.`);
  }

  if (metrics.escrow_balance !== null) {
    lines.push(`Escrow balance is ${formatNumber(metrics.escrow_balance, 0)}.`);
  }

  if (loan.maturity_date) {
    lines.push(`Maturity date is ${formatDate(loan.maturity_date)}.`);
  }

  if (exceptions.length) {
    lines.push(`Exceptions flagged: ${exceptions.map((ex) => ex.code).join(', ')}.`);
  } else {
    lines.push('No rule-based exceptions flagged in the latest snapshot.');
  }

  if (confidence < 0.55) {
    lines.push('Needs human review due to limited servicing data.');
  }

  return lines;
}

function buildRecommendedActions(snapshot, exceptions) {
  const actions = exceptions.map((ex) => ex.recommended_next_step).filter(Boolean);
  const missingDocs = snapshot?.documents?.missing || [];
  if (missingDocs.length) {
    actions.push(`Request missing documents: ${missingDocs.join(', ')}.`);
  }
  if (!actions.length) {
    actions.push('Continue monitoring upcoming payments, inspections, and escrow activity.');
  }
  return actions.slice(0, 6);
}

function buildWatchlistDraft(snapshot, exceptions) {
  const loan = snapshot?.loan || {};
  const metrics = snapshot?.metrics || {};
  const lines = [
    `Watchlist note for loan ${loan.loan_number || loan.id || ''}`.trim(),
    `Borrower: ${loan.borrower_name || 'N/A'}.`,
    exceptions.length
      ? `Exceptions: ${exceptions.map((ex) => ex.code).join(', ')}.`
      : 'No exceptions flagged; monitor for updates.',
    metrics.dscr !== null ? `DSCR: ${metrics.dscr}.` : null,
    metrics.occupancy_rate !== null ? `Occupancy: ${metrics.occupancy_rate}%.` : null,
    loan.maturity_date ? `Maturity: ${formatDate(loan.maturity_date)}.` : null
  ].filter(Boolean);

  const evidence = [];
  if (metrics.dscr !== null) evidence.push('loan_dscr_metrics.dscr');
  if (metrics.noi_target !== null || metrics.actual_noi !== null) {
    evidence.push('loan_performance_fees.noi_target/actual_noi');
  }
  if (metrics.occupancy_rate !== null) evidence.push('assets.occupancy');
  if (Array.isArray(snapshot?.payments) && snapshot.payments.length > 0) {
    evidence.push('payments.date/amount');
  }
  if (Array.isArray(snapshot?.draws) && snapshot.draws.length > 0) {
    evidence.push('draw_requests.status/submitted_at');
  }

  return {
    text: lines.join(' '),
    evidence
  };
}

function buildEmailDraft(snapshot, purpose) {
  const loan = snapshot?.loan || {};
  const documents = snapshot?.documents || { missing: [] };
  const purposeMap = {
    missing_docs: {
      subject: `Documents needed for loan ${loan.loan_number || loan.id}`,
      intro: 'We are missing a few required documents to keep servicing current.'
    },
    draw_followup: {
      subject: `Draw follow-up for loan ${loan.loan_number || loan.id}`,
      intro: 'We need a quick update on the pending draw request.'
    },
    covenant_breach: {
      subject: `Covenant review for loan ${loan.loan_number || loan.id}`,
      intro: 'Recent servicing metrics indicate a covenant review is required.'
    },
    maturity: {
      subject: `Maturity planning for loan ${loan.loan_number || loan.id}`,
      intro: 'We are within the maturity window and need your refinance or extension plan.'
    }
  };

  const config = purposeMap[purpose] || purposeMap.missing_docs;
  const checklist = [];

  if (purpose === 'missing_docs' && documents.missing.length) {
    checklist.push(...documents.missing);
  }
  if (purpose === 'draw_followup') {
    checklist.push('Updated draw budget', 'Latest inspection report', 'Current contractor invoices');
  }
  if (purpose === 'covenant_breach') {
    checklist.push('Updated rent roll', 'Trailing 12-month financials', 'Operating statement');
  }
  if (purpose === 'maturity') {
    checklist.push('Refinance timeline', 'Extension request letter', 'Updated property valuation');
  }

  const body = [
    `Hello ${loan.borrower_name || 'team'},`,
    '',
    config.intro,
    'Please send the following items:',
    ...checklist.map((item) => `- ${item}`),
    '',
    'Thank you,',
    'Servicing Team'
  ].join('\n');

  return {
    subject: config.subject,
    body,
    checklist
  };
}

async function generateWithOpenAI(snapshot, exceptions) {
  const prompt = `You are an internal servicing analyst. Use ONLY the data in the JSON to produce a summary (5-10 lines) and recommended actions (bullets). Do not invent numbers. If data is missing, state "needs human review". JSON: ${JSON.stringify({
    loan: snapshot.loan,
    metrics: snapshot.metrics,
    documents: snapshot.documents,
    payments: snapshot.payments,
    draws: snapshot.draws,
    inspections: snapshot.inspections,
    exceptions
  })}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2
  });

  const text = response.choices?.[0]?.message?.content?.trim() || '';
  return text;
}

async function generateLoanInsights(snapshot, exceptions, options = {}) {
  const confidence = computeConfidence(snapshot);
  const summaryLines = buildSummaryLines(snapshot, exceptions, confidence);
  const recommended_actions = buildRecommendedActions(snapshot, exceptions);

  let summary = summaryLines.join('\n');
  if (openai && options.useOpenAI) {
    try {
      summary = await generateWithOpenAI(snapshot, exceptions);
    } catch (error) {
      summary = summaryLines.join('\n');
    }
  }

  const result = {
    summary,
    recommended_actions,
    confidence
  };

  if (options.includeDrafts) {
    result.draft_watchlist = buildWatchlistDraft(snapshot, exceptions);
    result.draft_email = buildEmailDraft(snapshot, options.emailPurpose || 'missing_docs');
  }

  return result;
}

module.exports = {
  generateLoanInsights,
  buildWatchlistDraft,
  buildEmailDraft
};
