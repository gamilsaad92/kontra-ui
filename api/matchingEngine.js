function score(listing, prefs = {}) {
  let s = 0;
  if (prefs.min_dscr && listing.dscr >= prefs.min_dscr) s += 10;
  if (prefs.max_ltv && listing.ltv && listing.ltv <= prefs.max_ltv) s += 10;
  if (prefs.sectors?.includes(listing.sector)) s += 6;
  if (prefs.geographies?.includes(listing.geography)) s += 6;
  if (prefs.rate_types?.includes(listing.rate_type)) s += 4;
  if (prefs.min_size && listing.par_amount >= prefs.min_size) s += 2;
  if (prefs.max_size && listing.par_amount <= prefs.max_size) s += 2;
  return s;
}

async function updateRecommendations(orgId) {
  const { supabase } = require('./db');

  // Fetch preferences for org
  const { data: prefRow } = await supabase
    .from('exchange_preferences')
    .select('preferences')
    .eq('organization_id', orgId)
    .single();
  const prefs = prefRow?.preferences || {};

  // Get active listings
  const { data: listings } = await supabase
    .from('exchange_listings')
    .select('*')
    .eq('status', 'listed');

  const recos = [];
  for (const listing of listings || []) {
    const scoreVal = score(listing, prefs);
    if (scoreVal > 0) {
      recos.push({
        organization_id: orgId,
        listing_id: listing.id,
        score: scoreVal
      });
    }
  }

  if (recos.length) {
    await supabase
      .from('exchange_recos')
      .upsert(recos, { onConflict: 'organization_id,listing_id' });
  }
  return recos;
}

module.exports = { score, updateRecommendations };
