const express = require('express');
let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch {
  stripe = null;
}

const router = express.Router();

router.post('/payments/stripe', async (req, res) => {
  const { amount, currency = 'usd', order_id, metadata, method } = req.body || {};
  if (!amount) {
    return res.status(400).json({ message: 'Missing amount' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ message: 'Stripe not configured' });
  }
  if (!stripe) {
    // Fallback response when stripe library is unavailable
    return res.status(201).json({ client_secret: 'test_secret', test: true });
  }
  try {
 let params = {
      amount: Math.round(amount * 100),
      currency,
      metadata: { order_id, ...(metadata || {}) },
    };
    if (method === 'ach') {
      params.payment_method_types = ['us_bank_account'];
    } else {
      params.automatic_payment_methods = { enabled: true };
    }
    const intent = await stripe.paymentIntents.create(params);
    return res.status(201).json({ client_secret: intent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ message: 'Failed to create intent' });
  }
});

module.exports = router;
