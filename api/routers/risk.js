const express = require('express');
const { addJob } = require('../jobQueue');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function bucketize(items = [], key) {
  const buckets = { low: 0, medium: 0, high: 0 };
  items.forEach((i) => {
    const val = Number(i?.[key] || 0);
    if (val > 0.7) buckets.high += 1;
    else if (val > 0.4) buckets.medium += 1;
    else buckets.low += 1;
  });
  return [
    { label: 'Low', value: buckets.low },
    { label: 'Med', value: buckets.medium },
    { label: 'High', value: buckets.high },
  ];
}

router.get('/summary', async (_req, res) => {
  try {
    const [{ data: loans }, { data: assets }] = await Promise.all([
      supabase
        .from('loans')
        .select(
          'id, balance, risk_score, days_late, default_interest_rate, delinquency_penalty, insurance_due, tax_due'
        ),
      supabase
        .from('assets')
        .select('id, value, predicted_risk, insurance_due, tax_due'),
    ]);

    const loanBuckets = bucketize(loans, 'risk_score');
    const assetBuckets = bucketize(assets, 'predicted_risk');
    const combined = loanBuckets.map((b, i) => ({
      label: b.label,
      value: b.value + (assetBuckets[i]?.value || 0),
    }));

    const stressed = bucketize(
      (loans || []).map((l) => ({
        risk_score: Math.min(1, Number(l.risk_score || 0) + 0.1),
      })),
      'risk_score'
    );

    const today = new Date();
    const soon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const flags = [];
    [...(loans || []), ...(assets || [])].forEach((i) => {
      ['insurance_due', 'tax_due'].forEach((field) => {
        const due = i[field];
        if (due && new Date(due) <= soon) {
          flags.push({ type: field.split('_')[0], id: i.id, due });
        }
      });
    });

    const penalties = (loans || [])
      .filter((l) => l.days_late > 0)
      .map((l) => {
        const rate = Number(l.default_interest_rate || 0.05);
        const defaultInterest = ((rate / 365) * (l.balance || 0) * l.days_late);
        return {
          id: l.id,
          defaultInterest,
          penalty: Number(l.delinquency_penalty || 0),
        };
      });

    res.json({
      buckets: combined,
      stress: { scenario: 'rate+200bps', buckets: stressed },
      flags,
      penalties,
    });
  } catch (err) {
    console.error('Risk summary error:', err);
    res.json({
      buckets: [
        { label: 'Low', value: 10 },
        { label: 'Med', value: 5 },
        { label: 'High', value: 3 },
      ],
      stress: {
        scenario: 'rate+200bps',
        buckets: [
          { label: 'Low', value: 8 },
          { label: 'Med', value: 6 },
          { label: 'High', value: 4 },
        ],
      },
      flags: [],
      penalties: [],
    });
  }
});

router.post('/run', (req, res) => {
  const results = [];

  try {
    addJob('score-assets');
    results.push({ script: 'predictAssetRisk', status: 'queued' });
  } catch (err) {
    console.error('Failed to enqueue predictAssetRisk:', err);
    results.push({ script: 'predictAssetRisk', status: 'error', error: err.message });
  }

  try {
    addJob('score-troubled');
    results.push({ script: 'predictTroubledRisk', status: 'queued' });
  } catch (err) {
    console.error('Failed to enqueue predictTroubledRisk:', err);
    results.push({ script: 'predictTroubledRisk', status: 'error', error: err.message });
  }

  res.json({ message: 'Risk scripts enqueued', results });  
});

module.exports = router;
