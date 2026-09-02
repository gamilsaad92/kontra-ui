const { supabase } = require('../db');
const tokenizationService = require('./tokenizationService');
const { poolFactory, whitelistRegistry } = require('./tokenizationContracts');

const POOL_TABLE = 'tokenized_pools';
const INVESTMENT_TABLE = 'pool_investments';
const INVESTOR_TABLE = 'investors';

const inMemory = {
  pools: new Map(),
  investors: new Map(),
  investments: [],
};

const FALLBACK_HOLDINGS = [
  {
    poolId: 'POOL-2024-1',
    poolName: 'Kontra Bridge 2024-1',
    tokens: 1200000,
    ownership: 0.12,
    lastCashflow: '2024-07-15',
    yield: 0.084,
  },
  {
    poolId: 'POOL-2024-2',
    poolName: 'Sunbelt CRE 2024-2',
    tokens: 800000,
    ownership: 0.08,
    lastCashflow: '2024-07-01',
    yield: 0.079,
  },
];

const FALLBACK_DEAL_ROOM = [
  {
    id: 'POOL-2024-1',
    name: 'Kontra Bridge 2024-1',
    strategy: 'Bridge loans • Multifamily & light industrial',
    targetSize: 50000000,
    currentRaise: 36500000,
    minTicket: 250000,
    apy: 0.085,
    docsUrl: 'https://docs.kontra.dev/pools/kontra-bridge-2024-1.pdf',
    status: 'open',
  },
  {
    id: 'POOL-2024-2',
    name: 'Sunbelt CRE 2024-2',
    strategy: 'Stabilized multifamily debt • TX / GA / FL',
    targetSize: 42000000,
    currentRaise: 19000000,
    minTicket: 150000,
    apy: 0.079,
    docsUrl: 'https://docs.kontra.dev/pools/sunbelt-cre-2024-2.pdf',
    status: 'open',
  },
  {
    id: 'POOL-2024-ESG',
    name: 'Impact Green 2024',
    strategy: 'Energy‑efficient retrofit loans • ESG overlay',
    targetSize: 27000000,
    currentRaise: 11000000,
    minTicket: 100000,
    apy: 0.082,
    docsUrl: 'https://docs.kontra.dev/pools/impact-green-2024.pdf',
    status: 'open',
  },
];

function normalizeLoans(loans) {
  if (!Array.isArray(loans)) return [];
  return loans
    .map((loan, idx) => {
      if (!loan) return null;
      if (typeof loan === 'string') {
        return { id: `loan-${idx + 1}`, name: loan.trim(), balance: null };
      }
      const balance = Number(loan.balance);
      return {
        id: loan.id || `loan-${idx + 1}`,
        name: loan.name || loan.id || `Loan ${idx + 1}`,
        balance: Number.isFinite(balance) ? balance : null,
      };
    })
    .filter(Boolean);
}

function toTicker(name = '') {
  const cleaned = name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
  return cleaned || 'POOL';
}

async function persistPool(pool) {
  try {
    const { data, error } = await supabase
      .from(POOL_TABLE)
      .upsert([{ ...pool, loans: pool.loans || [] }], { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('Pool persistence fallback:', error.message || error);
      return pool;
    }

    const normalized = mapPoolRow(data);
    inMemory.pools.set(normalized.id, normalized);
    return normalized;
  } catch (err) {
    console.warn('Pool persistence unavailable, using memory only:', err.message || err);
    return pool;
  }
}

async function persistInvestment(investment) {
  try {
    const { data, error } = await supabase
      .from(INVESTMENT_TABLE)
      .insert([{ ...investment }])
      .select()
      .single();

    if (error) {
      console.warn('Investment persistence fallback:', error.message || error);
      return investment;
    }

    const normalized = mapInvestmentRow(data);
    inMemory.investments.push(normalized);
    return normalized;
  } catch (err) {
    console.warn('Investment persistence unavailable, using memory only:', err.message || err);
    return investment;
  }
}

async function persistInvestorWallet(investorId, walletAddress) {
  try {
    await supabase
      .from(INVESTOR_TABLE)
      .update({ wallet_address: walletAddress })
      .eq('id', investorId);
  } catch (err) {
    console.warn('Investor wallet persistence skipped:', err.message || err);
  }
}

function mapPoolRow(row) {
  if (!row) return null;
  const loans = Array.isArray(row.loans) ? row.loans : [];
  return {
    id: row.id || row.pool_id || row.poolId,
    name: row.name,
    symbol: row.symbol,
    targetSize: row.target_size ?? row.targetSize ?? null,
    loans: normalizeLoans(loans),
    tokenAddress: row.token_address || row.tokenAddress || null,
    admin: row.admin || row.admin_address || null,
    status: row.status || 'active',
    createdAt: row.created_at || row.createdAt || null,
    portfolioManager: row.portfolio_manager || row.portfolioManager || null,
  };
}

function mapInvestmentRow(row) {
  if (!row) return null;
  return {
    id: row.id || row.investment_id || `inv-${inMemory.investments.length + 1}`,
    investorId: row.investor_id || row.investorId,
    poolId: row.pool_id || row.poolId,
    amount: Number(row.amount) || 0,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    status: row.status || 'minted',
    wallet: row.wallet || row.wallet_address || null,
    reference: row.reference || null,
  };
}

async function loadPool(poolId) {
  if (inMemory.pools.has(poolId)) {
    return inMemory.pools.get(poolId);
  }

  try {
    const { data, error } = await supabase
      .from(POOL_TABLE)
      .select('*')
      .eq('id', poolId)
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    const mapped = mapPoolRow(data);
    if (mapped) {
      inMemory.pools.set(mapped.id, mapped);
    }
    return mapped;
  } catch (err) {
    console.warn('Pool lookup fallback:', err.message || err);
    return null;
  }
}

async function listInvestments(poolId) {
  const memoryInvestments = inMemory.investments.filter((inv) => inv.poolId === poolId);
  try {
    const { data, error } = await supabase
      .from(INVESTMENT_TABLE)
      .select('*')
      .eq('pool_id', poolId);

    if (error) {
      return memoryInvestments;
    }

    const mapped = (data || []).map(mapInvestmentRow);
    const merged = [...memoryInvestments];
    mapped.forEach((row) => {
      if (!merged.find((inv) => inv.id === row.id)) {
        merged.push(row);
      }
    });
    return merged;
  } catch (err) {
    console.warn('Investment listing fallback:', err.message || err);
    return memoryInvestments;
  }
}

async function listInvestmentsByWallet(walletAddress) {
  const memoryInvestments = inMemory.investments.filter((inv) => inv.wallet === walletAddress);
  try {
    const { data, error } = await supabase
      .from(INVESTMENT_TABLE)
      .select('*')
      .eq('wallet', walletAddress);

    if (error) {
      return memoryInvestments;
    }

    const mapped = (data || []).map(mapInvestmentRow);
    const merged = [...memoryInvestments];
    mapped.forEach((row) => {
      if (!merged.find((inv) => inv.id === row.id)) {
        merged.push(row);
      }
    });
    return merged;
  } catch (err) {
    console.warn('Investment listing fallback:', err.message || err);
    return memoryInvestments;
  }
}

async function fetchInvestor(investorId) {
  if (inMemory.investors.has(investorId)) {
    return inMemory.investors.get(investorId);
  }

  try {
    const { data, error } = await supabase
      .from(INVESTOR_TABLE)
      .select('id, name, email, kyc_status, wallet_address, wallet, kyc_provider')
      .eq('id', investorId)
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    const normalized = {
      id: data.id,
      name: data.name,
      email: data.email,
      kycStatus: data.kyc_status || 'approved',
      wallet: data.wallet_address || data.wallet || null,
      kycProvider: data.kyc_provider || 'supabase-kyc',
    };
    inMemory.investors.set(investorId, normalized);
    return normalized;
  } catch (err) {
    console.warn('Investor lookup fallback:', err.message || err);
    return null;
  }
}

function summarizeLoans(loans = []) {
  const totalBalance = loans.reduce((sum, loan) => sum + (Number(loan.balance) || 0), 0);
  return {
    count: loans.length,
    totalBalance: loans.length ? totalBalance : null,
  };
}

function buildPerformance(poolRecord, tokenSummary, investments = []) {
  const targetSize = Number(poolRecord?.targetSize) || null;
  const capitalRaised = investments.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  const remaining = targetSize ? Math.max(targetSize - capitalRaised, 0) : null;
  return {
    targetSize,
    capitalRaised,
    remaining,
    totalSupply: tokenSummary?.totalSupply ?? 0,
    holders: tokenSummary?.holders?.length ?? 0,
  };
}

function buildPoolPayload(poolRecord, tokenSummary, investments = []) {
  if (!poolRecord) return null;
  return {
    id: poolRecord.id,
    name: poolRecord.name,
    symbol: poolRecord.symbol,
    targetSize: poolRecord.targetSize,
    status: poolRecord.status || 'active',
    tokenAddress: tokenSummary?.contractAddress || poolRecord.tokenAddress,
    admin: poolRecord.admin || tokenSummary?.admin || null,
    createdAt: poolRecord.createdAt,
    loans: poolRecord.loans || [],
    portfolioManager: poolRecord.portfolioManager || null,
    metrics: buildPerformance(poolRecord, tokenSummary, investments),
    underlyingLoans: summarizeLoans(poolRecord.loans),
    token: tokenSummary,
    investments,
  };
}

function buildHoldingFromInvestment(investment, poolRecord) {
  if (!investment) return null;
  const lastCashflow = Array.isArray(poolRecord?.cashflows)
    ? poolRecord.cashflows[0]?.distributionDate || poolRecord.cashflows[0]?.period
    : null;
  const ownership = poolRecord?.targetSize
    ? Math.min(investment.amount / poolRecord.targetSize, 1)
    : null;

  return {
    poolId: investment.poolId,
    poolName: poolRecord?.name || investment.poolId,
    tokenAddress: poolRecord?.tokenAddress || null,
    tokens: investment.amount,
    ownership,
    lastCashflow,
    yield: poolRecord?.metrics?.waCoupon || null,
  };
}

async function createPool(payload) {
  const { name, target_size, targetSize, loans = [], admin_wallet, adminWallet, pool_id, poolId, symbol } =
    payload || {};

  if (!name) {
    throw new Error('Pool name is required');
  }

  const poolIdentifier = poolId || pool_id || `POOL-${Date.now()}`;
  const ticker = symbol || toTicker(name);
  const normalizedLoans = normalizeLoans(loans);
  const poolMeta = {
    id: poolIdentifier,
    name,
    symbol: ticker,
    targetSize: Number(targetSize ?? target_size) || null,
    loans: normalizedLoans,
    admin: adminWallet || admin_wallet || null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const tokenResult = await tokenizationService.createPoolToken({
    poolId: poolIdentifier,
    name,
    symbol: ticker,
    adminAddress: poolMeta.admin || undefined,
  });

  const record = await persistPool({ ...poolMeta, tokenAddress: tokenResult.pool.contractAddress });
  return {
    pool: buildPoolPayload(record, tokenResult.pool, []),
    transaction: tokenResult.transaction,
  };
}

async function whitelistInvestor(investorId, walletAddress) {
  if (!investorId || !walletAddress) {
    throw new Error('investor_id and wallet are required');
  }

  const profile = (await fetchInvestor(investorId)) || { id: investorId, kycStatus: 'approved', wallet: null };
  if (profile.kycStatus && profile.kycStatus !== 'approved') {
    const statusLabel = profile.kycStatus.toLowerCase();
    throw new Error(`KYC must be approved before whitelisting (current: ${statusLabel})`);
  }

  const whitelistResult = await tokenizationService.whitelistInvestor(walletAddress, {
    isWhitelisted: true,
    investorType: 'kyc-approved',
    kycProviderRef: profile.kycProvider || 'kyc-db',
  });

  const investorRecord = {
    id: investorId,
    kycStatus: 'approved',
    wallet: walletAddress,
    kycProvider: profile.kycProvider || 'kyc-db',
  };

  inMemory.investors.set(investorId, investorRecord);
  await persistInvestorWallet(investorId, walletAddress);

  return {
    investor: investorRecord,
    whitelist: whitelistResult.entry,
    transaction: whitelistResult.transaction,
  };
}

async function recordInvestment(payload) {
  const { investor_id, investorId, pool_id, poolId, amount } = payload || {};
  const normalizedAmount = Number(amount);
  if (!investor_id && !investorId) {
    throw new Error('investor_id is required');
  }
  if (!pool_id && !poolId) {
    throw new Error('pool_id is required');
  }
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const resolvedPoolId = poolId || pool_id;
  const pool = await loadPool(resolvedPoolId);
  if (!pool) {
    throw new Error('Pool not found');
  }

  const investorKey = investorId || investor_id;
  const investor = (await fetchInvestor(investorKey)) || inMemory.investors.get(investorKey);
  const wallet = investor?.wallet;
  if (!wallet) {
    throw new Error('Investor wallet not found. Please whitelist the investor first.');
  }
  if (!whitelistRegistry.isAllowed(wallet)) {
    throw new Error('Investor wallet must be whitelisted before minting.');
  }

  const mintResult = await tokenizationService.mintPoolTokens(resolvedPoolId, wallet, normalizedAmount);

  const investmentRecord = mapInvestmentRow({
    investor_id: investorKey,
    pool_id: resolvedPoolId,
    amount: normalizedAmount,
    wallet,
    status: 'minted',
  });
  inMemory.investments.push(investmentRecord);
  await persistInvestment(investmentRecord);

  return {
    investment: investmentRecord,
    pool: buildPoolPayload(pool, mintResult.pool, [...(await listInvestments(resolvedPoolId))]),
    transaction: mintResult.transaction,
  };
}

async function getPoolDetails(poolId) {
  const poolRecord = await loadPool(poolId);
  if (!poolRecord) {
    return null;
  }

  const token = poolFactory.getPool(poolId)?.summary() || null;
  const investments = await listInvestments(poolId);

  return buildPoolPayload(poolRecord, token, investments);
}

async function listOpenPools() {
  const pools = Array.from(inMemory.pools.values()).map((pool) => ({
    id: pool.id,
    name: pool.name,
    strategy: pool.portfolioManager || 'Actively managed credit',
    targetSize: pool.targetSize || null,
    currentRaise: null,
    minTicket: 100000,
    apy: 0.075,
    docsUrl: pool.dataRoom || null,
    status: pool.status || 'active',
  }));

  const merged = [...FALLBACK_DEAL_ROOM];
  pools.forEach((p) => {
    if (!merged.find((m) => m.id === p.id)) {
      merged.push(p);
    }
  });

  return merged.filter((p) => (p.status || '').toLowerCase() !== 'closed');
}

async function getInvestorPortfolio(walletAddress) {
  if (!walletAddress) {
    throw new Error('wallet is required');
  }

  const investments = await listInvestmentsByWallet(walletAddress);
  if (!investments.length) {
    return {
      wallet: walletAddress,
      holdings: FALLBACK_HOLDINGS,
      totals: {
        tokens: FALLBACK_HOLDINGS.reduce((sum, h) => sum + h.tokens, 0),
      },
    };
  }

  const holdings = [];
  for (const investment of investments) {
    const pool = await loadPool(investment.poolId);
    holdings.push(buildHoldingFromInvestment(investment, pool));
  }

  return {
    wallet: walletAddress,
    holdings,
    totals: {
      tokens: holdings.reduce((sum, h) => sum + (Number(h?.tokens) || 0), 0),
    },
  };
}

module.exports = {
  createPool,
  whitelistInvestor,
  recordInvestment,
  getPoolDetails,
  listOpenPools,
  getInvestorPortfolio,
};
