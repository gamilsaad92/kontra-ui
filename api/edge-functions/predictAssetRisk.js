const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function scoreAsset({ loan_balance = 0, comps = 0, delinquencies = 0 }) {
  // Extremely naive scoring heuristic
  const score = logistic(
    -4 + 0.00001 * loan_balance - 0.1 * comps + 0.5 * delinquencies
  );
  return parseFloat(score.toFixed(4));
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
    const predicted_risk = scoreAsset({
      loan_balance: data.loan_balance,
      comps: data.comps,
      delinquencies: data.delinquencies
    });

    if (predicted_risk > 0.8) {
      console.log('⚠️ High risk asset', asset.id, 'score:', predicted_risk);
    }

    await supabase
      .from('assets')
      .update({ predicted_risk, updated_at: new Date().toISOString() })
      .eq('id', asset.id);
  }

  return new Response('Asset risks scored');
};
