const CONTRACT_REGISTRY = {
  network: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
  loanToken: {
    address: '0x8a91384f2b0Ffd2aA1a4D6f46E1A1eF5C4F1C0Aa',
    description: 'ERC-721 whole loan claims',
  },
  participationToken: {
    address: '0x7D9dC23a580c2c5Bc9945848fc5B2aB3b8E312D6',
    description: 'ERC-20 fractional participations',
  },
  cashFlowSplitter: {
    address: '0x3C3b87A1f5d03d3f3a3D8C1C54B6B1436cAa8e4b',
    description: 'Distributes borrower payments pro-rata to token holders',
  },
};

function describeContracts() {
  return {
    ...CONTRACT_REGISTRY,
    deploymentNotes:
      'Addresses are seeded for dashboard demos and should be replaced with live deployments when migrations complete.',
  };
}

module.exports = { describeContracts };
