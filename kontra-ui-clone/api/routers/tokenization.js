const express = require('express');
const { poolFactory, whitelistRegistry, describeDeployment } = require('../services/tokenizationContracts');
const tokenizationService = require('../services/tokenizationService');

const router = express.Router();

async function buildTokenizationStack() {
  const deployment = describeDeployment();
  const service = await tokenizationService.describeService();
  return {
    blockchain: {
      family: 'EVM-compatible',
      devNetwork: 'Ethereum L2 testnet (e.g., Base Sepolia)',
      mainnetTargets: ['Ethereum mainnet', 'production L2', 'permissioned EVM option'],
      rationale:
        'EVM keeps wallet tooling, custody providers, and observability straightforward while letting us start on low-cost L2 testnets before mainnet readiness.',
    },
       poolToken: {
      standard: 'ERC-20',
      usage: 'Pooled credit tokens representing fungible slices of the loan pool NAV.',
      status: 'Baseline',
      notes: 'Mint/burn from treasury contract; emits NAV + distribution events for the dashboard.',
      factory: deployment.poolFactory.address,
      whitelistRegistry: deployment.whitelistRegistry.address,
    },
    whitelistRegistry: {
      address: deployment.whitelistRegistry.address,
      entries: deployment.whitelistRegistry.totalEntries,
      investorTypes: deployment.whitelistRegistry.investorTypes,
    },
    poolFactory: {
      address: deployment.poolFactory.address,
      poolsDeployed: deployment.poolFactory.poolsDeployed,
    },
    service,
    pools: deployment.pools,
    loanTokens: [
      {
        standard: 'ERC-721',
        usage: 'Unique whole-loan claims with bespoke covenants and servicer metadata.',
        status: 'Later phase',
        notes: 'Good fit for non-fungible whole loans or bespoke participations.',
      },
      {
        standard: 'ERC-1155',
        usage: 'Batchable loan participations or tranched receipts.',
        status: 'Later phase',
        notes: 'Mixes fungible and non-fungible positions for syndication artifacts.',
      },
    ],
    integration: {
      frontend: '/tokenization/stack surfaced in SaaS dashboard cards',
      backend: 'Express router /tokenization/stack with live registry + pool metadata',
    },
  };
}

router.get('/tokenization/stack', async (req, res) => {
  const stack = await buildTokenizationStack();
  res.json(stack);
});

router.get('/tokenization/contracts', async (req, res) => {
  const stack = await buildTokenizationStack();
  res.json(stack);
});

router.get('/tokenization/whitelist', (req, res) => {
  res.json({ entries: whitelistRegistry.all(), registry: describeDeployment().whitelistRegistry });
});

router.post('/tokenization/whitelist', async (req, res) => {
  const { address, investorType, kycProviderRef, isWhitelisted = true } = req.body || {};
  if (!address) {
    return res.status(400).json({ message: 'Address is required' });
  }
  try {
    const result = await tokenizationService.whitelistInvestor(address, { isWhitelisted, investorType, kycProviderRef });
    res.status(201).json({ entry: result.entry, transaction: result.transaction, registry: describeDeployment().whitelistRegistry });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to update whitelist' });
  }
});

router.get('/tokenization/pools', (req, res) => {
  res.json({ pools: poolFactory.describePools() });
});

router.post('/tokenization/pools', async (req, res) => {
  const { poolId, name, symbol, initialSupply = 0, adminAddress } = req.body || {};
  if (!poolId || !name || !symbol) {
    return res.status(400).json({ message: 'poolId, name, and symbol are required' });
  }
  try {
   const result = await tokenizationService.createPoolToken({ poolId, name, symbol, initialSupply: Number(initialSupply), adminAddress });
    res.status(201).json({ pool: result.pool, transaction: result.transaction });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to deploy pool token' });
  }
});

router.post('/tokenization/pools/:poolId/mint', async (req, res) => {
  const { poolId } = req.params;
  const { to, amount } = req.body || {};
  if (!to || !amount) {
    return res.status(400).json({ message: 'Recipient address and amount are required' });
  }
  try {
    const result = await tokenizationService.mintPoolTokens(poolId, to, amount);
    res.json({ pool: result.pool, transaction: result.transaction });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to mint tokens' });
  }
});

router.post('/tokenization/pools/:poolId/burn', async (req, res) => {
  const { poolId } = req.params;
  const { from, amount } = req.body || {};
  if (!from || !amount) {
    return res.status(400).json({ message: 'Sender address and amount are required' });
  }
  try {
    const result = await tokenizationService.burnPoolTokens(poolId, from, amount);
    res.json({ pool: result.pool, transaction: result.transaction });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to burn tokens' });
  }
});

router.get('/tokenization/pools/:poolId/address', (req, res) => {
  const { poolId } = req.params;
  const address = tokenizationService.getPoolTokenAddress(poolId);
  if (!address) {
    return res.status(404).json({ message: 'Pool not found' });
  }
  res.json({ poolId, address });
});

module.exports = { router };
