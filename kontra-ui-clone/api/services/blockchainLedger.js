const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { describeContracts } = require('./blockchainContracts');
const { scoreTokenPricing, buildRwaExpansions } = require('./tokenPricingAi');

const TX_TABLE = 'blockchain_transactions';
const CASHFLOW_TABLE = 'blockchain_cashflows';

const fallbackTransactions = [
  {
    id: 'tx-1',
    wallet: '0xa5c4...1d9b',
    txHash: '0xabc001',
    chainId: 84532,
    action: 'mintParticipation',
    notional: 250000,
    loanId: 'LN-4219',
    status: 'confirmed',
    timestamp: '2024-07-01T12:00:00Z',
  },
  {
    id: 'tx-2',
    wallet: '0xa5c4...1d9b',
    txHash: '0xabc002',
    chainId: 84532,
    action: 'cashflowDistribution',
    notional: 18500,
    loanId: 'LN-4219',
    status: 'confirmed',
    timestamp: '2024-07-15T12:00:00Z',
  },
  {
    id: 'tx-3',
    wallet: '0x9b22...7c41',
    txHash: '0xabc003',
    chainId: 84532,
    action: 'secondaryTransfer',
    notional: 50000,
    loanId: 'LN-4255',
    status: 'settled',
    timestamp: '2024-08-03T16:20:00Z',
  },
];

const fallbackCashflows = [
  {
    id: 'cf-1',
    loanId: 'LN-4219',
    amount: 18500,
    distributedAt: '2024-07-15T12:00:00Z',
    txHash: '0xabc002',
  },
  {
    id: 'cf-2',
    loanId: 'LN-4177',
    amount: 21200,
    distributedAt: '2024-08-15T12:00:00Z',
    txHash: '0xdef001',
  },
];

const fallbackPositions = [
  {
    loanId: 'LN-4219',
    borrower: 'Seaport Ventures',
    property: 'Pier 9 Offices',
    notional: 3500000,
    ownership: 0.22,
    coupon: 0.073,
    status: 'current',
    nextPayout: '2024-08-15',
  },
  {
    loanId: 'LN-4177',
    borrower: 'Sunbelt Capital',
    property: 'Sunbelt Multifamily',
    notional: 2800000,
    ownership: 0.16,
    coupon: 0.071,
    status: 'watchlist',
    nextPayout: '2024-08-20',
  },
  {
    loanId: 'LN-4255',
    borrower: 'Frontier Development',
    property: 'Frontier Industrial',
    notional: 1600000,
    ownership: 0.11,
    coupon: 0.066,
    status: 'current',
    nextPayout: '2024-08-30',
  },
];

const fallbackOnchainPerformance = [
  {
    loanId: 'LN-4219',
    chain: 'Base',
    dscr: 1.32,
    ltv: 0.63,
    delinquencyRate: 0,
    realizedYield: 0.071,
    projectedYield: 0.074,
    paydownProgress: 0.18,
    navPerToken: 1.04,
    marketPrice: 1.02,
    volatility: 0.045,
    status: 'current',
    lastPaymentTx: '0xabc002',
  },
  {
    loanId: 'LN-4177',
    chain: 'Base',
    dscr: 1.21,
    ltv: 0.69,
    delinquencyRate: 0.02,
    realizedYield: 0.066,
    projectedYield: 0.071,
    paydownProgress: 0.11,
    navPerToken: 0.99,
    marketPrice: 0.97,
    volatility: 0.058,
    status: 'watchlist',
    lastPaymentTx: '0xdef001',
  },
  {
    loanId: 'LN-4255',
    chain: 'Polygon',
    dscr: 1.18,
    ltv: 0.66,
    delinquencyRate: 0.01,
    realizedYield: 0.062,
    projectedYield: 0.068,
    paydownProgress: 0.07,
    navPerToken: 1.01,
    marketPrice: 1.0,
    volatility: 0.053,
    status: 'current',
    lastPaymentTx: '0xghi001',
  },
];

const fallbackChainHealth = {
  finalitySeconds: 2.1,
  settlementLagSeconds: 9,
  uptime: 0.999,
  oracleCoverage: 0.92,
};

async function recordTransaction(entry = {}) {
  const normalized = {
    id: entry.id || uuidv4(),
    wallet: (entry.wallet || '').toLowerCase(),
    txHash: entry.txHash || `0x${uuidv4().replace(/-/g, '').slice(0, 32)}`,
    chainId: Number(entry.chainId) || describeContracts().network.chainId,
    action: entry.action || 'unknown',
    notional: Number(entry.notional) || 0,
    loanId: entry.loanId || null,
    status: entry.status || 'submitted',
    timestamp: entry.timestamp || new Date().toISOString(),
    metadata: entry.metadata || {},
  };

  try {
    const { data, error } = await supabase.from(TX_TABLE).insert([normalized]).select().single();
    if (error) throw error;
    return data || normalized;
  } catch (err) {
    const existingIndex = fallbackTransactions.findIndex((tx) => tx.id === normalized.id);
    if (existingIndex >= 0) {
      fallbackTransactions[existingIndex] = normalized;
    } else {
      fallbackTransactions.unshift(normalized);
    }
    return normalized;
  }
}

async function listTransactions(wallet) {
  const normalizedWallet = wallet ? wallet.toLowerCase() : null;
  try {
    let query = supabase.from(TX_TABLE).select('*').order('timestamp', { ascending: false });
    if (normalizedWallet) {
      query = query.eq('wallet', normalizedWallet);
    }
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data : filterFallbackTransactions(normalizedWallet);
  } catch (err) {
    return filterFallbackTransactions(normalizedWallet);
  }
}

function filterFallbackTransactions(wallet) {
  if (!wallet) return [...fallbackTransactions];
  return fallbackTransactions.filter((tx) => tx.wallet.toLowerCase() === wallet);
}

async function recordCashflow(entry = {}) {
  const normalized = {
    id: entry.id || uuidv4(),
    loanId: entry.loanId,
    amount: Number(entry.amount) || 0,
    distributedAt: entry.distributedAt || new Date().toISOString(),
    txHash: entry.txHash || null,
  };

  try {
    const { data, error } = await supabase.from(CASHFLOW_TABLE).insert([normalized]).select().single();
    if (error) throw error;
    return data || normalized;
  } catch (err) {
    const existingIndex = fallbackCashflows.findIndex((cf) => cf.id === normalized.id);
    if (existingIndex >= 0) {
      fallbackCashflows[existingIndex] = normalized;
    } else {
      fallbackCashflows.unshift(normalized);
    }
    return normalized;
  }
}

async function loadCashflows(loanId) {
  try {
    const query = loanId
      ? supabase.from(CASHFLOW_TABLE).select('*').eq('loanId', loanId)
      : supabase.from(CASHFLOW_TABLE).select('*');
    const { data, error } = await query;
    if (error) throw error;
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return filterFallbackCashflows(loanId);
  } catch (err) {
    return filterFallbackCashflows(loanId);
  }
}

function filterFallbackCashflows(loanId) {
  if (!loanId) return [...fallbackCashflows];
  return fallbackCashflows.filter((cf) => cf.loanId === loanId);
}

function computePositions(wallet) {
  const base = fallbackPositions.map((position) => ({ ...position }));
  if (!wallet) return base;

  const normalizedWallet = wallet.toLowerCase();
  const walletTransactions = filterFallbackTransactions(normalizedWallet);

  return base.map((position) => {
    const loanTx = walletTransactions.filter((tx) => tx.loanId === position.loanId);
    const incrementalNotional = loanTx.reduce((sum, tx) => sum + (tx.notional || 0), 0);
    return {
      ...position,
      notional: Math.max(position.notional + incrementalNotional, 0),
    };
  });
}

async function getPortfolioSnapshot(wallet) {
  const positions = computePositions(wallet);
  const cashflows = await loadCashflows();
  const transactions = await listTransactions(wallet);

  const totalNotional = positions.reduce((sum, pos) => sum + (pos.notional || 0), 0);
  const averageYield =
    positions.length > 0
      ? positions.reduce((sum, pos) => sum + (pos.coupon || 0), 0) / positions.length
      : 0;

  return {
    wallet,
    totals: {
      exposure: totalNotional,
      averageYield,
      nextPayout: positions[0]?.nextPayout || null,
    },
    positions,
    cashflows,
    transactions,
    contracts: describeContracts(),
  };
}

function buildPerformanceRows(wallet) {
  const positions = computePositions(wallet);
  const byLoan = positions.reduce((acc, position) => ({ ...acc, [position.loanId]: position }), {});
  return fallbackOnchainPerformance.map((row) => ({
    ...row,
    borrower: byLoan[row.loanId]?.borrower,
    property: byLoan[row.loanId]?.property,
  }));
}

function getPerformanceSnapshot(wallet) {
  const performance = buildPerformanceRows(wallet);
  const aiValuations = performance.map((row) => ({
    loanId: row.loanId,
    ...scoreTokenPricing({
      navPerToken: row.navPerToken,
      marketPrice: row.marketPrice,
      dscr: row.dscr,
      ltv: row.ltv,
      delinquencyRate: row.delinquencyRate,
      volatility: row.volatility,
      chain: row.chain,
      assetType: row.assetType || (row.chain === 'Polygon' ? 'equipment lease' : 'cre loan'),
    }),
  }));

  const tokenPricing = {
    navPerToken: 1.02,
    secondaryPrice: 1.0,
    premiumPct: -0.0196,
    volume24h: 165000,
  };

  return {
    wallet,
    chainHealth: fallbackChainHealth,
    loanPerformance: performance,
    tokenPricing,
    aiValuations,
    rwaPipeline: buildRwaExpansions(),
  };
}

module.exports = {
  recordTransaction,
  listTransactions,
  getPortfolioSnapshot,
  recordCashflow,
  getPerformanceSnapshot,
};
