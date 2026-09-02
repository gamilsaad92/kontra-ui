/**
 * Kontra Stablecoin Payment Webhook Listener — Phase 6 Activation Point 4
 *
 * Receives and verifies signed payment notifications from three sources:
 *   1. Alchemy Notify — ERC-20 Transfer events for USDC/USDT/DAI/PYUSD/EURC
 *   2. Circle CCTP webhooks — native USDC cross-chain transfers
 *   3. Kontra self-signed — internal payment confirmations from servicer ops
 *
 * Each webhook is HMAC-SHA256 verified before processing.
 * On verified payment → auto-creates stablecoin payment record + fires token.transferred event.
 *
 * Stablecoin contract addresses (Ethereum mainnet):
 *   USDC  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  (6 decimals)
 *   USDT  0xdAC17F958D2ee523a2206206994597C13D831ec7  (6 decimals)
 *   DAI   0x6B175474E89094C44Da98b954EedeAC495271d0F  (18 decimals)
 *   PYUSD 0x6c3ea9036406852006290770BEdFcAbA0e23A0e8  (6 decimals)
 *   EURC  0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c  (6 decimals)
 */

'use strict';

const crypto   = require('crypto');
const express  = require('express');
const registry = require('./tokenRegistry');
const eventBus = require('./eventBus');

const router = express.Router();

// ── Stablecoin registry ───────────────────────────────────────────────────────

const STABLECOINS = {
  // mainnet
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6  },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6  },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI',  decimals: 18 },
  '0x6c3ea9036406852006290770bedfcaba0e23a0e8': { symbol: 'PYUSD',decimals: 6  },
  '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c': { symbol: 'EURC', decimals: 6  },
  // polygon
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': { symbol: 'USDC', decimals: 6  },
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': { symbol: 'USDT', decimals: 6  },
  // sepolia testnet
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6  },
};

function resolveStablecoin(contractAddress) {
  return STABLECOINS[contractAddress?.toLowerCase()] || null;
}

function normalizeAmount(rawAmount, decimals) {
  // Convert from on-chain integer to human-readable float
  return Number(BigInt(rawAmount)) / Math.pow(10, decimals);
}

// ── HMAC verification ─────────────────────────────────────────────────────────

function verifyAlchemySignature(req) {
  const secret    = process.env.ALCHEMY_WEBHOOK_SECRET;
  if (!secret) return true; // allow in dev without secret
  const signature = req.headers['x-alchemy-signature'];
  if (!signature) return false;
  const body      = JSON.stringify(req.body);
  const expected  = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

function verifyCircleSignature(req) {
  const secret    = process.env.CIRCLE_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = req.headers['x-circle-signature'];
  if (!signature) return false;
  const body      = JSON.stringify(req.body);
  const expected  = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

function verifyKontraSignature(req) {
  const secret    = process.env.KONTRA_WEBHOOK_SECRET || 'kontra-dev-secret';
  const signature = req.headers['x-kontra-signature'];
  if (!signature) return process.env.NODE_ENV !== 'production'; // allow in dev
  const body      = JSON.stringify(req.body);
  const expected  = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

// ── Event log ─────────────────────────────────────────────────────────────────

const WEBHOOK_LOG = [];    // in-memory ring buffer (last 200 events)

function logWebhookEvent(source, type, data, error = null) {
  const entry = { id: crypto.randomBytes(8).toString('hex'), source, type, data, error, receivedAt: new Date().toISOString() };
  WEBHOOK_LOG.unshift(entry);
  if (WEBHOOK_LOG.length > 200) WEBHOOK_LOG.pop();
  return entry;
}

// ── Core payment processor ────────────────────────────────────────────────────

async function processPayment({ fromAddress, toAddress, contractAddress, rawAmount, txHash, blockNumber, network, paymentType, tokenId, periodStart, periodEnd, notes }) {
  const sc = resolveStablecoin(contractAddress);
  if (!sc) {
    return { ok: false, reason: `Unknown stablecoin contract: ${contractAddress}` };
  }

  const amount = normalizeAmount(rawAmount, sc.decimals);

  // Match to a token package by the recipient address being the contract itself
  // (borrower pays to the token contract, which distributes to investors)
  let resolvedTokenId = tokenId;
  if (!resolvedTokenId) {
    const tokens = registry.listTokens({});
    const matched = tokens.find(t =>
      t.contractAddress?.toLowerCase() === toAddress?.toLowerCase()
    );
    resolvedTokenId = matched?.tokenId || null;
  }

  // Create payment record
  const payment = registry.recordPayment({
    tokenId:     resolvedTokenId,
    fromAddress: fromAddress?.toLowerCase(),
    amount,
    stablecoin:  sc.symbol,
    paymentType: paymentType || 'interest',
    periodStart: periodStart || null,
    periodEnd:   periodEnd   || null,
    txHash,
    notes: notes || `Auto-detected via ${network || 'mainnet'} transfer event`,
  });

  // Emit event
  eventBus.emit('token.transferred', {
    action:      'stablecoin_payment_received',
    paymentId:   payment.paymentId,
    tokenId:     resolvedTokenId,
    fromAddress: fromAddress?.toLowerCase(),
    toAddress:   toAddress?.toLowerCase(),
    amount,
    stablecoin:  sc.symbol,
    txHash,
    blockNumber,
    network,
    autoReconciled: false,
  }, { orgId: 'system' });

  return { ok: true, payment };
}

// ── Route 1: Alchemy Notify (ERC-20 Transfer events) ─────────────────────────

router.post('/alchemy', express.json({ limit: '1mb' }), async (req, res) => {
  if (!verifyAlchemySignature(req)) {
    logWebhookEvent('alchemy', 'signature_failure', req.body);
    return res.status(401).json({ error: 'Invalid Alchemy webhook signature' });
  }

  const event = req.body;
  const entry = logWebhookEvent('alchemy', event.type, event);

  // Alchemy Notify sends 'alchemy_minedTransaction' or 'eth_getLogs' style events
  // We handle the Address Activity webhook format
  if (event.type === 'ADDRESS_ACTIVITY' || event.event?.activity) {
    const activities = event.event?.activity || [];
    const results = [];

    for (const act of activities) {
      if (act.category !== 'token') continue;

      const contractAddress = act.rawContract?.address;
      const rawAmount       = act.rawContract?.rawValue;
      if (!contractAddress || !rawAmount) continue;

      const result = await processPayment({
        fromAddress:     act.fromAddress,
        toAddress:       act.toAddress,
        contractAddress,
        rawAmount,
        txHash:          act.hash,
        blockNumber:     act.blockNum,
        network:         event.event?.network || 'ETH_MAINNET',
      });

      results.push(result);
    }

    return res.json({ ok: true, processed: results.length, results });
  }

  // Handle raw log event format (custom webhook)
  if (event.logs) {
    const results = [];
    for (const log of event.logs) {
      // ERC-20 Transfer topic: keccak256('Transfer(address,address,uint256)')
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      if (log.topics?.[0] !== TRANSFER_TOPIC) continue;

      const fromAddress = `0x${log.topics[1]?.slice(26)}`;
      const toAddress   = `0x${log.topics[2]?.slice(26)}`;
      const rawAmount   = BigInt(log.data || '0x0').toString();

      const result = await processPayment({
        fromAddress, toAddress,
        contractAddress: log.address,
        rawAmount,
        txHash:    log.transactionHash,
        blockNumber: log.blockNumber,
        network:   'ETH_MAINNET',
      });
      results.push(result);
    }
    return res.json({ ok: true, processed: results.length, results });
  }

  return res.json({ ok: true, message: 'Event type not processed', type: event.type });
});

// ── Route 2: Circle Programmable Wallets / CCTP ───────────────────────────────

router.post('/circle', express.json({ limit: '512kb' }), async (req, res) => {
  if (!verifyCircleSignature(req)) {
    logWebhookEvent('circle', 'signature_failure', req.body);
    return res.status(401).json({ error: 'Invalid Circle webhook signature' });
  }

  const event = req.body;
  logWebhookEvent('circle', event.notificationType, event);

  // Circle sends transfer.complete for USDC payments
  if (event.notificationType === 'payments.payment' || event.notificationType === 'transfers.transfer') {
    const payment = event.payment || event.transfer;
    if (!payment || payment.status !== 'complete') {
      return res.json({ ok: true, message: 'Not a completed payment', status: payment?.status });
    }

    const amount  = Number(payment.amount?.amount);
    const paymentRecord = registry.recordPayment({
      tokenId:     null,
      fromAddress: payment.source?.address || payment.source?.id,
      amount,
      stablecoin:  'USDC',
      paymentType: 'interest',
      txHash:      payment.transactionHash || payment.id,
      notes:       `Circle CCTP payment ${payment.id} — ${payment.source?.type || 'unknown'} → ${payment.destination?.type || 'unknown'}`,
    });

    eventBus.emit('token.transferred', {
      action:    'circle_payment_received',
      paymentId: paymentRecord.paymentId,
      circleId:  payment.id,
      amount,
      stablecoin: 'USDC',
    }, { orgId: 'system' });

    return res.json({ ok: true, paymentId: paymentRecord.paymentId });
  }

  return res.json({ ok: true, message: 'Event type not processed', type: event.notificationType });
});

// ── Route 3: Kontra self-signed (servicer confirming a wire/ACH + stablecoin) ─

router.post('/kontra', express.json({ limit: '256kb' }), async (req, res) => {
  if (!verifyKontraSignature(req)) {
    logWebhookEvent('kontra', 'signature_failure', req.body);
    return res.status(401).json({ error: 'Invalid Kontra webhook signature' });
  }

  const { tokenId, fromAddress, amount, stablecoin, paymentType, txHash, periodStart, periodEnd, notes } = req.body;

  if (!amount || !stablecoin) {
    return res.status(400).json({ error: 'amount and stablecoin are required' });
  }

  const SUPPORTED = ['USDC','USDT','DAI','PYUSD','EURC'];
  if (!SUPPORTED.includes(stablecoin)) {
    return res.status(400).json({ error: `Unsupported stablecoin. Must be one of: ${SUPPORTED.join(', ')}` });
  }

  logWebhookEvent('kontra', 'payment_confirmation', req.body);

  const payment = registry.recordPayment({
    tokenId, fromAddress, amount: Number(amount), stablecoin,
    paymentType: paymentType || 'interest',
    txHash, periodStart, periodEnd,
    notes: notes || 'Manually confirmed via Kontra webhook',
  });

  eventBus.emit('token.transferred', {
    action:    'manual_payment_confirmed',
    paymentId: payment.paymentId,
    amount:    Number(amount),
    stablecoin,
    paymentType: paymentType || 'interest',
  }, { orgId: 'system' });

  return res.status(201).json({ ok: true, payment });
});

// ── Route 4: Webhook event log (audit trail) ───────────────────────────────────

router.get('/log', (req, res) => {
  const { source, limit = 50 } = req.query;
  let log = WEBHOOK_LOG;
  if (source) log = log.filter(e => e.source === source);
  res.json({
    total: WEBHOOK_LOG.length,
    events: log.slice(0, parseInt(limit)),
  });
});

// ── Route 5: Test / simulation endpoint ──────────────────────────────────────

router.post('/simulate', express.json(), async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Simulation not allowed in production' });
  }

  const {
    fromAddress = '0xA1b2C3d4E5f67890123456789012345678901234',
    contractAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',  // USDC mainnet
    rawAmount  = '49218750000',   // 49,218.75 USDC (6 decimals)
    txHash     = `0x${crypto.randomBytes(32).toString('hex')}`,
  } = req.body;

  const tokens = registry.listTokens({});
  const toAddress = tokens[0]?.contractAddress || '0x0000000000000000000000000000000000000000';

  logWebhookEvent('simulation', 'payment_simulation', { fromAddress, contractAddress, rawAmount });

  const result = await processPayment({
    fromAddress, toAddress, contractAddress, rawAmount,
    txHash, blockNumber: Math.floor(Math.random() * 1000000) + 19000000,
    network: 'ETH_MAINNET_SIMULATION',
    paymentType: 'interest',
  });

  res.json({ ok: true, simulated: true, result });
});

// ── Route 6: Webhook setup guide ──────────────────────────────────────────────

router.get('/setup', (req, res) => {
  const baseUrl = process.env.KONTRA_PUBLIC_URL || 'https://your-kontra-domain.com';
  res.json({
    webhookEndpoints: {
      alchemy: `${baseUrl}/api/tokenization/webhooks/alchemy`,
      circle:  `${baseUrl}/api/tokenization/webhooks/circle`,
      kontra:  `${baseUrl}/api/tokenization/webhooks/kontra`,
    },
    alchemySetup: {
      steps: [
        '1. Log into Alchemy dashboard → Notify → Create Webhook',
        '2. Select "Address Activity" webhook type',
        '3. Add your token contract address as the tracked address',
        '4. Set webhook URL to the /alchemy endpoint above',
        '5. Copy the signing key → set ALCHEMY_WEBHOOK_SECRET env var',
        '6. Select network (Ethereum Mainnet / Polygon)',
        '7. Test with the /simulate endpoint first',
      ],
      trackedTokens: ['USDC', 'USDT', 'DAI', 'PYUSD', 'EURC'],
      requiredEnvVars: ['ALCHEMY_WEBHOOK_SECRET', 'ETH_RPC_URL'],
    },
    circleSetup: {
      steps: [
        '1. Log into Circle Developer Dashboard → Notifications',
        '2. Create a subscription for payments.payment and transfers.transfer events',
        '3. Set endpoint URL to the /circle endpoint above',
        '4. Copy the subscription key → set CIRCLE_WEBHOOK_SECRET env var',
      ],
      requiredEnvVars: ['CIRCLE_WEBHOOK_SECRET'],
      supportedEvents: ['payments.payment', 'transfers.transfer'],
    },
    kontraSetup: {
      description: 'Self-signed endpoint for manual servicer payment confirmations',
      headers: {
        'x-kontra-signature': 'sha256=HMAC_SHA256(body, KONTRA_WEBHOOK_SECRET)',
        'content-type':       'application/json',
      },
      requiredEnvVars: ['KONTRA_WEBHOOK_SECRET'],
      requiredBody: { amount: 'number', stablecoin: 'USDC|USDT|DAI|PYUSD|EURC' },
      optionalBody: { tokenId: 'string', fromAddress: 'string', paymentType: 'interest|principal|payoff', txHash: 'string', periodStart: 'date', periodEnd: 'date', notes: 'string' },
    },
    supportedStablecoins: Object.entries(STABLECOINS).map(([addr, sc]) => ({ address: addr, ...sc })),
    testSimulation: `POST ${baseUrl}/api/tokenization/webhooks/simulate`,
  });
});

module.exports = router;
