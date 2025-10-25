const { createClient } = require('@supabase/supabase-js');
const { notifyInApp } = require('../communications');
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

async function fetchInvestorRecipients() {
  const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'investor');
  return (data || []).map(entry => entry.user_id);
}

module.exports = async function predictTroubledRisk() {
  const { data: records } = await supabase
    .from('troubled_assets')
    .select('id, ai_notes, assets(id, name, predicted_risk)');
  const investorRecipients = await fetchInvestorRecipients();
  const alerts = [];

  for (const rec of records || []) {
    const asset_risk = rec.assets?.predicted_risk || 0;
    const predicted_risk = scoreTroubled({ asset_risk, notes: rec.ai_notes || '' });
    await supabase
      .from('troubled_assets')
      .update({ predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', rec.id);
       if (predicted_risk > 0.75) {
      alerts.push({
        id: rec.id,
        asset: rec.assets?.name || rec.assets?.id || rec.id,
        score: predicted_risk,
        notes: rec.ai_notes || ''
      });
    }
  }

  if (alerts.length && investorRecipients.length) {
    const headline = alerts
      .slice(0, 3)
      .map(alert => `${alert.asset} (${Math.round(alert.score * 100)}%)`)
      .join(', ');
    const message = `Troubled asset alert: ${headline}${alerts.length > 3 ? ' +' + (alerts.length - 3) + ' more' : ''}`;
    await Promise.all(
      investorRecipients.map(userId => notifyInApp(userId, message, '/investor/risk'))
    ); 
  }

  return {
    totalAnalyzed: records?.length || 0,
    highRiskTroubled: alerts,
    notifiedInvestors: investorRecipients
  };
};
