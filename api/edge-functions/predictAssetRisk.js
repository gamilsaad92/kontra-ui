const { createClient } = require('@supabase/supabase-js');
const { sendEmail, notifyInApp } = require('../communications');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function scoreAsset({ loan_balance = 0, comps = 0, delinquencies = 0 }) {
  const logit = -4 + 0.00001 * loan_balance - 0.1 * comps + 0.5 * delinquencies;
  const score = logistic(logit);
  const reasons = [];
  if (loan_balance > 500000) reasons.push('high loan balance');
  if (comps < 0) reasons.push('negative comps');
  if (delinquencies > 0) reasons.push(`${delinquencies} delinquencies`);
  const explanation =
    reasons.length > 0
      ? `Higher risk due to ${reasons.join(', ')}`
      : 'Low risk based on inputs';
  return { score: parseFloat(score.toFixed(4)), explanation };
}

async function fetchInvestorRecipients() {
  const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'investor');
  return (data || []).map(entry => entry.user_id);
}

module.exports = async function predictAssetRisk() {
  const { data: assets } = await supabase.from('assets').select('id, data_json, name, value');
  const investorRecipients = await fetchInvestorRecipients();
  const buckets = { low: 0, medium: 0, high: 0 };
  const alerts = [];

  for (const asset of assets || []) {
    let data;
    try {
      data = typeof asset.data_json === 'string' ? JSON.parse(asset.data_json) : asset.data_json || {};
    } catch (err) {
      console.error('Failed to parse data_json for asset', asset.id, err);
      continue;
    }
   const { score: predicted_risk, explanation } = scoreAsset({
      loan_balance: data.loan_balance,
      comps: data.comps,
      delinquencies: data.delinquencies
    });

   if (predicted_risk >= 0.8) {
      alerts.push({
        id: asset.id,
        name: asset.name || asset.id,
        score: predicted_risk,
        explanation,
        value: data.value || asset.value || null
      });
      console.log('⚠️ High risk asset', asset.id, 'score:', predicted_risk, explanation);
    }
    if (predicted_risk > 0.9) {
      await sendEmail('alerts@kontra.com', 'High risk asset', 'Asset ' + asset.id + ' risk ' + predicted_risk);
    }

    if (predicted_risk > 0.7) {
      buckets.high += 1;
    } else if (predicted_risk > 0.4) {
      buckets.medium += 1;
    } else {
      buckets.low += 1;
    }
    
    await supabase
      .from('assets')
      .update({ predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', asset.id);
  }

 if (alerts.length && investorRecipients.length) {
    const headlineAssets = alerts
      .slice(0, 3)
      .map(alert => `${alert.name} (${Math.round(alert.score * 100)}%)`)
      .join(', ');
    const message = `High risk asset alert: ${headlineAssets}${alerts.length > 3 ? ' +' + (alerts.length - 3) + ' more' : ''}`;
    await Promise.all(
      investorRecipients.map(userId =>
        notifyInApp(userId, message, '/investor/risk')
      )
    );
  }

  return {
    totalAnalyzed: assets?.length || 0,
    buckets,
    highRiskAssets: alerts,
    notifiedInvestors: investorRecipients
  };
};
