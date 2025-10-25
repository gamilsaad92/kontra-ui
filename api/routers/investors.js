const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { supabase } = require('../db');
const { isFeatureEnabled } = require('../featureFlags');

const router = express.Router();

router.use(authenticate);

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function bucketize(rows, key) {
  const buckets = { low: 0, medium: 0, high: 0 };
  (rows || []).forEach(row => {
    const score = toNumber(row?.[key]);
    if (score > 0.7) {
      buckets.high += 1;
    } else if (score > 0.4) {
      buckets.medium += 1;
    } else {
      buckets.low += 1;
    }
  });
  return buckets;
}

function combineBuckets(...bucketList) {
  return bucketList.reduce(
    (acc, bucket) => ({
      low: acc.low + (bucket?.low || 0),
      medium: acc.medium + (bucket?.medium || 0),
      high: acc.high + (bucket?.high || 0)
    }),
    { low: 0, medium: 0, high: 0 }
  );
}

function toDonutBuckets(buckets) {
  return [
    { label: 'Low', value: buckets.low },
    { label: 'Medium', value: buckets.medium },
    { label: 'High', value: buckets.high }
  ];
}

router.get('/risk', async (req, res) => {
  if (!isFeatureEnabled('trading')) {
    return res.status(404).json({ message: 'Trading module is disabled' });
  }

  try {
    const [{ data: assets, error: assetsErr }, { data: loans, error: loansErr }, { data: troubled, error: troubledErr }] =
      await Promise.all([
        supabase
          .from('assets')
          .select('id, name, value, predicted_risk, updated_at')
          .order('predicted_risk', { ascending: false }),
        supabase
          .from('loans')
          .select('id, borrower_name, amount, risk_score, updated_at')
          .order('risk_score', { ascending: false }),
        supabase
          .from('troubled_assets')
          .select('id, predicted_risk, updated_at, assets(name)')
          .order('predicted_risk', { ascending: false })
      ]);

    if (assetsErr) throw assetsErr;
    if (loansErr) throw loansErr;
    if (troubledErr) throw troubledErr;

    const assetBuckets = bucketize(assets, 'predicted_risk');
    const loanBuckets = bucketize(loans, 'risk_score');
    const troubledBuckets = bucketize(troubled, 'predicted_risk');
    const combined = combineBuckets(assetBuckets, loanBuckets, troubledBuckets);

    const topAssets = (assets || [])
      .filter(item => toNumber(item.predicted_risk) > 0.4)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        name: item.name || item.id,
        risk: toNumber(item.predicted_risk),
        value: item.value || null
      }));
    const topLoans = (loans || [])
      .filter(item => toNumber(item.risk_score) > 0.4)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        name: item.borrower_name || item.id,
        risk: toNumber(item.risk_score),
        amount: item.amount || null
      }));
    const highTroubled = (troubled || [])
      .filter(item => toNumber(item.predicted_risk) > 0.4)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        asset: item.assets?.name || item.id,
        risk: toNumber(item.predicted_risk)
      }));

    const timestamps = [
      ...(assets || []).map(item => item.updated_at).filter(Boolean),
      ...(loans || []).map(item => item.updated_at).filter(Boolean),
      ...(troubled || []).map(item => item.updated_at).filter(Boolean)
    ];
    const lastRunAt = timestamps.length
      ? new Date(Math.max(...timestamps.map(ts => new Date(ts).getTime()))).toISOString()
      : null;

    let notifications = [];
    if (req.user?.id) {
      const { data: notificationRows, error: notificationErr } = await supabase
        .from('notifications')
        .select('id, message, link, created_at')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (notificationErr) {
        console.error('Investor notifications fetch error:', notificationErr);
      } else {
        notifications = notificationRows || [];
      }
    }

    const topAlerts = [...topAssets, ...topLoans, ...highTroubled]
      .map(item => ({
        id: item.id,
        label: item.name || item.asset || item.id,
        risk: item.risk,
        type: item.asset ? 'troubled_asset' : item.amount ? 'loan' : 'asset'
      }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 6);

    res.json({
      combinedBuckets: toDonutBuckets(combined),
      assets: { total: assets?.length || 0, buckets: toDonutBuckets(assetBuckets), top: topAssets },
      loans: { total: loans?.length || 0, buckets: toDonutBuckets(loanBuckets), top: topLoans },
      troubled: { total: troubled?.length || 0, buckets: toDonutBuckets(troubledBuckets), top: highTroubled },
      topAlerts,
      lastRunAt,
      notifications
    });
  } catch (err) {
    console.error('Investor risk summary error:', err);
    res.status(500).json({ message: 'Unable to load investor risk summary' });
  }
});

module.exports = router;
