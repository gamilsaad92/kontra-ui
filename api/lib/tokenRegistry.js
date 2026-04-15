/**
 * Kontra Token Registry — Phase 6
 *
 * ERC-1400 compatible CRE loan token packaging, investor whitelist management,
 * transfer eligibility checks, stablecoin payment reconciliation, and
 * secondary market order book.
 *
 * Token Package structure mirrors ERC-1400 / ERC-3643 (T-REX) standard:
 *   - Partitions (tranches): senior, mezzanine, equity, whole_loan
 *   - Investor whitelist: KYC/AML cleared, accredited status, jurisdiction
 *   - Transfer rules: jurisdiction, accreditation, hold period, position limits
 *   - On-chain metadata: contract address (mock), IPFS document hash
 *
 * Supported stablecoins: USDC, USDT, DAI, PYUSD, EURC
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ── In-memory stores ──────────────────────────────────────────────────────────

const TOKEN_PACKAGES  = new Map();   // tokenId → TokenPackage
const WALLETS         = new Map();   // address → WalletRecord
const TRANSFERS       = [];          // TransferRecord[]
const PAYMENTS        = [];          // StablecoinPayment[]
const ORDER_BOOK      = [];          // OrderEntry[]
const GOV_PROPOSALS   = new Map();   // proposalId → Proposal
const GOV_VOTES       = [];          // Vote[]

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockAddress(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

function mockIpfsHash(content) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return `bafybei${hash.slice(0, 38)}`;
}

function fakeBlockNumber() {
  return 19_000_000 + Math.floor(Math.random() * 500_000);
}

// ── Token Package (ERC-1400) ──────────────────────────────────────────────────

const PARTITION_TYPES = ['whole_loan', 'senior', 'mezzanine', 'equity'];

function createTokenPackage({
  loanId, loanNumber, propertyAddress, propertyType, loanBalance, propertyValue,
  ltv, dscr, noi, interestRate, maturityDate, originationDate, borrowerName,
  partitionType = 'whole_loan', totalTokens = 1000, tokenPriceUsd,
  offering = {}, orgId,
} = {}) {
  if (!loanId && !loanNumber) throw new Error('loanId or loanNumber required');
  if (!PARTITION_TYPES.includes(partitionType)) throw new Error(`Invalid partition: ${partitionType}. Must be one of: ${PARTITION_TYPES.join(', ')}`);

  const tokenId       = uuidv4();
  const contractSeed  = `${loanId || loanNumber}-${partitionType}-${tokenId}`;
  const contractAddr  = mockAddress(contractSeed);
  const offeringDoc   = { tokenId, loanId: loanId || loanNumber, partitionType, loanBalance, propertyAddress, propertyValue, ltv, dscr, noi, interestRate, maturityDate, ...offering };
  const ipfsHash      = mockIpfsHash(offeringDoc);

  const impliedPrice = tokenPriceUsd || (loanBalance ? Math.round(loanBalance / totalTokens * 100) / 100 : null);

  const pkg = {
    tokenId,
    loanId:          loanId || loanNumber,
    loanNumber:      loanNumber || loanId,
    propertyAddress, propertyType, loanBalance, propertyValue,
    ltv, dscr, noi, interestRate, maturityDate, originationDate, borrowerName,
    partitionType,
    contractAddress: contractAddr,
    blockchain:      'ethereum',
    standard:        'ERC-1400',
    chainId:         1,
    totalTokens,
    tokensIssued:    0,
    tokensOutstanding: 0,
    tokenPriceUsd:   impliedPrice,
    totalValueUsd:   impliedPrice ? Math.round(impliedPrice * totalTokens * 100) / 100 : null,
    ipfsDocumentHash: ipfsHash,
    status:          'draft',     // draft | offering | active | matured | redeemed
    investorCount:   0,
    transferCount:   0,
    offering: {
      minInvestment:       offering.minInvestment   || 25000,
      maxInvestment:       offering.maxInvestment   || null,
      accreditedOnly:      offering.accreditedOnly  !== false,
      allowedJurisdictions:offering.allowedJurisdictions || ['US', 'CA', 'GB', 'EU', 'SG', 'JP'],
      holdPeriodDays:      offering.holdPeriodDays  || 90,
      targetYield:         offering.targetYield     || interestRate,
      offeringSize:        offering.offeringSize    || loanBalance,
      closingDate:         offering.closingDate     || null,
    },
    erc1400Compliance: {
      issuanceController: contractAddr,
      transferRestrictions: true,
      documentHash: ipfsHash,
      partitionSupport: true,
      transferWithData: true,
      operatorAuth: true,
      controlledIssuance: true,
      redemptionSupport: true,
    },
    orgId,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    blockNumber: fakeBlockNumber(),
    txHash:     `0x${crypto.randomBytes(32).toString('hex')}`,
  };

  TOKEN_PACKAGES.set(tokenId, pkg);
  return pkg;
}

function updateTokenStatus(tokenId, status, patch = {}) {
  const pkg = TOKEN_PACKAGES.get(tokenId);
  if (!pkg) throw new Error(`Token package ${tokenId} not found`);
  pkg.status    = status;
  pkg.updatedAt = new Date().toISOString();
  Object.assign(pkg, patch);
  return pkg;
}

function listTokens({ orgId, status } = {}) {
  let tokens = Array.from(TOKEN_PACKAGES.values());
  if (orgId)  tokens = tokens.filter(t => t.orgId === orgId || !t.orgId);
  if (status) tokens = tokens.filter(t => t.status === status);
  return tokens;
}

function getToken(tokenId) {
  return TOKEN_PACKAGES.get(tokenId) || null;
}

// ── Investor Wallet Whitelist ─────────────────────────────────────────────────

const INVESTOR_TYPES = ['institutional', 'accredited_individual', 'qualified_purchaser', 'family_office', 'reit', 'pension_fund'];

function whitelistWallet({
  address, investorName, investorType = 'accredited_individual', jurisdiction = 'US',
  accredited = true, kycStatus = 'pending', amlStatus = 'pending',
  taxId, entityType, maxPositionUsd, tokenIds = [], orgId,
} = {}) {
  if (!address) throw new Error('Wallet address required');
  const normalized = address.toLowerCase();

  const record = {
    address:       normalized,
    investorName:  investorName || `Investor ${normalized.slice(0, 8)}`,
    investorType,
    jurisdiction,
    accredited,
    kycStatus,      // pending | approved | rejected | expired
    amlStatus,      // pending | cleared | flagged
    ofacStatus:    'cleared',
    taxId:         taxId   || null,
    entityType:    entityType || null,
    maxPositionUsd: maxPositionUsd || null,
    tokenIds,       // Token packages this wallet is approved for
    holdingValue:  0,
    transferCount: 0,
    whitelistedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    orgId,
  };

  WALLETS.set(normalized, record);
  return record;
}

function updateWalletKyc(address, { kycStatus, amlStatus, ofacStatus, accredited } = {}) {
  const wallet = WALLETS.get(address.toLowerCase());
  if (!wallet) throw new Error(`Wallet ${address} not found`);
  if (kycStatus  !== undefined) wallet.kycStatus  = kycStatus;
  if (amlStatus  !== undefined) wallet.amlStatus  = amlStatus;
  if (ofacStatus !== undefined) wallet.ofacStatus = ofacStatus;
  if (accredited !== undefined) wallet.accredited = accredited;
  wallet.lastUpdatedAt = new Date().toISOString();
  return wallet;
}

function removeWallet(address) {
  return WALLETS.delete(address.toLowerCase());
}

function listWallets({ orgId, kycStatus, tokenId } = {}) {
  let wallets = Array.from(WALLETS.values());
  if (orgId)    wallets = wallets.filter(w => !w.orgId || w.orgId === orgId);
  if (kycStatus)wallets = wallets.filter(w => w.kycStatus === kycStatus);
  if (tokenId)  wallets = wallets.filter(w => w.tokenIds.includes(tokenId) || w.tokenIds.length === 0);
  return wallets;
}

function getWallet(address) {
  return WALLETS.get(address.toLowerCase()) || null;
}

// ── Transfer Eligibility Check ─────────────────────────────────────────────────

function checkTransferEligibility(tokenId, fromAddress, toAddress, amount) {
  const token  = TOKEN_PACKAGES.get(tokenId);
  const sender = WALLETS.get(fromAddress?.toLowerCase());
  const recip  = WALLETS.get(toAddress?.toLowerCase());

  const reasons  = [];
  const warnings = [];
  let eligible   = true;

  if (!token) {
    return { eligible: false, reasons: [`Token package ${tokenId} not found`], warnings: [], statusCode: 128 };
  }

  // Token must be in active or offering state
  if (!['active', 'offering'].includes(token.status)) {
    eligible = false;
    reasons.push(`Token status is "${token.status}" — transfers only permitted in "active" or "offering" status`);
  }

  // Recipient must be whitelisted
  if (!recip) {
    eligible = false;
    reasons.push(`Recipient ${toAddress} is not on the investor whitelist`);
  } else {
    if (recip.kycStatus !== 'approved') {
      eligible = false;
      reasons.push(`Recipient KYC status is "${recip.kycStatus}" — must be "approved"`);
    }
    if (recip.amlStatus !== 'cleared') {
      eligible = false;
      reasons.push(`Recipient AML status is "${recip.amlStatus}" — must be "cleared"`);
    }
    if (recip.ofacStatus !== 'cleared') {
      eligible = false;
      reasons.push(`Recipient OFAC status is "${recip.ofacStatus}" — cannot transfer to sanctioned party`);
    }
    if (token.offering.accreditedOnly && !recip.accredited) {
      eligible = false;
      reasons.push('Offering is restricted to accredited investors only');
    }
    if (!token.offering.allowedJurisdictions.includes(recip.jurisdiction)) {
      eligible = false;
      reasons.push(`Recipient jurisdiction "${recip.jurisdiction}" is not in the allowed jurisdictions list: ${token.offering.allowedJurisdictions.join(', ')}`);
    }
    // Position limit
    if (recip.maxPositionUsd && token.tokenPriceUsd) {
      const newValue = recip.holdingValue + (amount * token.tokenPriceUsd);
      if (newValue > recip.maxPositionUsd) {
        eligible = false;
        reasons.push(`Transfer would cause recipient to exceed max position of $${recip.maxPositionUsd.toLocaleString()}`);
      }
    }
  }

  // Sender checks
  if (sender) {
    // Check hold period
    const senderTransfers = TRANSFERS.filter(t => t.tokenId === tokenId && t.fromAddress === fromAddress?.toLowerCase() && t.type === 'purchase');
    if (senderTransfers.length > 0) {
      const earliest = Math.min(...senderTransfers.map(t => new Date(t.timestamp).getTime()));
      const holdDays  = (Date.now() - earliest) / (1000 * 3600 * 24);
      if (holdDays < token.offering.holdPeriodDays) {
        const remaining = Math.ceil(token.offering.holdPeriodDays - holdDays);
        eligible = false;
        reasons.push(`Sender is within the ${token.offering.holdPeriodDays}-day lock-up period (${remaining} days remaining)`);
      }
    }
  }

  if (amount <= 0) {
    eligible = false;
    reasons.push('Transfer amount must be greater than 0');
  }

  if (eligible && warnings.length === 0) {
    warnings.push('Transfer is compliant. ERC-1400 transferWithData() calldata should include this eligibility proof hash.');
  }

  // ERC-1400 status codes
  const statusCode = eligible ? 81 : (reasons.some(r => r.includes('OFAC') || r.includes('AML')) ? 80 : 82);

  return {
    eligible,
    reasons,
    warnings,
    statusCode,         // ERC-1400 EIP-1066 status code: 0x51=can transfer, 0x50=not authorized, 0x52=insufficient balance
    token:  token ? { tokenId: token.tokenId, symbol: `KNT-${token.loanNumber?.slice(-4) || token.tokenId.slice(0,4)}`, partitionType: token.partitionType, status: token.status } : null,
    sender: sender ? { address: sender.address, kycStatus: sender.kycStatus, jurisdiction: sender.jurisdiction } : null,
    recipient: recip ? { address: recip.address, kycStatus: recip.kycStatus, amlStatus: recip.amlStatus, jurisdiction: recip.jurisdiction } : null,
    checkedAt: new Date().toISOString(),
  };
}

// ── Token Transfers ───────────────────────────────────────────────────────────

function recordTransfer({ tokenId, fromAddress, toAddress, amount, priceUsd, stablecoin, type = 'secondary', txHash, blockNumber } = {}) {
  const transfer = {
    transferId:  uuidv4(),
    tokenId, fromAddress: fromAddress?.toLowerCase(), toAddress: toAddress?.toLowerCase(),
    amount, priceUsd, totalValueUsd: amount * (priceUsd || 0),
    stablecoin,   // USDC | USDT | DAI | PYUSD | EURC | null (off-chain)
    type,         // purchase | secondary | redemption | forced
    txHash:       txHash || `0x${crypto.randomBytes(32).toString('hex')}`,
    blockNumber:  blockNumber || fakeBlockNumber(),
    timestamp:    new Date().toISOString(),
    status:       'confirmed',
  };
  TRANSFERS.push(transfer);

  // Update token stats
  const token = TOKEN_PACKAGES.get(tokenId);
  if (token) {
    token.transferCount++;
    if (type === 'purchase') { token.tokensIssued += amount; token.tokensOutstanding += amount; }
    if (type === 'redemption') token.tokensOutstanding -= amount;
  }

  // Update wallet stats
  const to = WALLETS.get(toAddress?.toLowerCase());
  if (to) { to.holdingValue += amount * (priceUsd || 0); to.transferCount++; }
  const from = WALLETS.get(fromAddress?.toLowerCase());
  if (from) { from.holdingValue = Math.max(0, from.holdingValue - amount * (priceUsd || 0)); from.transferCount++; }

  return transfer;
}

function listTransfers({ tokenId, address, type, limit = 50 } = {}) {
  let txs = TRANSFERS.slice().reverse();
  if (tokenId) txs = txs.filter(t => t.tokenId === tokenId);
  if (address) txs = txs.filter(t => t.fromAddress === address.toLowerCase() || t.toAddress === address.toLowerCase());
  if (type)    txs = txs.filter(t => t.type === type);
  return txs.slice(0, limit);
}

// ── Stablecoin Payment Reconciliation ────────────────────────────────────────

const STABLECOIN_DECIMALS = { USDC: 6, USDT: 6, DAI: 18, PYUSD: 6, EURC: 6 };

function recordPayment({
  tokenId, fromAddress, amount, stablecoin = 'USDC', paymentType = 'interest',
  periodStart, periodEnd, txHash, notes,
} = {}) {
  const payment = {
    paymentId:   uuidv4(),
    tokenId, fromAddress: fromAddress?.toLowerCase(),
    amount, stablecoin,
    amountRaw:   BigInt(Math.round(amount * 10 ** (STABLECOIN_DECIMALS[stablecoin] || 6))).toString(),
    paymentType,  // interest | principal | interest_principal | prepayment | late_fee | payoff
    periodStart: periodStart || null,
    periodEnd:   periodEnd   || null,
    txHash:      txHash || `0x${crypto.randomBytes(32).toString('hex')}`,
    blockNumber: fakeBlockNumber(),
    reconciled:  false,
    reconciledAt: null,
    notes,
    recordedAt:  new Date().toISOString(),
  };
  PAYMENTS.push(payment);
  return payment;
}

function reconcilePayment(paymentId) {
  const payment = PAYMENTS.find(p => p.paymentId === paymentId);
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  payment.reconciled  = true;
  payment.reconciledAt = new Date().toISOString();
  return payment;
}

function listPayments({ tokenId, stablecoin, reconciled, limit = 50 } = {}) {
  let pays = PAYMENTS.slice().reverse();
  if (tokenId)    pays = pays.filter(p => p.tokenId === tokenId);
  if (stablecoin) pays = pays.filter(p => p.stablecoin === stablecoin);
  if (reconciled !== undefined) pays = pays.filter(p => p.reconciled === reconciled);
  return pays.slice(0, limit);
}

// ── Secondary Market Order Book ───────────────────────────────────────────────

function placeOrder({ tokenId, side, address, amount, priceUsd, expiry } = {}) {
  const order = {
    orderId:   uuidv4(),
    tokenId, side,   // buy | sell
    address:   address?.toLowerCase(),
    amount, priceUsd,
    totalValueUsd: amount * priceUsd,
    expiry:    expiry || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    status:    'open',    // open | filled | cancelled | expired
    filledAmount: 0,
    placedAt:  new Date().toISOString(),
  };
  ORDER_BOOK.push(order);
  return order;
}

function getOrderBook(tokenId) {
  const now = new Date();
  const active = ORDER_BOOK.filter(o => o.tokenId === tokenId && o.status === 'open' && new Date(o.expiry) > now);
  const bids = active.filter(o => o.side === 'buy').sort((a, b) => b.priceUsd - a.priceUsd);
  const asks = active.filter(o => o.side === 'sell').sort((a, b) => a.priceUsd - b.priceUsd);
  const trades = TRANSFERS.filter(t => t.tokenId === tokenId && t.type === 'secondary').slice(-10);
  const midPrice = bids[0] && asks[0] ? (bids[0].priceUsd + asks[0].priceUsd) / 2 : null;
  return { tokenId, bids, asks, midPrice, trades, updatedAt: new Date().toISOString() };
}

// ── Investor Governance ───────────────────────────────────────────────────────

const PROPOSAL_TYPES = ['maturity_extension', 'rate_modification', 'property_disposition', 'servicer_replacement', 'covenant_waiver', 'special_distribution'];

function createProposal({ tokenId, proposerAddress, type, title, description, options = ['Approve', 'Reject'], votingDeadline, orgId } = {}) {
  if (!PROPOSAL_TYPES.includes(type)) throw new Error(`Invalid proposal type. Must be one of: ${PROPOSAL_TYPES.join(', ')}`);
  const proposalId = uuidv4();
  const proposal = {
    proposalId, tokenId,
    proposerAddress: proposerAddress?.toLowerCase(),
    type, title, description,
    options: options.map((label, i) => ({ id: i, label, votes: 0, votingPower: 0 })),
    votingDeadline: votingDeadline || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    status: 'active',   // active | passed | rejected | cancelled
    totalVotingPower: 0,
    quorumPct: 0.51,
    orgId,
    createdAt: new Date().toISOString(),
  };
  GOV_PROPOSALS.set(proposalId, proposal);
  return proposal;
}

function castVote({ proposalId, voterAddress, optionId, votingPower = 1 } = {}) {
  const proposal = GOV_PROPOSALS.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
  if (proposal.status !== 'active') throw new Error('Proposal is not active');
  if (new Date(proposal.votingDeadline) < new Date()) throw new Error('Voting period has ended');

  const existing = GOV_VOTES.find(v => v.proposalId === proposalId && v.voterAddress === voterAddress?.toLowerCase());
  if (existing) throw new Error('Already voted on this proposal');

  const vote = { voteId: uuidv4(), proposalId, voterAddress: voterAddress?.toLowerCase(), optionId, votingPower, castAt: new Date().toISOString() };
  GOV_VOTES.push(vote);

  const option = proposal.options[optionId];
  if (option) { option.votes++; option.votingPower += votingPower; }
  proposal.totalVotingPower += votingPower;

  return vote;
}

function listProposals({ tokenId, status } = {}) {
  let proposals = Array.from(GOV_PROPOSALS.values());
  if (tokenId) proposals = proposals.filter(p => p.tokenId === tokenId);
  if (status)  proposals = proposals.filter(p => p.status === status);
  return proposals;
}

// ── Seed demo data ────────────────────────────────────────────────────────────

function seedDemoData() {
  if (TOKEN_PACKAGES.size > 0) return;

  // Token package
  const pkg = createTokenPackage({
    loanId: 'LN-0094', loanNumber: 'LN-0094',
    propertyAddress: '1204 Harbor View Drive, Miami, FL 33101',
    propertyType: 'multifamily', loanBalance: 8_750_000, propertyValue: 12_500_000,
    ltv: 0.70, dscr: 1.22, noi: 687_500, interestRate: 0.0675,
    maturityDate: '2028-06-01', originationDate: '2023-06-01',
    borrowerName: 'Harbor View Partners LLC',
    partitionType: 'whole_loan', totalTokens: 1000, tokenPriceUsd: 8750,
    offering: { accreditedOnly: true, holdPeriodDays: 90, targetYield: 0.0675, offeringSize: 8_750_000, allowedJurisdictions: ['US', 'CA', 'GB', 'SG'] },
    orgId: 'demo-org',
  });
  updateTokenStatus(pkg.tokenId, 'active', { tokensIssued: 650, tokensOutstanding: 610, investorCount: 8 });

  // Wallets
  whitelistWallet({ address: '0xA1b2C3d4E5f67890123456789012345678901234', investorName: 'Meridian Capital Fund III', investorType: 'institutional', jurisdiction: 'US', accredited: true, kycStatus: 'approved', amlStatus: 'cleared', maxPositionUsd: 2_000_000, tokenIds: [pkg.tokenId], orgId: 'demo-org' });
  whitelistWallet({ address: '0xB2c3D4e5F6789012345678901234567890123456', investorName: 'First National Trust', investorType: 'institutional', jurisdiction: 'US', accredited: true, kycStatus: 'approved', amlStatus: 'cleared', maxPositionUsd: 5_000_000, tokenIds: [pkg.tokenId], orgId: 'demo-org' });
  whitelistWallet({ address: '0xC3d4E5f6A789012345678901234567890123456b', investorName: 'Singapore Growth Fund', investorType: 'institutional', jurisdiction: 'SG', accredited: true, kycStatus: 'approved', amlStatus: 'cleared', maxPositionUsd: 1_500_000, tokenIds: [pkg.tokenId], orgId: 'demo-org' });
  whitelistWallet({ address: '0xD4e5F6a7B890123456789012345678901234567c', investorName: 'James T. Harrington III', investorType: 'accredited_individual', jurisdiction: 'US', accredited: true, kycStatus: 'pending', amlStatus: 'pending', maxPositionUsd: 500_000, orgId: 'demo-org' });
  whitelistWallet({ address: '0xE5f6A7b8C901234567890123456789012345678d', investorName: 'London RE Partners', investorType: 'family_office', jurisdiction: 'GB', accredited: true, kycStatus: 'approved', amlStatus: 'cleared', maxPositionUsd: 3_000_000, tokenIds: [pkg.tokenId], orgId: 'demo-org' });

  // Payments
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  for (let i = 0; i < 6; i++) {
    const pd = new Date(d); pd.setMonth(pd.getMonth() - i);
    const pe = new Date(pd); pe.setMonth(pe.getMonth() + 1);
    recordPayment({ tokenId: pkg.tokenId, fromAddress: '0xA1b2C3d4E5f67890123456789012345678901234', amount: 49_218.75, stablecoin: 'USDC', paymentType: 'interest', periodStart: pd.toISOString().slice(0,10), periodEnd: pe.toISOString().slice(0,10) });
  }
  PAYMENTS.forEach(p => { if (p.paymentType === 'interest') { p.reconciled = true; p.reconciledAt = new Date().toISOString(); } });

  // Orders
  placeOrder({ tokenId: pkg.tokenId, side: 'sell', address: '0xA1b2C3d4E5f67890123456789012345678901234', amount: 50, priceUsd: 8850 });
  placeOrder({ tokenId: pkg.tokenId, side: 'sell', address: '0xB2c3D4e5F6789012345678901234567890123456', amount: 100, priceUsd: 8900 });
  placeOrder({ tokenId: pkg.tokenId, side: 'buy',  address: '0xC3d4E5f6A789012345678901234567890123456b', amount: 75,  priceUsd: 8700 });
  placeOrder({ tokenId: pkg.tokenId, side: 'buy',  address: '0xE5f6A7b8C901234567890123456789012345678d', amount: 150, priceUsd: 8650 });

  // Governance proposal
  createProposal({ tokenId: pkg.tokenId, proposerAddress: '0xA1b2C3d4E5f67890123456789012345678901234', type: 'maturity_extension', title: 'Extend Loan Maturity by 12 Months', description: 'Borrower has requested a 12-month maturity extension to June 2029 to complete planned capital improvements and refinance in a more favorable rate environment. Current DSCR of 1.22 exceeds covenant minimums. Extension fee of 25bps proposed.', options: ['Approve extension', 'Reject — demand payoff', 'Approve with conditions'], orgId: 'demo-org' });

  // Cast some votes
  const proposals = listProposals({ tokenId: pkg.tokenId });
  if (proposals.length > 0) {
    try { castVote({ proposalId: proposals[0].proposalId, voterAddress: '0xB2c3D4e5F6789012345678901234567890123456', optionId: 0, votingPower: 250 }); } catch (_) {}
    try { castVote({ proposalId: proposals[0].proposalId, voterAddress: '0xE5f6A7b8C901234567890123456789012345678d', optionId: 0, votingPower: 150 }); } catch (_) {}
    try { castVote({ proposalId: proposals[0].proposalId, voterAddress: '0xC3d4E5f6A789012345678901234567890123456b', optionId: 2, votingPower: 100 }); } catch (_) {}
  }

  // Transfers
  recordTransfer({ tokenId: pkg.tokenId, fromAddress: '0x0000000000000000000000000000000000000000', toAddress: '0xA1b2C3d4E5f67890123456789012345678901234', amount: 300, priceUsd: 8750, stablecoin: 'USDC', type: 'purchase' });
  recordTransfer({ tokenId: pkg.tokenId, fromAddress: '0x0000000000000000000000000000000000000000', toAddress: '0xB2c3D4e5F6789012345678901234567890123456', amount: 250, priceUsd: 8750, stablecoin: 'USDC', type: 'purchase' });
  recordTransfer({ tokenId: pkg.tokenId, fromAddress: '0x0000000000000000000000000000000000000000', toAddress: '0xE5f6A7b8C901234567890123456789012345678d', amount: 100, priceUsd: 8750, stablecoin: 'USDC', type: 'purchase' });
}

seedDemoData();

module.exports = {
  createTokenPackage, updateTokenStatus, listTokens, getToken,
  whitelistWallet, updateWalletKyc, removeWallet, listWallets, getWallet,
  checkTransferEligibility, recordTransfer, listTransfers,
  recordPayment, reconcilePayment, listPayments,
  placeOrder, getOrderBook,
  createProposal, castVote, listProposals,
  PARTITION_TYPES, INVESTOR_TYPES, PROPOSAL_TYPES,
};
