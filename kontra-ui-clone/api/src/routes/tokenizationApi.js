/**
 * Kontra Tokenization API — Phase 6
 * Mounted at: /api/tokenization
 *
 * Routes:
 *   POST   /api/tokenization/assess          — run readiness assessment
 *   GET    /api/tokenization/assess/demo      — demo assessment for sample loan
 *
 *   POST   /api/tokenization/packages         — create ERC-1400 token package
 *   GET    /api/tokenization/packages         — list token packages
 *   GET    /api/tokenization/packages/:id     — get token package details
 *   PATCH  /api/tokenization/packages/:id/status — update status
 *
 *   GET    /api/tokenization/whitelist         — list whitelisted wallets
 *   POST   /api/tokenization/whitelist         — whitelist a wallet
 *   PATCH  /api/tokenization/whitelist/:address/kyc — update KYC/AML status
 *   DELETE /api/tokenization/whitelist/:address — remove wallet
 *
 *   POST   /api/tokenization/transfer-check    — check transfer eligibility
 *   POST   /api/tokenization/transfer          — record a transfer
 *   GET    /api/tokenization/transfers          — list transfers
 *
 *   GET    /api/tokenization/payments           — list payments
 *   POST   /api/tokenization/payments           — record stablecoin payment
 *   PATCH  /api/tokenization/payments/:id/reconcile — reconcile payment
 *
 *   GET    /api/tokenization/secondary-market/:tokenId — get order book
 *   POST   /api/tokenization/secondary-market/order    — place order
 *
 *   GET    /api/tokenization/governance/proposals        — list proposals
 *   POST   /api/tokenization/governance/proposals        — create proposal
 *   POST   /api/tokenization/governance/vote             — cast vote
 *
 *   GET    /api/tokenization/stats                       — combined stats
 */

'use strict';

const express     = require('express');
const engine      = require('../../lib/tokenizationEngine');
const registry    = require('../../lib/tokenRegistry');
const eventBus    = require('../../lib/eventBus');

const router = express.Router();

// ── Org context ───────────────────────────────────────────────────────────────

router.use((req, res, next) => {
  req.orgId = req.headers['x-org-id'] || req.user?.orgId || 'demo-org';
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// READINESS ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────

// Demo assessment (no body required)
router.get('/assess/demo', (req, res) => {
  const demoLoan = {
    loan_number: 'LN-0094', borrower_name: 'Harbor View Partners LLC',
    property_address: '1204 Harbor View Drive, Miami, FL 33101',
    property_type: 'multifamily', original_balance: 9_000_000, current_balance: 8_750_000,
    interest_rate: 0.0675, maturity_date: '2028-06-01', origination_date: '2023-06-01',
    amortization_term: 360, loan_type: 'fixed', property_value: 12_500_000,
    ltv: 0.70, dscr: 1.22, noi: 687_500, occupancy_rate: 0.94,
    servicer_name: 'Kontra Servicing Inc.', tax_id: '82-1234567', entity_type: 'LLC',
  };
  const demoServicing = { months_on_books: 22, delinquent_days_30: 0, delinquent_days_60: 0, delinquent_days_90: 0, forbearance_count: 0, modification_count: 0, payment_history_months: 22, last_payment_date: new Date().toISOString().slice(0,10), watchlist_status: false, special_servicing: false };
  const demoCompliance = { dscr_current: 1.22, ltv_current: 0.70, insurance_expiry: new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString().slice(0,10), inspection_date: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0,10), tax_payments_current: true, ofac_cleared: true, aml_cleared: true, bsa_compliant: true, state_usury_compliant: true, respa_compliant: true, dodd_frank_compliant: true };
  const demoCovenants = { dscr_covenant: 1.15, dscr_actual: 1.22, ltv_covenant: 0.75, ltv_actual: 0.70, occupancy_covenant: 0.85, occupancy_actual: 0.94, reserve_balance: 125_000, reserve_requirement: 100_000, reporting_current: true, consent_violations: 0, cure_period_active: false };
  const demoDocs = ['loan_agreement','promissory_note','deed_of_trust','title_policy','appraisal','environmental','insurance_binder','entity_documents','rent_roll','operating_stmt'];
  const result = engine.assessReadiness(demoLoan, { servicingHistory: demoServicing, compliance: demoCompliance, covenants: demoCovenants, documents: demoDocs });
  res.json(result);
});

// Custom assessment
router.post('/assess', (req, res) => {
  const { loan, servicingHistory, compliance, covenants, documents } = req.body;
  if (!loan) return res.status(400).json({ error: 'loan object required' });
  try {
    const result = engine.assessReadiness(loan, { servicingHistory, compliance, covenants, documents });
    eventBus.emit('agent.action', { action: 'tokenization_assessment', loanId: loan.loan_number, score: result.score, status: result.status }, { orgId: req.orgId });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN PACKAGES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/packages', (req, res) => {
  const { status } = req.query;
  res.json(registry.listTokens({ orgId: req.orgId, status }));
});

router.post('/packages', (req, res) => {
  try {
    const pkg = registry.createTokenPackage({ ...req.body, orgId: req.orgId });
    eventBus.emit('token.issued', { tokenId: pkg.tokenId, loanId: pkg.loanId, totalTokens: pkg.totalTokens, contractAddress: pkg.contractAddress }, { orgId: req.orgId });
    res.status(201).json(pkg);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/packages/:id', (req, res) => {
  const pkg = registry.getToken(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Token package not found' });
  res.json(pkg);
});

router.patch('/packages/:id/status', (req, res) => {
  const { status, ...patch } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const pkg = registry.updateTokenStatus(req.params.id, status, patch);
    res.json(pkg);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// INVESTOR WHITELIST
// ─────────────────────────────────────────────────────────────────────────────

router.get('/whitelist', (req, res) => {
  const { kycStatus, tokenId } = req.query;
  res.json(registry.listWallets({ orgId: req.orgId, kycStatus, tokenId }));
});

router.post('/whitelist', (req, res) => {
  try {
    const wallet = registry.whitelistWallet({ ...req.body, orgId: req.orgId });
    eventBus.emit('agent.action', { action: 'wallet_whitelisted', address: wallet.address, investorName: wallet.investorName, kycStatus: wallet.kycStatus }, { orgId: req.orgId });
    res.status(201).json(wallet);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/whitelist/:address/kyc', (req, res) => {
  try {
    const wallet = registry.updateWalletKyc(req.params.address, req.body);
    res.json(wallet);
  } catch (err) { res.status(404).json({ error: err.message }); }
});

router.delete('/whitelist/:address', (req, res) => {
  const ok = registry.removeWallet(req.params.address);
  if (ok) res.json({ ok: true }); else res.status(404).json({ error: 'Wallet not found' });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER ELIGIBILITY + HISTORY
// ─────────────────────────────────────────────────────────────────────────────

router.post('/transfer-check', (req, res) => {
  const { tokenId, fromAddress, toAddress, amount } = req.body;
  if (!tokenId || !toAddress) return res.status(400).json({ error: 'tokenId and toAddress required' });
  const result = registry.checkTransferEligibility(tokenId, fromAddress, toAddress, amount || 1);
  res.json(result);
});

router.post('/transfer', (req, res) => {
  try {
    const xfer = registry.recordTransfer({ ...req.body });
    eventBus.emit('token.transferred', { transferId: xfer.transferId, tokenId: xfer.tokenId, from: xfer.fromAddress, to: xfer.toAddress, amount: xfer.amount, valueUsd: xfer.totalValueUsd }, { orgId: req.orgId });
    res.status(201).json(xfer);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/transfers', (req, res) => {
  const { tokenId, address, type, limit } = req.query;
  res.json(registry.listTransfers({ tokenId, address, type, limit: parseInt(limit) || 50 }));
});

// ─────────────────────────────────────────────────────────────────────────────
// STABLECOIN PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/payments', (req, res) => {
  const { tokenId, stablecoin, limit } = req.query;
  const reconciled = req.query.reconciled !== undefined ? req.query.reconciled === 'true' : undefined;
  res.json(registry.listPayments({ tokenId, stablecoin, reconciled, limit: parseInt(limit) || 50 }));
});

router.post('/payments', (req, res) => {
  try {
    const payment = registry.recordPayment({ ...req.body });
    eventBus.emit('token.transferred', { action: 'payment_received', paymentId: payment.paymentId, amount: payment.amount, stablecoin: payment.stablecoin, paymentType: payment.paymentType }, { orgId: req.orgId });
    res.status(201).json(payment);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/payments/:id/reconcile', (req, res) => {
  try {
    const payment = registry.reconcilePayment(req.params.id);
    res.json(payment);
  } catch (err) { res.status(404).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY MARKET
// ─────────────────────────────────────────────────────────────────────────────

router.get('/secondary-market/:tokenId', (req, res) => {
  const book = registry.getOrderBook(req.params.tokenId);
  res.json(book);
});

router.post('/secondary-market/order', (req, res) => {
  try {
    const order = registry.placeOrder({ ...req.body });
    res.status(201).json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// INVESTOR GOVERNANCE
// ─────────────────────────────────────────────────────────────────────────────

router.get('/governance/proposals', (req, res) => {
  const { tokenId, status } = req.query;
  res.json(registry.listProposals({ tokenId, status }));
});

router.post('/governance/proposals', (req, res) => {
  try {
    const proposal = registry.createProposal({ ...req.body, orgId: req.orgId });
    eventBus.emit('agent.action', { action: 'governance_proposal_created', proposalId: proposal.proposalId, type: proposal.type, title: proposal.title }, { orgId: req.orgId });
    res.status(201).json(proposal);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/governance/vote', (req, res) => {
  const { proposalId, voterAddress, optionId, votingPower } = req.body;
  if (!proposalId || !voterAddress || optionId === undefined) return res.status(400).json({ error: 'proposalId, voterAddress, optionId required' });
  try {
    const vote = registry.castVote({ proposalId, voterAddress, optionId, votingPower });
    res.status(201).json(vote);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const tokens   = registry.listTokens({ orgId: req.orgId });
  const wallets  = registry.listWallets({ orgId: req.orgId });
  const payments = registry.listPayments({ limit: 1000 });
  const proposals= registry.listProposals({});

  const totalTvl     = tokens.reduce((s, t) => s + (t.tokensOutstanding * (t.tokenPriceUsd || 0)), 0);
  const totalPayments= payments.reduce((s, p) => s + p.amount, 0);
  const unreconciled = payments.filter(p => !p.reconciled).length;

  res.json({
    totalTokenPackages:    tokens.length,
    activePackages:        tokens.filter(t => t.status === 'active').length,
    totalTvlUsd:           totalTvl,
    totalInvestors:        wallets.length,
    approvedInvestors:     wallets.filter(w => w.kycStatus === 'approved').length,
    pendingKyc:            wallets.filter(w => w.kycStatus === 'pending').length,
    totalPaymentVolumeUsd: totalPayments,
    unreconciledPayments:  unreconciled,
    activeProposals:       proposals.filter(p => p.status === 'active').length,
    erc1400Compliant:      tokens.every(t => t.standard === 'ERC-1400'),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// METADATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/erc1400-spec', (req, res) => {
  res.json({ requirements: engine.ERC1400_REQUIREMENTS, requiredLoanFields: engine.REQUIRED_LOAN_FIELDS.map(f => f.key), requiredDocuments: engine.REQUIRED_DOCUMENTS.map(d => ({ id: d.id, label: d.label, critical: d.critical })), partitionTypes: registry.PARTITION_TYPES, investorTypes: registry.INVESTOR_TYPES, proposalTypes: registry.PROPOSAL_TYPES });
});

module.exports = router;
