const {
  DEMO_AI_MAX_TOKENS,
  getDemoFixture,
  sanitizeDemoTokenizationAnswer,
} = require('./lib/demoRoomFixtures');

const DEMO_PACKS = [
  ['cre_acquisition', { required: 29, confirmed: 27, awaiting: 1, missing: 0, conflicts: 1, notApplicable: 0, percent: 93 }],
  ['business_acquisition', { required: 20, confirmed: 17, awaiting: 2, missing: 1, conflicts: 0, notApplicable: 1, percent: 85 }],
  ['fundraising', { required: 17, confirmed: 17, awaiting: 0, missing: 0, conflicts: 0, notApplicable: 0, percent: 100 }],
];

describe('seeded demo Transaction Record state', () => {
  test.each(DEMO_PACKS)('%s exposes one internally consistent canonical state', (packId, expected) => {
    const fixture = getDemoFixture(packId, {
      property_id: `demo-${packId}`,
      property_name: 'Demo transaction',
      workflow_pack_id: packId,
    });
    const state = fixture.record.record_state;
    const requiredStatuses = state.requiredFields.map(field => field.status);

    expect({
      required: state.requiredCount,
      confirmed: state.confirmedCount,
      awaiting: state.awaitingRequiredCount,
      missing: requiredStatuses.filter(status => status === 'missing').length,
      conflicts: state.conflictRequiredCount || state.conflictCount,
      notApplicable: state.notApplicableCount,
      percent: fixture.readiness.transaction_readiness.overall_pct,
    }).toEqual(expected);
    expect(state.requiredCount).toBe(state.requiredFields.length);
    expect(state.confirmedCount + state.awaitingRequiredCount
      + requiredStatuses.filter(status => status === 'missing').length
      + requiredStatuses.filter(status => status === 'conflict').length
    ).toBe(state.requiredCount);
  });

  test('does not emit a duplicate target-close field in the seeded canonical rows', () => {
    const fixture = getDemoFixture('fundraising', {
      property_id: 'demo-fundraising',
      property_name: 'Nexus AI — Series B',
      workflow_pack_id: 'fundraising',
    });
    const keys = fixture.record.fields.map(field => field.field_key);

    expect(keys).toContain('transaction.closing_date');
    expect(keys).not.toContain('transaction.target_close');
    expect(keys).not.toContain('transaction.target_close_date');
    expect(fixture.property.metadata_values.target_close_date).toBe('2026-10-15');
  });

  test('preserves the complete long Ask Kontra answer', () => {
    const finalSentence = 'Final sentence remains accessible after the long answer.';
    const longAnswer = Array.from({ length: 30 }, (_, index) =>
      `Point ${index + 1}: ${'This transaction preparation detail remains available to the coordinator. '.repeat(12)}`
    ).join('\n') + `\n${finalSentence}`;

    expect(DEMO_AI_MAX_TOKENS).toBeGreaterThanOrEqual(900);
    expect(sanitizeDemoTokenizationAnswer(longAnswer)).toContain(finalSentence);
    expect(sanitizeDemoTokenizationAnswer(longAnswer)).toHaveLength(longAnswer.length);
  });
});