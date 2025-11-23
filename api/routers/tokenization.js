const express = require('express');
const { poolFactory, whitelistRegistry, describeDeployment } = require('../services/tokenizationContracts');

const router = express.Router();

function buildTokenizationStack() {
  const deployment = describeDeployment();
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

router.get('/tokenization/stack', (req, res) => {
  res.json(buildTokenizationStack());
});

router.get('/tokenization/contracts', (req, res) => {
  res.json(buildTokenizationStack());
});

router.get('/tokenization/whitelist', (req, res) => {
  res.json({ entries: whitelistRegistry.all(), registry: describeDeployment().whitelistRegistry });
});

router.post('/tokenization/whitelist', (req, res) => {
  const { address, investorType, kycProviderRef, isWhitelisted = true } = req.body || {};
  if (!address) {
    return res.status(400).json({ message: 'Address is required' });
  }
  const entry = whitelistRegistry.upsert(address, { isWhitelisted, investorType, kycProviderRef });
  res.status(201).json({ entry, registry: describeDeployment().whitelistRegistry });
});

router.get('/tokenization/pools', (req, res) => {
  res.json({ pools: poolFactory.describePools() });
});

router.post('/tokenization/pools', (req, res) => {
  const { poolId, name, symbol, initialSupply = 0, adminAddress } = req.body || {};
  if (!poolId || !name || !symbol || !adminAddress) {
    return res.status(400).json({ message: 'poolId, name, symbol, and adminAddress are required' });
  }
  try {
    const pool = poolFactory.createPool({ poolId, name, symbol, initialSupply: Number(initialSupply), adminAddress });
    const event = {
      event: 'PoolCreated',
      poolId,
      factory: poolFactory.address,
      whitelistRegistry: pool.whitelistRegistry.address,
      admin: adminAddress,
    };
    res.status(201).json({ pool: pool.summary(), event });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Unable to deploy pool token' });
  }
});

module.exports = { router };
