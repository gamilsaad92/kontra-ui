const {
  createInstitutionalOpenAIClient,
  safeAIErrorMetadata,
} = require('../lib/openaiClient');
const { extractDocxText } = require('../lib/docxText');

let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = createInstitutionalOpenAIClient();
  } catch (err) {
      console.error('Failed to initialize OpenAI client for underwriting services:', safeAIErrorMetadata(err));
    openai = null;
  }
}

function documentTextFromBuffer(buffer) {
  const docxText = extractDocxText(buffer);
  return docxText || buffer?.toString('utf8') || '';
}

function redactSensitiveIdentifiers(text) {
  return String(text || '')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
    .replace(/\b\d{2}-\d{7}\b/g, '[REDACTED_EIN]');
}

function parseDocumentBuffer(buffer) {
  const text = documentTextFromBuffer(buffer);
  const fields = {};
  if (/income/i.test(text)) fields.income = 100000;
  if (/tax/i.test(text)) fields.taxes = 20000;
  if (/address/i.test(text)) fields.address = (text.match(/address[:\s]+([^\n]+)/i) || [])[1] || undefined;
  if (/name/i.test(text)) fields.name = (text.match(/name[:\s]+([^\n]+)/i) || [])[1] || undefined;
  Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
  return fields;
}

async function summarizeDocumentBuffer(buffer) {
       const text = redactSensitiveIdentifiers(documentTextFromBuffer(buffer));
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
      console.error('OpenAI doc summary error:', safeAIErrorMetadata(err));
    }
  }
  return { summary, key_terms };
}

async function autoFillFields(buffer) {
  const fields = parseDocumentBuffer(buffer);
  if (openai) {
    try {
      const text = redactSensitiveIdentifiers(documentTextFromBuffer(buffer));
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Extract non-sensitive borrower or business details as JSON {"name":string,"address":string,"income":number}. Do not extract, infer, or return SSNs, EINs, tax IDs, account numbers, or other identity numbers.',
          },
          { role: 'user', content: text.slice(0, 12000) },
        ],
      });
      const extra = JSON.parse(resp.choices[0]?.message?.content || '{}');
      for (const key of ['name', 'address', 'income']) {
        if (extra[key] !== undefined && extra[key] !== null) fields[key] = extra[key];
      }
    } catch (err) {
      console.error('OpenAI auto fill error:', safeAIErrorMetadata(err));
    }
  }
  return fields;
}

async function classifyDocumentBuffer(buffer) {
  const text = documentTextFromBuffer(buffer).toLowerCase();
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
      console.error('OpenAI classify error:', safeAIErrorMetadata(err));
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
