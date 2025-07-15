const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function scoreTroubled({ asset_risk = 0, notes = '' }) {
  let score = -2 + 2 * asset_risk;
  const text = notes.toLowerCase();
  if (/foreclosure|default/.test(text)) score += 1;
  if (/violation|code/.test(text)) score += 0.8;
  if (/boarded|abandon|neglect/.test(text)) score += 0.8;
  if (/lawsuit|litigation/.test(text)) score += 1;
  return parseFloat(logistic(score).toFixed(4));
}

module.exports = async function predictTroubledRisk() {
  const { data: records } = await supabase
    .from('troubled_assets')
    .select('id, ai_notes, assets(id, predicted_risk)');

  for (const rec of records || []) {
    const asset_risk = rec.assets?.predicted_risk || 0;
    const predicted_risk = scoreTroubled({ asset_risk, notes: rec.ai_notes || '' });
    await supabase
      .from('troubled_assets')
      .update({ predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', rec.id);
  }

  return new Response('Troubled asset risks scored');
};
