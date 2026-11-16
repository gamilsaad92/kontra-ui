const { DEMO_QA_CONTEXT, PROPERTY } = require('./lib/demoData');
const { getDemoFixture } = require('./lib/demoRoomFixtures');
const { buildDemoQaSystemPrompt } = require('./lib/demoQaPrompt');

describe('Harbor View demo AI canonical facts', () => {
  test('passes purchase price, buyer, seller, and target closing date to the model', () => {
    const fixture = getDemoFixture('cre_acquisition', PROPERTY);
    const prompt = buildDemoQaSystemPrompt(
      DEMO_QA_CONTEXT,
      fixture,
      'What is the purchase price, who are the buyer and seller, and what is the target closing date?',
    );

    expect(prompt).toContain('"key": "transaction.purchase_price"');
    expect(prompt).toContain('"value": "$14,000,000"');
    expect(prompt).toContain('"key": "parties.buyer"');
    expect(prompt).toContain('"value": "Harbor View Capital"');
    expect(prompt).toContain('"key": "parties.seller"');
    expect(prompt).toContain('"value": "Brickell Residential Partners"');
    expect(prompt).toContain('"key": "transaction.closing_date"');
    expect(prompt).toContain('"value": "2026-09-18"');
    expect(prompt).toContain('Canonical Transaction Record facts (authoritative)');
  });
});
