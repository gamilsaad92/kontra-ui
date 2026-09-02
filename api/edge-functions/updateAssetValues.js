const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchLatestValue(assetId) {
  // In production this would query an external valuation service
  return { value: Math.floor(Math.random() * 1000000) };
}

module.exports = async function updateAssetValues() {
  const { data: assets } = await supabase.from('assets').select('id');
  const updates = await Promise.all(
    (assets || []).map(async asset => {
      const { value } = await fetchLatestValue(asset.id);
      return { id: asset.id, value, updated_at: new Date().toISOString() };
    })
  );
  if (updates.length) {
    await supabase.from('assets').upsert(updates);
  }
  return new Response('Asset values updated');
};
