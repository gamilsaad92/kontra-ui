function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function score(listing, prefs = {}) {
  let s = 0;
  const dscrValue = safeNumber(listing.dscr);
  if (prefs.min_dscr && dscrValue !== null && dscrValue >= prefs.min_dscr) s += 10;
  else if (dscrValue !== null && dscrValue >= 1.2) s += 6;

  const ltvValue = safeNumber(listing.ltv);
  if (prefs.max_ltv && ltvValue !== null && ltvValue <= prefs.max_ltv) s += 10;
  else if (ltvValue !== null && ltvValue <= 70) s += 4;

  if (prefs.sectors?.includes(listing.sector)) s += 6;
  if (prefs.geographies?.includes(listing.geography)) s += 6;
  if (prefs.rate_types?.includes(listing.rate_type)) s += 4;
  
  const occupancy = safeNumber(listing.occupancy_rate);
  if (prefs.min_occupancy && occupancy !== null && occupancy >= prefs.min_occupancy) s += 5;
  else if (occupancy !== null && occupancy >= 90) s += 3;

  const dscrBuffer = safeNumber(listing?.marketplace_metrics?.dscrBuffer);
  if (dscrBuffer !== null) {
    if (prefs.min_dscr_buffer && dscrBuffer >= prefs.min_dscr_buffer) s += 6;
    else if (dscrBuffer > 0) s += Math.min(6, dscrBuffer * 4);
  }

  const noiMargin = safeNumber(listing?.marketplace_metrics?.noiMargin);
  if (noiMargin !== null) {
    if (prefs.min_noi_margin && noiMargin >= prefs.min_noi_margin) s += 5;
    else if (noiMargin > 0) s += 3;
  }

  if (Array.isArray(listing.borrower_kpis) && listing.borrower_kpis.length) {
    const positiveSignals = listing.borrower_kpis.filter(kpi => {
      const trend = typeof kpi.trend === 'string' ? kpi.trend.toLowerCase() : '';
      const delta = safeNumber(kpi.delta_bps ?? kpi.deltaBps ?? kpi.rateDeltaBps);
      if (trend === 'increase' || trend === 'up') return true;
      if ((trend === 'decrease' || trend === 'down') && typeof delta === 'number') {
        return delta < 0;
      }
      return false;
    });
    if (positiveSignals.length) {
      s += Math.min(8, positiveSignals.length * 2);
    }
    if (Array.isArray(prefs.focus_kpis) && prefs.focus_kpis.length) {
      const matchedFocus = listing.borrower_kpis.some(
        kpi => typeof kpi.name === 'string' && prefs.focus_kpis.includes(kpi.name)
      );
      if (matchedFocus) s += 4;
    }
  }

  if (prefs.cashflow_pref === 'stabilized' && noiMargin !== null && noiMargin >= 0) {
    s += 2;
  } else if (prefs.cashflow_pref === 'value_add' && noiMargin !== null && noiMargin < 0) {
    s += 2;
  }

  if (listing.marketplace_metrics?.occupancyStatus === 'stabilized') {
    s += 1;
  }

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
