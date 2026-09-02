const {
  ingestPaymentFile,
  calculateDistributionForPeriod,
  updateNetAssetValue,
  resetServicingState,
} = require('./services/servicing');
const { poolFactory } = require('./services/tokenizationContracts');

describe('distribution hooks', () => {
  beforeEach(() => {
    resetServicingState();
  });

  it('calculates per-token distribution after NAV update', () => {
    const poolId = 'POOL-DIST-1';
    poolFactory.createPool({
      poolId,
      name: 'Distribution Pool',
      symbol: 'DIST',
      initialSupply: 1000,
      adminAddress: '0xadmin',
    });

    ingestPaymentFile({
      poolId,
      orgId: 'org-1',
      period: '2024-02-15',
      rows: [
        { loan_id: 'LN-1', principal: 10000, interest: 500, fees: 200 },
        { loan_id: 'LN-2', principal: 8000, interest: 420, fees: 120 },
      ],
    });

    updateNetAssetValue({ poolId, navAmount: 1500000, period: '2024-02-01' });

    const { distribution, remittance_summary } = calculateDistributionForPeriod(poolId, '2024-02-01');

    expect(remittance_summary.net_to_investors).toBeCloseTo(18700);
    expect(distribution.nav).toBe(1500000);
    expect(distribution.tokens_outstanding).toBe(1000);
    expect(distribution.per_token_distribution).toBeCloseTo(remittance_summary.net_to_investors / 1000);
    expect(distribution.status).toBe('calculated');
  });

  it('returns pending status when no token supply is present', () => {
    const poolId = 'POOL-DIST-EMPTY';

    const { distribution, remittance_summary } = calculateDistributionForPeriod(poolId, '2024-03-01');

    expect(remittance_summary.net_to_investors).toBe(0);
    expect(distribution.tokens_outstanding).toBe(0);
    expect(distribution.per_token_distribution).toBe(0);
    expect(distribution.status).toBe('pending_token_supply');
    expect(distribution.nav).toBeNull();
  });
});
