const express = require('express');

const router = express.Router();

const tokenizationStack = {
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
  },
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
    backend: 'Express router /tokenization/stack with static baseline defaults',
  },
};

router.get('/tokenization/stack', (req, res) => {
  res.json(tokenizationStack);
});

module.exports = { router };
