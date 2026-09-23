const {
  classifyDealRoomSchemaError,
  createHistoricalRoomMigrationError,
  isMissingRoomColumn,
} = require('./lib/dealRoomSchemaErrors');

describe('deal-room creation schema error classification', () => {
  test('classifies only a confirmed transaction_entry_mode miss as migration 029', () => {
    const error = {
      code: 'PGRST204',
      message: "Could not find the 'transaction_entry_mode' column of 'deal_rooms' in the schema cache",
    };

    expect(isMissingRoomColumn(error, 'transaction_entry_mode')).toBe(true);
    expect(createHistoricalRoomMigrationError(error)).toEqual(expect.objectContaining({
      code: 'HISTORICAL_ROOM_MIGRATION_REQUIRED',
      statusCode: 503,
    }));
  });

  test('does not misclassify migration-021 generated-room drift as migration 029', () => {
    const error = {
      code: '42703',
      message: 'column "base_pack" of relation "deal_rooms" does not exist',
    };

    expect(classifyDealRoomSchemaError(error)).toEqual({
      isSchemaIncompatibility: true,
      missingColumn: 'base_pack',
    });
    expect(createHistoricalRoomMigrationError(error)).toBeNull();
  });

  test('does not infer a missing migration from a bare schema error code', () => {
    const error = { code: '42703', message: 'column does not exist' };

    expect(classifyDealRoomSchemaError(error)).toEqual({
      isSchemaIncompatibility: false,
      missingColumn: null,
    });
    expect(createHistoricalRoomMigrationError(error)).toBeNull();
  });

  test('keeps unrelated schema errors customer-safe while retaining server classification', () => {
    const error = {
      code: 'PGRST204',
      message: "Could not find the 'generated_proposal' column of 'deal_rooms' in the schema cache",
    };

    expect(classifyDealRoomSchemaError(error).missingColumn).toBe('generated_proposal');
    expect(createHistoricalRoomMigrationError(error)).toBeNull();
  });
});