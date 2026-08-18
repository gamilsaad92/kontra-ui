const {
  buildTokenizationGuidance,
  buildTokenizationPrompt,
  buildTokenizationAnswerPrefix,
  isTokenizationQuestion,
} = require('./lib/tokenizationGuidance');

describe('tokenization AI grounding', () => {
  const transactionContext = {
    transaction: {
      propertyName: 'Harbor View Apartments',
      dealType: 'acquisition',
      workflowPack: 'cre_acquisition',
      stageLabel: 'Under Review',
      jurisdiction: 'us_fl',
      digitalAssetEnabled: false,
    },
    record: {
      state: {
        fields: [
          { key: 'asset.name', label: 'Asset name', value: 'Harbor View Apartments', status: 'confirmed' },
          { key: 'asset.ownership_entity', label: 'Ownership entity', value: 'Harbor View Holdings LLC', status: 'confirmed' },
          { key: 'transaction.purchase_price', label: 'Purchase price', value: '$14,000,000', status: 'confirmed' },
          { key: 'legal.title_status', label: 'Title status', value: 'Schedule B exceptions', status: 'conflict', attention: 'source_changed' },
        ],
      },
    },
  };

  test('uses Transaction Record facts first and reports tokenization gaps separately', () => {
    const guidance = buildTokenizationGuidance({ transactionContext });

    expect(guidance.optional).toBe(true);
    expect(guidance.enabled).toBe(false);
    expect(guidance.known).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'asset.name', value: 'Harbor View Apartments' }),
      expect.objectContaining({ key: 'asset.ownership_entity', value: 'Harbor View Holdings LLC' }),
      expect.objectContaining({ key: 'financial.asset_valuation', value: '$14,000,000' }),
    ]));
    expect(guidance.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'parties.issuer' }),
      expect.objectContaining({ key: 'legal.legal_opinion' }),
      expect.objectContaining({ key: 'approval.compliance' }),
    ]));
    expect(guidance.complete).toBe(false);
  });

  test('prompt preserves the required answer ordering and preparation boundary', () => {
    const guidance = buildTokenizationGuidance({ transactionContext });
    const prompt = buildTokenizationPrompt(guidance);

    expect(prompt.indexOf('Transaction state first')).toBeLessThan(prompt.indexOf('Tokenization-specific gaps second'));
    expect(prompt.indexOf('Tokenization-specific gaps second')).toBeLessThan(prompt.indexOf('Generic education last'));
    expect(prompt).toContain('does not issue, sell, recommend, custody, settle, approve');
    expect(prompt).toContain('transaction_context.record.state');
  });

  test('recognizes tokenization questions without changing generic questions', () => {
    expect(isTokenizationQuestion('What is missing before tokenization preparation?')).toBe(true);
    expect(isTokenizationQuestion('What is missing before digital-asset preparation?')).toBe(true);
    expect(isTokenizationQuestion('What is missing before issuing tokens?')).toBe(true);
    expect(isTokenizationQuestion('What should I upload next?')).toBe(false);
  });

  test('answer prefix always leads with current transaction facts before preparation gaps', () => {
    const guidance = buildTokenizationGuidance({ transactionContext });
    const prefix = buildTokenizationAnswerPrefix(guidance);

    expect(prefix.startsWith('Transaction Record first:')).toBe(true);
    expect(prefix).toContain('Harbor View Apartments');
    expect(prefix).toContain('digital-asset preparation optional and not enabled');
    expect(prefix).toContain('Target raise');
  });
});