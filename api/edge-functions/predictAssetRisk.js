const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../communications');
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

module.exports = async function predictAssetRisk() {
  const { data: assets } = await supabase
    .from('assets')
    .select('id, data_json');

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

    if (predicted_risk > 0.8) {
       console.log('⚠️ High risk asset', asset.id, 'score:', predicted_risk, explanation);
    }
    if (predicted_risk > 0.9) { await sendEmail('alerts@kontra.com', 'High risk asset', 'Asset ' + asset.id + ' risk ' + predicted_risk); }
    
    await supabase
      .from('assets')
      .update({ predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', asset.id);
  }

  return new Response('Asset risks scored');
};
