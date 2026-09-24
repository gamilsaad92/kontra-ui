const {
  isHistoricalLifecycle,
  resolveLifecycleStages,
} = require('./roomLifecycleProjection');

describe('room lifecycle projection', () => {
  const packStages = [
    { key: 'uploading', label: 'Uploading' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
  ];
  const historicalStages = [
    { key: 'historical_verification', label: 'Historical Verification' },
  ];

  test('keeps a one-stage historical API projection instead of restoring pack stages', () => {
    expect(resolveLifecycleStages({
      stageProjection: { stages: historicalStages, historical: true },
      packStages,
    })).toEqual(historicalStages);
  });

  test('fails closed instead of restoring active stages when historical stages are unavailable', () => {
    expect(resolveLifecycleStages({
      stageProjection: { stages: [] },
      packStages,
      transactionEntryMode: 'previously_completed',
    })).toEqual([]);
  });

  test('rejects active pack-stage projections when the room is historical', () => {
    expect(resolveLifecycleStages({
      stageProjection: { stages: packStages, historical: true },
      packStages,
    })).toEqual([]);
  });

  test('selects only the historical stage from a mixed historical response', () => {
    expect(resolveLifecycleStages({
      stageProjection: { stages: [...packStages, ...historicalStages], historical: true },
      packStages,
    })).toEqual(historicalStages);
  });

  test('continues to use pack stages when an active room has no custom projection', () => {
    expect(resolveLifecycleStages({
      stageProjection: { stages: null, historical: false },
      packStages,
      transactionEntryMode: 'active',
    })).toEqual(packStages);
  });

  test('recognizes historical mode from the coordination projection', () => {
    expect(isHistoricalLifecycle({ coordination: { historical: true } })).toBe(true);
  });
});