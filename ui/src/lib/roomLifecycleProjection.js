export function isHistoricalLifecycle({
  transactionEntryMode,
  historical,
  stageProjection,
  coordination,
} = {}) {
  return transactionEntryMode === 'previously_completed'
    || historical === true
    || stageProjection?.historical === true
    || coordination?.historical === true
    || coordination?.transactionEntryMode === 'previously_completed'
    || stageProjection?.transactionEntryMode === 'previously_completed';
}

// The stages endpoint is the lifecycle projection. In particular, its
// one-stage historical result must not be replaced with the workflow pack's
// active transaction stages.
export function resolveLifecycleStages({
  stageProjection,
  packStages,
  transactionEntryMode,
  coordination,
} = {}) {
  const historical = isHistoricalLifecycle({
    transactionEntryMode,
    stageProjection,
    coordination,
  });
  if (historical) {
    const projectedStages = Array.isArray(stageProjection?.stages)
      ? stageProjection.stages
      : [];
    const historicalStage = projectedStages.find(stage =>
      stage?.key === 'historical_verification'
    );
    return historicalStage ? [historicalStage] : [];
  }
  if (Array.isArray(stageProjection?.stages) && stageProjection.stages.length > 0) {
    return stageProjection.stages;
  }
  return Array.isArray(packStages) ? packStages : [];
}