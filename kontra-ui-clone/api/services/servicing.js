const DEFAULT_COLUMNS = ['loan_id', 'date', 'principal', 'interest', 'fees', 'type', 'description'];

const servicingState = {
  pools: {},
};

const normalizePeriod = (period) => {
  if (!period) return null;
  const date = new Date(period);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}-01`;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const ensurePool = (poolId) => {
  if (!servicingState.pools[poolId]) {
   servicingState.pools[poolId] = { periods: {}, ingestions: [], navHistory: [] };
  }
  return servicingState.pools[poolId];
};

const ensurePeriod = (pool, period) => {
  if (!pool.periods[period]) {
    pool.periods[period] = { payments: [], nav: null, distribution: null };
  }
  return pool.periods[period];
};

const parseCsv = (content = '') => {
  const trimmed = content.trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const resolvedHeaders = headers.length ? headers : DEFAULT_COLUMNS;

  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    resolvedHeaders.forEach((header, idx) => {
      row[header] = cells[idx] !== undefined ? cells[idx].trim() : '';
    });
    return row;
  });
};

const classifyCashflowType = (payment) => {
  const type = (payment.type || payment.category || '').toString().toLowerCase();
  const description = (payment.description || payment.memo || '').toLowerCase();

  const isDefaultInterest =
    ['default_interest', 'penalty', 'late', 'default'].some((keyword) =>
      type.includes(keyword)
    ) || description.includes('default interest') || description.includes('penalty');

  if (isDefaultInterest) return 'default_interest';

  const isAdvance = ['advance', 'servicer_advance', 'draw_advance'].some((keyword) =>
    type.includes(keyword) || description.includes(keyword.replace('_', ' '))
  );
  if (isAdvance) return 'advance';

  const isRecovery = ['recovery', 'recoveries', 'reo', 'liquidation'].some((keyword) =>
    type.includes(keyword) || description.includes(keyword)
  );
  if (isRecovery) return 'recovery';

  return 'normal_payment';
};

const normalizePayment = (raw, idx, period, orgId, source = 'manual-upload') => {
  const date = raw.date || raw.payment_date || period;
  const normalizedDate = new Date(date);
  const fallbackDate = Number.isNaN(normalizedDate.getTime()) ? new Date(period) : normalizedDate;

  const principal = toNumber(raw.principal ?? raw.principal_amount ?? 0);
  const interest = toNumber(raw.interest ?? raw.interest_amount ?? 0);
  const fees = toNumber(raw.fees ?? raw.fee ?? 0);
  const amount = toNumber(raw.amount ?? principal + interest + fees);

  const loanId = raw.loan_id || raw.loanId || raw.loan || null;
  if (!loanId) {
    throw new Error('Each payment must include a loan_id');
  }

  const payment = {
    id: raw.id || `${period}-${idx + 1}`,
    loan_id: loanId,
    amount,
    principal,
    interest,
    fees,
    type: raw.type || raw.category || 'normal',
    description: raw.description || raw.memo || '',
    date: fallbackDate.toISOString(),
    period,
    org_id: orgId,
    source,
  };

  return {
    ...payment,
    tag: classifyCashflowType(payment),
  };
};

const ingestPaymentFile = ({ poolId, orgId, period, rows = [], fileContent = '', filename = 'manual-upload' }) => {
  const normalizedPeriod = normalizePeriod(period);
  if (!poolId) throw new Error('poolId is required');
  if (!normalizedPeriod) throw new Error('Valid period is required (YYYY-MM-DD)');

  const parsedRows = Array.isArray(rows) ? rows : [];
  const fileRows = fileContent ? parseCsv(fileContent) : [];
  const combined = [...parsedRows, ...fileRows];

  if (!combined.length) {
    throw new Error('At least one payment row is required');
  }

  const pool = ensurePool(poolId);
  const periodBucket = ensurePeriod(pool, normalizedPeriod);

  const normalizedPayments = combined.map((row, idx) =>
    normalizePayment(row, idx, normalizedPeriod, orgId, filename)
  );

  periodBucket.payments.push(...normalizedPayments);
  pool.ingestions.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    pool_id: poolId,
    org_id: orgId,
    period: normalizedPeriod,
    filename,
    received_at: new Date().toISOString(),
    count: normalizedPayments.length,
  });

  return normalizedPayments;
};

const getPaymentsForPool = (poolId, period) => {
  const pool = servicingState.pools[poolId];
  if (!pool) return [];
  if (!period) {
    return Object.values(pool.periods).flatMap((p) => p.payments);
  }
  const normalizedPeriod = normalizePeriod(period);
  return pool.periods[normalizedPeriod]?.payments || [];
};

const getCashflowHistory = (poolId, { loanId, period } = {}) => {
  const payments = getPaymentsForPool(poolId, period).filter((payment) =>
    loanId ? payment.loan_id === loanId : true
  );

  const grouped = new Map();

  payments
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((payment) => {
      const current = grouped.get(payment.loan_id) || { loan_id: payment.loan_id, cashflows: [], totals: { principal: 0, interest: 0, fees: 0, advances: 0, recoveries: 0 } };

      const net = payment.principal + payment.interest - payment.fees;
      current.cashflows.push({
        date: payment.date,
        amount: payment.amount,
        principal: payment.principal,
        interest: payment.interest,
        fees: payment.fees,
        tag: payment.tag,
        description: payment.description,
        source: payment.source,
      });

      current.totals.principal += payment.principal;
      current.totals.interest += payment.interest;
      current.totals.fees += payment.fees;
      if (payment.tag === 'advance') current.totals.advances += payment.amount;
      if (payment.tag === 'recovery') current.totals.recoveries += net;

      grouped.set(payment.loan_id, current);
    });

  return Array.from(grouped.values());
};

const buildRemittanceSummary = (poolId, period) => {
  const normalizedPeriod = normalizePeriod(period);
  if (!normalizedPeriod) {
    throw new Error('Valid period is required for remittance summary');
  }

  const payments = getPaymentsForPool(poolId, normalizedPeriod);
  const totals = payments.reduce(
    (acc, payment) => {
      acc.gross_interest += payment.interest;
      acc.gross_principal += payment.principal;
      acc.fees += payment.fees;
      if (payment.tag === 'advance') acc.advances += payment.amount;
      if (payment.tag === 'recovery') acc.recoveries += payment.principal + payment.interest - payment.fees;
      if (payment.tag === 'default_interest') acc.default_interest += payment.interest;
      return acc;
    },
    { gross_interest: 0, gross_principal: 0, fees: 0, advances: 0, recoveries: 0, default_interest: 0 }
  );

  return {
    pool_id: poolId,
    period: normalizedPeriod,
    gross_interest: totals.gross_interest,
    gross_principal: totals.gross_principal,
    fees: totals.fees,
    default_interest: totals.default_interest,
    advances: totals.advances,
    recoveries: totals.recoveries,
    net_to_investors: totals.gross_interest + totals.gross_principal - totals.fees - totals.advances + totals.recoveries,
  };
};

const updateNetAssetValue = ({ poolId, navAmount, period, asOf }) => {
  if (!poolId) throw new Error('poolId is required');

  const normalizedPeriod = normalizePeriod(period || new Date().toISOString());
  if (!normalizedPeriod) throw new Error('Valid period is required (YYYY-MM-DD)');

  const amount = Number(navAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('navAmount must be a non-negative number');
  }

  const pool = ensurePool(poolId);
  const periodBucket = ensurePeriod(pool, normalizedPeriod);

  const navRecord = {
    pool_id: poolId,
    period: normalizedPeriod,
    amount,
    updated_at: asOf ? new Date(asOf).toISOString() : new Date().toISOString(),
  };

  periodBucket.nav = navRecord;
  pool.navHistory.push(navRecord);

  return navRecord;
};

const getNetAssetValue = (poolId, period) => {
  const pool = servicingState.pools[poolId];
  if (!pool) return null;
  const normalizedPeriod = normalizePeriod(period);
  if (!normalizedPeriod) return null;
  return pool.periods[normalizedPeriod]?.nav || null;
};

const calculateDistributionForPeriod = (poolId, period) => {
  const { poolFactory } = require('./tokenizationContracts');

  const normalizedPeriod = normalizePeriod(period);
  if (!normalizedPeriod) {
    throw new Error('Valid period is required for distribution calculation');
  }

  const remittance_summary = buildRemittanceSummary(poolId, normalizedPeriod);
  const pool = ensurePool(poolId);
  const periodBucket = ensurePeriod(pool, normalizedPeriod);
  const nav = periodBucket.nav;

  const poolToken = poolFactory.getPool(poolId);
  const tokens_outstanding = poolToken?.totalSupply || 0;
  const per_token_distribution =
    tokens_outstanding > 0
      ? parseFloat((remittance_summary.net_to_investors / tokens_outstanding).toFixed(6))
      : 0;

  const distribution = {
    pool_id: poolId,
    period: normalizedPeriod,
    nav: nav?.amount ?? null,
    nav_updated_at: nav?.updated_at ?? null,
    tokens_outstanding,
    net_to_investors: remittance_summary.net_to_investors,
    per_token_distribution,
    status: tokens_outstanding > 0 ? 'calculated' : 'pending_token_supply',
  };

  periodBucket.distribution = distribution;

  return { distribution, remittance_summary };
};

const resetServicingState = () => {
  servicingState.pools = {};
};

module.exports = {
  classifyCashflowType,
  ingestPaymentFile,
  getCashflowHistory,
  getPaymentsForPool,
  buildRemittanceSummary,
   updateNetAssetValue,
  getNetAssetValue,
  calculateDistributionForPeriod,
  resetServicingState,
  normalizePeriod,
};
