const { score } = require('./matchingEngine');

describe('matchingEngine score', () => {
  it('calculates score based on listing and preferences', () => {
    const listing = {
      dscr: 1.5,
      ltv: 60,
      sector: 'office',
      geography: 'CA',
      rate_type: 'fixed',
      par_amount: 5000000
    };
    const prefs = {
      min_dscr: 1.2,
      max_ltv: 65,
      sectors: ['office', 'retail'],
      geographies: ['CA'],
      rate_types: ['fixed'],
      min_size: 1000000,
      max_size: 10000000
    };
    expect(score(listing, prefs)).toBe(40);
  });

  it('returns 0 when no preferences match', () => {
    const listing = {
      dscr: 1,
      ltv: 80,
      sector: 'industrial',
      geography: 'NY',
      rate_type: 'floating',
      par_amount: 50000
    };
    const prefs = {
      min_dscr: 1.5,
      max_ltv: 60,
      sectors: ['office'],
      geographies: ['CA'],
      rate_types: ['fixed'],
      min_size: 100000,
      max_size: 40000
    };
    expect(score(listing, prefs)).toBe(0);
  });
});
