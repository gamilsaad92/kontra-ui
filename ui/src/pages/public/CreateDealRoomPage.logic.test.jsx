const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const {
  TRANSACTION_ENTRY_MODES,
  HISTORICAL_PREVIEW_STAGE,
  previewConfigForEntryMode,
  canContinueFromPreview,
} = require('./CreateDealRoomPage');

describe('create-room transaction entry mode preview', () => {
  const roles = [{ key: 'owner', label: 'Owner' }];
  const activeStages = [
    { key: 'due_diligence', label: 'Due Diligence' },
    { key: 'closing', label: 'Closing' },
  ];

  test('projects previously completed preview to one read-only historical state', () => {
    const config = previewConfigForEntryMode({
      roles,
      documents: [{ id: 'purchase_agreement', label: 'Purchase Agreement' }],
      stages: activeStages,
    }, TRANSACTION_ENTRY_MODES.PREVIOUSLY_COMPLETED);

    expect(config.roles).toBe(roles);
    expect(config.documents).toHaveLength(1);
    expect(config.stages).toEqual([HISTORICAL_PREVIEW_STAGE]);
    expect(canContinueFromPreview({
      roles: config.roles,
      stages: config.stages,
      entryMode: TRANSACTION_ENTRY_MODES.PREVIOUSLY_COMPLETED,
      creationMode: 'ai',
      reviewConfirmed: true,
    })).toBe(true);
  });

  test('preserves active stages and the minimum-two-stage rule', () => {
    const config = previewConfigForEntryMode({
      roles,
      documents: [],
      stages: activeStages,
    }, TRANSACTION_ENTRY_MODES.ACTIVE);

    expect(config.stages).toEqual(activeStages);
    expect(canContinueFromPreview({
      roles,
      stages: [{ key: 'closing', label: 'Closing' }],
      entryMode: TRANSACTION_ENTRY_MODES.ACTIVE,
      creationMode: 'template',
      reviewConfirmed: true,
    })).toBe(false);
    expect(canContinueFromPreview({
      roles,
      stages: config.stages,
      entryMode: TRANSACTION_ENTRY_MODES.ACTIVE,
      creationMode: 'template',
      reviewConfirmed: true,
    })).toBe(true);
  });
});