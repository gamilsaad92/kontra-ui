const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const defaultRules = [
  { name: 'EHL disclosure', required: 'Equal Housing Lender' },
  { name: 'Old template', deprecated: '2019 Template' },
  { name: 'Placeholder', deprecated: '[INSERT CLAUSE]' }
];

function scanForCompliance(text, rules = defaultRules) {
  const issues = [];
  for (const rule of rules) {
    if (rule.required && !text.includes(rule.required)) {
      issues.push({ rule: rule.name, message: `Missing required text: ${rule.required}` });
    }
    if (rule.deprecated && text.includes(rule.deprecated)) {
      issues.push({ rule: rule.name, message: `Contains deprecated text: ${rule.deprecated}` });
    }
    if (rule.regex) {
      const re = new RegExp(rule.regex, 'i');
      if (re.test(text)) {
        issues.push({ rule: rule.name, message: `Flagged pattern: ${rule.regex}` });
      }
    }
  }
  return { issues };
}

async function gatherEvidence(loanId) {
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('loan_id', loanId);

  const { data: waivers } = await supabase
    .from('lien_waivers')
    .select('id, file_url, verified_at, verification_passed')
    .eq('loan_id', loanId);

  const { data: application } = await supabase
    .from('loan_applications')
    .select('*')
    .eq('id', loanId)
    .maybeSingle();

  return { notifications, waivers, application };
}

module.exports = { scanForCompliance, gatherEvidence };
