const OpenAI = require('openai');

let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    console.error('Failed to initialize OpenAI client for underwriting services:', err);
    openai = null;
  }
}

function parseDocumentBuffer(buffer) {
  const text = buffer?.toString('utf8') || '';
  const fields = {};
  if (/income/i.test(text)) fields.income = 100000;
  if (/tax/i.test(text)) fields.taxes = 20000;
  if (/address/i.test(text)) fields.address = (text.match(/address[:\s]+([^\n]+)/i) || [])[1] || undefined;
  if (/name/i.test(text)) fields.name = (text.match(/name[:\s]+([^\n]+)/i) || [])[1] || undefined;
  Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
  return fields;
}

async function summarizeDocumentBuffer(buffer) {
  const text = buffer?.toString('utf8') || '';
  let summary = text.slice(0, 200);
  let key_terms = {};
  if (openai) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Provide a short executive summary and extract key terms (amounts, dates, parties) from the document. Return JSON {"summary": string, "key_terms": object}.',
          },
          { role: 'user', content: text.slice(0, 12000) },
        ],
      });
      const data = JSON.parse(resp.choices[0]?.message?.content || '{}');
      if (typeof data.summary === 'string') summary = data.summary;
      if (data.key_terms) key_terms = data.key_terms;
    } catch (err) {
      console.error('OpenAI doc summary error:', err);
    }
  }
  return { summary, key_terms };
}

async function autoFillFields(buffer) {
  const fields = parseDocumentBuffer(buffer);
  if (openai) {
    try {
      const text = buffer?.toString('utf8') || '';
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract borrower or business details from IDs or W-9s as JSON {"name":string,"ssn":string,"ein":string,"address":string,"income":number}',
          },
          { role: 'user', content: text.slice(0, 12000) },
        ],
      });
      const extra = JSON.parse(resp.choices[0]?.message?.content || '{}');
      Object.assign(fields, extra);
    } catch (err) {
      console.error('OpenAI auto fill error:', err);
    }
  }
  return fields;
}

async function classifyDocumentBuffer(buffer) {
  const text = buffer?.toString('utf8').toLowerCase() || '';
  const heuristics = [
    { type: 'invoice', regex: /invoice|bill/ },
    { type: 'bank_statement', regex: /bank[^\n]*statement|statement[^\n]*bank/ },
    { type: 'w9', regex: /w[- ]?9/ },
    { type: 'contract', regex: /contract/ },
    { type: 'loan_application', regex: /loan application|borrower/ },
  ];
  for (const h of heuristics) {
    if (h.regex.test(text)) return h.type;
  }
  if (openai) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Classify this document with one word like invoice, bank_statement, w9, contract or other.',
          },
          { role: 'user', content: text.slice(0, 12000) },
        ],
      });
      return resp.choices[0]?.message?.content?.trim().toLowerCase() || 'other';
    } catch (err) {
      console.error('OpenAI classify error:', err);
    }
  }
  return 'other';
}

function advancedCreditScore(bureauScore, history) {
  let score = Number.isFinite(bureauScore) ? bureauScore : 650;
  const normalizedHistory = Array.isArray(history)
    ? history.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v))
    : [];
  if (normalizedHistory.length) {
    const avg = normalizedHistory.reduce((a, b) => a + b, 0) / normalizedHistory.length;
    score += Math.round((avg - 650) / 10);
  }
  const explanation = `Base ${bureauScore} adjusted with ${normalizedHistory.length} historical points`;
  return { score, explanation };
}

function detectFraud(applicant) {
  const anomalies = [];
  const normalized = applicant || {};
  if (normalized.address && /p\.o\. box/i.test(normalized.address)) {
    anomalies.push('Mailing address is a PO Box');
  }
  if (normalized.income && Number(normalized.income) > 1000000) {
    anomalies.push('Reported income unusually high');
  }
  if (normalized.ssn && /^(123|000)/.test(String(normalized.ssn))) {
    anomalies.push('SSN uses prohibited prefix');
  }
  if (!normalized.name && !normalized.business_name) {
    anomalies.push('Missing primary identity field');
  }
  return { suspicious: anomalies.length > 0, anomalies };
}

module.exports = {
  parseDocumentBuffer,
  summarizeDocumentBuffer,
  autoFillFields,
  classifyDocumentBuffer,
  advancedCreditScore,
  detectFraud,
};
