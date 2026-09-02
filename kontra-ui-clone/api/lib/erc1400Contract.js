/**
 * Kontra ERC-1400 Contract Scaffold — Phase 6 Activation Point 3
 *
 * This module provides:
 *   1. The full Solidity ABI for KontraSecurityToken (ERC-1400 / ERC-3643 compliant)
 *   2. Deployment configuration per network
 *   3. A contract interaction helper (reads on Ethereum mainnet via JSON-RPC)
 *   4. A deployment pre-flight checklist generator
 *   5. Gas estimation helpers
 *
 * ABI covers all ERC-1400 required interfaces:
 *   - ERC-20 base (balanceOf, transfer, approve, allowance)
 *   - ERC-1594 (isControllable, isIssuable, issue, redeem, canTransfer, transferWithData)
 *   - ERC-1643 (getDocument, setDocument, removeDocument)
 *   - ERC-1644 (controllerTransfer, controllerRedeem)
 *   - ERC-1410 (balanceOfByPartition, transferByPartition, partitionsOf)
 *
 * Usage:
 *   const { getDeploymentConfig, generatePreflightChecklist, estimateGas } = require('./erc1400Contract');
 *   const config = getDeploymentConfig('mainnet', { name:'Harbor View Token', symbol:'HVT', ... });
 */

'use strict';

const crypto = require('crypto');

// ── Full ERC-1400 ABI ─────────────────────────────────────────────────────────

const ERC1400_ABI = [
  // ── ERC-20 base ──────────────────────────────────────────────────────────────
  { type: 'function', name: 'name',        inputs: [], outputs: [{ name: '', type: 'string' }],  stateMutability: 'view'    },
  { type: 'function', name: 'symbol',      inputs: [], outputs: [{ name: '', type: 'string' }],  stateMutability: 'view'    },
  { type: 'function', name: 'decimals',    inputs: [], outputs: [{ name: '', type: 'uint8' }],   stateMutability: 'view'    },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view'    },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: '_tokenHolder', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'transfer',
    inputs: [{ name: '_to', type: 'address' }, { name: '_value', type: 'uint256' }],
    outputs: [{ name: 'success', type: 'bool' }], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'transferFrom',
    inputs: [{ name: '_from', type: 'address' }, { name: '_to', type: 'address' }, { name: '_value', type: 'uint256' }],
    outputs: [{ name: 'success', type: 'bool' }], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'approve',
    inputs: [{ name: '_spender', type: 'address' }, { name: '_value', type: 'uint256' }],
    outputs: [{ name: 'success', type: 'bool' }], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'allowance',
    inputs: [{ name: '_owner', type: 'address' }, { name: '_spender', type: 'address' }],
    outputs: [{ name: 'remaining', type: 'uint256' }], stateMutability: 'view',
  },

  // ── ERC-1594 (core security token) ───────────────────────────────────────────
  { type: 'function', name: 'isControllable', inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'isIssuable',     inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  {
    type: 'function', name: 'issue',
    inputs: [
      { name: '_tokenHolder', type: 'address' },
      { name: '_value',       type: 'uint256' },
      { name: '_data',        type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'issueByPartition',
    inputs: [
      { name: '_partition',   type: 'bytes32' },
      { name: '_tokenHolder', type: 'address' },
      { name: '_value',       type: 'uint256' },
      { name: '_data',        type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'redeem',
    inputs: [
      { name: '_value', type: 'uint256' },
      { name: '_data',  type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'redeemFrom',
    inputs: [
      { name: '_tokenHolder', type: 'address' },
      { name: '_value',       type: 'uint256' },
      { name: '_data',        type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'canTransfer',
    inputs: [
      { name: '_to',    type: 'address' },
      { name: '_value', type: 'uint256' },
      { name: '_data',  type: 'bytes'   },
    ],
    outputs: [
      { name: '', type: 'bool'    },
      { name: '', type: 'bytes1'  },   // EIP-1066 status code
      { name: '', type: 'bytes32' },   // reason bytes
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'canTransferFrom',
    inputs: [
      { name: '_from',  type: 'address' },
      { name: '_to',    type: 'address' },
      { name: '_value', type: 'uint256' },
      { name: '_data',  type: 'bytes'   },
    ],
    outputs: [
      { name: '', type: 'bool'    },
      { name: '', type: 'bytes1'  },
      { name: '', type: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'transferWithData',
    inputs: [
      { name: '_to',    type: 'address' },
      { name: '_value', type: 'uint256' },
      { name: '_data',  type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'transferFromWithData',
    inputs: [
      { name: '_from',  type: 'address' },
      { name: '_to',    type: 'address' },
      { name: '_value', type: 'uint256' },
      { name: '_data',  type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },

  // ── ERC-1643 (document management) ───────────────────────────────────────────
  {
    type: 'function', name: 'getDocument',
    inputs: [{ name: '_name', type: 'bytes32' }],
    outputs: [
      { name: '', type: 'string'  },   // IPFS URI
      { name: '', type: 'bytes32' },   // document hash (keccak256)
      { name: '', type: 'uint256' },   // last modified timestamp
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'setDocument',
    inputs: [
      { name: '_name', type: 'bytes32' },
      { name: '_uri',  type: 'string'  },
      { name: '_documentHash', type: 'bytes32' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'removeDocument',
    inputs: [{ name: '_name', type: 'bytes32' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getAllDocuments',
    inputs: [], outputs: [{ name: '', type: 'bytes32[]' }], stateMutability: 'view',
  },

  // ── ERC-1644 (controller operations) ─────────────────────────────────────────
  { type: 'function', name: 'isControllable', inputs: [], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  {
    type: 'function', name: 'controllerTransfer',
    inputs: [
      { name: '_from',          type: 'address' },
      { name: '_to',            type: 'address' },
      { name: '_value',         type: 'uint256' },
      { name: '_data',          type: 'bytes'   },
      { name: '_operatorData',  type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'controllerRedeem',
    inputs: [
      { name: '_tokenHolder',  type: 'address' },
      { name: '_value',        type: 'uint256' },
      { name: '_data',         type: 'bytes'   },
      { name: '_operatorData', type: 'bytes'   },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },

  // ── ERC-1410 (partitions / tranches) ─────────────────────────────────────────
  {
    type: 'function', name: 'balanceOfByPartition',
    inputs: [
      { name: '_partition',   type: 'bytes32' },
      { name: '_tokenHolder', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'partitionsOf',
    inputs: [{ name: '_tokenHolder', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'transferByPartition',
    inputs: [
      { name: '_partition', type: 'bytes32' },
      { name: '_to',        type: 'address' },
      { name: '_value',     type: 'uint256' },
      { name: '_data',      type: 'bytes'   },
    ],
    outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'operatorTransferByPartition',
    inputs: [
      { name: '_partition',    type: 'bytes32' },
      { name: '_from',         type: 'address' },
      { name: '_to',           type: 'address' },
      { name: '_value',        type: 'uint256' },
      { name: '_data',         type: 'bytes'   },
      { name: '_operatorData', type: 'bytes'   },
    ],
    outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'authorizeOperator',
    inputs: [{ name: '_operator', type: 'address' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'revokeOperator',
    inputs: [{ name: '_operator', type: 'address' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'isOperator',
    inputs: [
      { name: '_operator',    type: 'address' },
      { name: '_tokenHolder', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'authorizeOperatorByPartition',
    inputs: [
      { name: '_partition', type: 'bytes32' },
      { name: '_operator',  type: 'address' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'isOperatorForPartition',
    inputs: [
      { name: '_partition',   type: 'bytes32' },
      { name: '_operator',    type: 'address' },
      { name: '_tokenHolder', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }], stateMutability: 'view',
  },

  // ── Kontra extensions ──────────────────────────────────────────────────────
  {
    type: 'function', name: 'getWhitelistStatus',
    inputs: [{ name: '_investor', type: 'address' }],
    outputs: [
      { name: 'isWhitelisted', type: 'bool'    },
      { name: 'kycExpiry',     type: 'uint256' },
      { name: 'jurisdiction',  type: 'bytes2'  },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'setWhitelistStatus',
    inputs: [
      { name: '_investor',    type: 'address' },
      { name: '_status',      type: 'bool'    },
      { name: '_kycExpiry',   type: 'uint256' },
      { name: '_jurisdiction',type: 'bytes2'  },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getLoanMetadata',
    inputs: [],
    outputs: [
      { name: 'loanId',       type: 'bytes32' },
      { name: 'originatorId', type: 'bytes32' },
      { name: 'ltv',          type: 'uint32'  },   // basis points × 100 (e.g. 7000 = 70.00%)
      { name: 'dscr',         type: 'uint32'  },   // × 10000 (e.g. 12200 = 1.2200)
      { name: 'maturityTs',   type: 'uint64'  },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'recordStablecoinPayment',
    inputs: [
      { name: '_paymentId',   type: 'bytes32' },
      { name: '_stablecoin',  type: 'address' },
      { name: '_amount',      type: 'uint256' },
      { name: '_paymentType', type: 'uint8'   },   // 0=interest, 1=principal, 2=payoff
    ],
    outputs: [], stateMutability: 'nonpayable',
  },

  // ── Events ────────────────────────────────────────────────────────────────────
  {
    type: 'event', name: 'Transfer',
    inputs: [
      { name: 'from',  type: 'address', indexed: true  },
      { name: 'to',    type: 'address', indexed: true  },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'TransferByPartition',
    inputs: [
      { name: 'fromPartition', type: 'bytes32', indexed: true  },
      { name: 'operator',      type: 'address', indexed: false },
      { name: 'from',          type: 'address', indexed: true  },
      { name: 'to',            type: 'address', indexed: true  },
      { name: 'value',         type: 'uint256', indexed: false },
      { name: 'data',          type: 'bytes',   indexed: false },
      { name: 'operatorData',  type: 'bytes',   indexed: false },
    ],
  },
  {
    type: 'event', name: 'Issued',
    inputs: [
      { name: 'operator',     type: 'address', indexed: true  },
      { name: 'to',           type: 'address', indexed: true  },
      { name: 'value',        type: 'uint256', indexed: false },
      { name: 'data',         type: 'bytes',   indexed: false },
      { name: 'operatorData', type: 'bytes',   indexed: false },
    ],
  },
  {
    type: 'event', name: 'Redeemed',
    inputs: [
      { name: 'operator',     type: 'address', indexed: true  },
      { name: 'from',         type: 'address', indexed: true  },
      { name: 'value',        type: 'uint256', indexed: false },
      { name: 'data',         type: 'bytes',   indexed: false },
      { name: 'operatorData', type: 'bytes',   indexed: false },
    ],
  },
  {
    type: 'event', name: 'Document',
    inputs: [
      { name: 'name',         type: 'bytes32', indexed: true  },
      { name: 'uri',          type: 'string',  indexed: false },
      { name: 'documentHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ControllerTransfer',
    inputs: [
      { name: 'controller',   type: 'address', indexed: false },
      { name: 'from',         type: 'address', indexed: true  },
      { name: 'to',           type: 'address', indexed: true  },
      { name: 'value',        type: 'uint256', indexed: false },
      { name: 'data',         type: 'bytes',   indexed: false },
      { name: 'operatorData', type: 'bytes',   indexed: false },
    ],
  },
  {
    type: 'event', name: 'WhitelistUpdated',
    inputs: [
      { name: 'investor',     type: 'address', indexed: true  },
      { name: 'status',       type: 'bool',    indexed: false },
      { name: 'kycExpiry',    type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'StablecoinPaymentRecorded',
    inputs: [
      { name: 'paymentId',   type: 'bytes32', indexed: true  },
      { name: 'stablecoin',  type: 'address', indexed: false },
      { name: 'amount',      type: 'uint256', indexed: false },
      { name: 'paymentType', type: 'uint8',   indexed: false },
    ],
  },
];

// ── Network configurations ────────────────────────────────────────────────────

const NETWORKS = {
  mainnet: {
    chainId:         1,
    name:            'Ethereum Mainnet',
    rpcUrl:          process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}',
    explorerUrl:     'https://etherscan.io',
    usdc:            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt:            '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    dai:             '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    pyusd:           '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    eurc:            '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
    gasLimit:        3_000_000,
    gasPriceGwei:    null,   // use EIP-1559
    maxFeeGwei:      50,
    maxPriorityGwei: 2,
  },
  polygon: {
    chainId:         137,
    name:            'Polygon Mainnet',
    rpcUrl:          process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}',
    explorerUrl:     'https://polygonscan.com',
    usdc:            '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    usdt:            '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    dai:             '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    gasLimit:        3_000_000,
    gasPriceGwei:    80,
  },
  sepolia: {
    chainId:         11155111,
    name:            'Sepolia Testnet',
    rpcUrl:          process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}',
    explorerUrl:     'https://sepolia.etherscan.io',
    usdc:            '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    usdt:            '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    dai:             '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
    gasLimit:        3_000_000,
    gasPriceGwei:    2,
  },
};

// ── Constructor arguments for KontraSecurityToken ─────────────────────────────

function buildConstructorArgs({
  name,
  symbol,
  decimals     = 0,          // Security tokens: 0 decimals, whole units only
  totalSupply,
  controller,                // Kontra master servicer address
  loanId,                    // bytes32 (hex-encoded loan ref)
  originatorId,              // bytes32 (hex-encoded org id)
  ltv,                       // integer basis points × 100 (e.g. 70.00% → 7000)
  dscr,                      // integer × 10000 (e.g. 1.2200 → 12200)
  maturityTimestamp,
  offeringDocumentHash,      // keccak256 of the offering document bytes
  offeringDocumentUri,       // IPFS URI (ipfs://Qm...)
  partitions = ['0x77686f6c655f6c6f616e00000000000000000000000000000000000000000000'], // whole_loan in bytes32
  accreditedOnly = true,
  allowedChainIds = [1],
}) {
  return {
    name,
    symbol,
    decimals,
    totalSupply: String(totalSupply),
    controller,
    loanId:      loanId || `0x${Buffer.from('unknown').toString('hex').padEnd(64, '0')}`,
    originatorId,
    ltv:         Math.round(ltv * 100),
    dscr:        Math.round(dscr * 10000),
    maturityTimestamp,
    offeringDocumentHash,
    offeringDocumentUri,
    partitions,
    accreditedOnly,
    allowedChainIds,
  };
}

// ── Deployment configuration ──────────────────────────────────────────────────

function getDeploymentConfig(network = 'mainnet', tokenConfig = {}) {
  const net = NETWORKS[network];
  if (!net) throw new Error(`Unknown network: ${network}. Must be one of: ${Object.keys(NETWORKS).join(', ')}`);

  const constructorArgs = buildConstructorArgs(tokenConfig);

  return {
    network:         net.name,
    chainId:         net.chainId,
    rpcUrl:          net.rpcUrl,
    explorerUrl:     net.explorerUrl,
    abi:             ERC1400_ABI,
    constructorArgs,
    gasConfig: {
      gasLimit:        net.gasLimit,
      gasPriceGwei:    net.gasPriceGwei,
      maxFeeGwei:      net.maxFeeGwei,
      maxPriorityGwei: net.maxPriorityGwei,
    },
    stablecoins: {
      usdc: net.usdc,
      usdt: net.usdt,
      dai:  net.dai,
      pyusd:net.pyusd,
      eurc: net.eurc,
    },
    estimatedDeploymentCostEth: estimateDeploymentGas(net),
    deploymentSteps: [
      'Compile KontraSecurityToken.sol with Solidity ^0.8.20',
      'Run Slither static analysis — 0 high/critical findings required',
      'Deploy to Sepolia testnet — run full integration test suite',
      'Get third-party audit (Certik / Trail of Bits / OpenZeppelin)',
      `Deploy to ${net.name} with Kontra controller address`,
      'Call setDocument() with IPFS offering document hash',
      'Call setWhitelistStatus() for each approved investor wallet',
      'Verify contract on Etherscan / block explorer',
      'Call authorizeOperator() for Kontra servicer address',
    ],
    contractSource: 'kontra-contracts/src/KontraSecurityToken.sol',
    auditRequired: network === 'mainnet',
  };
}

function estimateDeploymentGas(net) {
  const DEPLOY_GAS_UNITS = 2_400_000;
  const gasPriceWei = (net.maxFeeGwei || net.gasPriceGwei || 30) * 1e9;
  const costWei     = DEPLOY_GAS_UNITS * gasPriceWei;
  return {
    gasUnits:      DEPLOY_GAS_UNITS,
    gasPriceGwei:  net.maxFeeGwei || net.gasPriceGwei || 30,
    estimatedEth:  (costWei / 1e18).toFixed(4),
    noteUsd:       'Convert using live ETH/USD price from Chainlink ETH/USD feed (0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419)',
  };
}

// ── Pre-flight checklist ──────────────────────────────────────────────────────

function generatePreflightChecklist(tokenPackage, network = 'mainnet') {
  const items = [
    {
      id:     'readiness_score',
      label:  'Tokenization Readiness Score ≥ 85',
      status: tokenPackage.readinessScore >= 85 ? 'pass' : tokenPackage.readinessScore >= 65 ? 'conditional' : 'fail',
      value:  tokenPackage.readinessScore,
      action: tokenPackage.readinessScore < 85 ? 'Re-run readiness assessment and resolve all blocking issues' : null,
    },
    {
      id:     'ipfs_document',
      label:  'Offering document pinned to IPFS',
      status: tokenPackage.ipfsDocumentHash ? 'pass' : 'fail',
      value:  tokenPackage.ipfsDocumentHash || 'Missing',
      action: !tokenPackage.ipfsDocumentHash ? 'Pin offering PDF to IPFS via Pinata or NFT.Storage, then call setDocument()' : null,
    },
    {
      id:     'controller_address',
      label:  'Controller wallet address set (Kontra servicer EOA)',
      status: process.env.KONTRA_CONTROLLER_ADDRESS ? 'pass' : 'fail',
      value:  process.env.KONTRA_CONTROLLER_ADDRESS || 'KONTRA_CONTROLLER_ADDRESS env not set',
      action: !process.env.KONTRA_CONTROLLER_ADDRESS ? 'Set KONTRA_CONTROLLER_ADDRESS in environment to Kontra\'s signing wallet' : null,
    },
    {
      id:     'rpc_endpoint',
      label:  'Ethereum RPC endpoint configured',
      status: process.env.ETH_RPC_URL || network !== 'mainnet' ? 'pass' : 'fail',
      value:  process.env.ETH_RPC_URL || `Using default (set ETH_RPC_URL for ${network})`,
      action: !process.env.ETH_RPC_URL && network === 'mainnet' ? 'Set ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' : null,
    },
    {
      id:     'audit',
      label:  network === 'mainnet' ? 'Smart contract audit completed' : 'Audit not required for testnet',
      status: network !== 'mainnet' ? 'pass' : 'pending',
      value:  network === 'mainnet' ? 'Required before mainnet deployment' : 'N/A',
      action: network === 'mainnet' ? 'Engage Certik, Trail of Bits, or OpenZeppelin for full audit' : null,
    },
    {
      id:     'kyc_investors',
      label:  `≥1 investor with kyc_status=approved`,
      status: (tokenPackage.investorCount || 0) > 0 ? 'pass' : 'fail',
      value:  `${tokenPackage.investorCount || 0} approved investor(s)`,
      action: (tokenPackage.investorCount || 0) === 0 ? 'Whitelist and KYC-approve at least one investor before issuing tokens' : null,
    },
    {
      id:     'ltv_check',
      label:  'LTV ≤ 80%',
      status: tokenPackage.ltv <= 0.80 ? 'pass' : 'fail',
      value:  `${((tokenPackage.ltv || 0) * 100).toFixed(1)}%`,
      action: tokenPackage.ltv > 0.80 ? 'Reduce LTV below 80% before tokenization' : null,
    },
    {
      id:     'dscr_check',
      label:  'DSCR ≥ 1.15',
      status: tokenPackage.dscr >= 1.15 ? 'pass' : 'fail',
      value:  tokenPackage.dscr?.toFixed(2),
      action: tokenPackage.dscr < 1.15 ? 'Improve NOI or reduce debt service before tokenization' : null,
    },
  ];

  const pass    = items.filter(i => i.status === 'pass').length;
  const fail    = items.filter(i => i.status === 'fail').length;
  const pending = items.filter(i => i.status === 'pending' || i.status === 'conditional').length;

  return {
    ready:    fail === 0,
    score:    `${pass}/${items.length}`,
    pass, fail, pending,
    items,
    generatedAt: new Date().toISOString(),
    network,
  };
}

// ── ABI encoding helpers ──────────────────────────────────────────────────────

function encodePartitionName(name) {
  const buf = Buffer.alloc(32);
  Buffer.from(name, 'utf8').copy(buf);
  return `0x${buf.toString('hex')}`;
}

function encodeKycData(investorAddress, jurisdiction, kycExpiry) {
  // ABI-encode the calldata passed to transferWithData for KYC verification
  const payload = {
    version:   1,
    investor:  investorAddress.toLowerCase(),
    jurisdiction,
    kycExpiry: Math.floor(new Date(kycExpiry || Date.now() + 365 * 24 * 3600 * 1000).getTime() / 1000),
    nonce:     crypto.randomBytes(16).toString('hex'),
    timestamp: Math.floor(Date.now() / 1000),
  };
  return `0x${Buffer.from(JSON.stringify(payload)).toString('hex')}`;
}

const PARTITION_BYTES32 = {
  whole_loan: encodePartitionName('whole_loan'),
  senior:     encodePartitionName('senior'),
  mezzanine:  encodePartitionName('mezzanine'),
  equity:     encodePartitionName('equity'),
};

module.exports = {
  ERC1400_ABI,
  NETWORKS,
  getDeploymentConfig,
  generatePreflightChecklist,
  estimateDeploymentGas,
  encodePartitionName,
  encodeKycData,
  PARTITION_BYTES32,
};
