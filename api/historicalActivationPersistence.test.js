const { buildDealRoomLifecycleFields } = require('./lib/historicalActivation');

describe('historical room activation persistence', () => {
  test('writes one historical lifecycle state while retaining the generated stages for the room pack', () => {
    const generatedStages = [
      { key: 'due_diligence', label: 'Due Diligence' },
      { key: 'closing', label: 'Closing' },
    ];

    const lifecycleFields = buildDealRoomLifecycleFields({
      transactionEntryMode: 'previously_completed',
      stages: generatedStages,
      generatedProposal: {
        transaction: { description: 'The acquisition was completed outside Kontra.' },
      },
    });

    const dealRoomRecord = {
      workflow_pack_id: 'ws_summit_ridge_apartments_acquis_test',
      stages_config: generatedStages,
      metadata_values: {
        digital_asset_readiness: { enabled: true },
      },
      ...lifecycleFields,
    };

    expect(dealRoomRecord).toEqual(expect.objectContaining({
      workflow_pack_id: expect.stringMatching(/^ws_/),
      stages_config: generatedStages,
      deal_stage: 'historical_verification',
      transaction_entry_mode: 'previously_completed',
    }));
    expect(dealRoomRecord.stages_config).toHaveLength(2);
    expect(dealRoomRecord.metadata_values.digital_asset_readiness.enabled).toBe(true);
    expect(dealRoomRecord).not.toHaveProperty('historical_verification_stage');
  });

  test('keeps active lifecycle inference unchanged', () => {
    const lifecycleFields = buildDealRoomLifecycleFields({
      transactionEntryMode: 'active',
      stages: [
        { key: 'setup', label: 'Setup' },
        { key: 'closing', label: 'Closing' },
      ],
      generatedProposal: {
        transaction: { description: 'The letter of intent was signed.' },
      },
    });

    expect(lifecycleFields.transaction_entry_mode).toBe('active');
    expect(lifecycleFields.deal_stage).toBe('setup');
  });
});