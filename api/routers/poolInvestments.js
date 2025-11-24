const express = require('express');
const authenticate = require('../middlewares/authenticate');
const {
  createPool,
  recordInvestment,
  getPoolDetails,
  listOpenPools,
  getInvestorPortfolio,
  whitelistInvestor,
} = require('../services/poolInvestmentService');

const router = express.Router();

router.use(authenticate);

router.post('/pools', async (req, res) => {
  try {
    const result = await createPool(req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    const message = err?.message || 'Unable to create pool';
    return res.status(400).json({ message });
  }
});

router.get('/pools/:id', async (req, res) => {
  try {
    const pool = await getPoolDetails(req.params.id);
    if (!pool) {
      return res.status(404).json({ message: 'Pool not found' });
    }
    return res.json({ pool });
  } catch (err) {
    const message = err?.message || 'Unable to load pool';
    return res.status(400).json({ message });
  }
});

router.get('/investors/deal-room', async (req, res) => {
  const pools = await listOpenPools();
  return res.json({ pools });
});

router.get('/investors/:wallet/portfolio', async (req, res) => {
  try {
    const portfolio = await getInvestorPortfolio(req.params.wallet);
    return res.json(portfolio);
  } catch (err) {
    const message = err?.message || 'Unable to load investor portfolio';
    return res.status(400).json({ message });
  }
});

router.post('/investments', async (req, res) => {
  try {
    const result = await recordInvestment(req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    const message = err?.message || 'Unable to record investment';
    return res.status(400).json({ message });
  }
});

router.post('/investors/subscribe', async (req, res) => {
  const { wallet, pool_id, poolId, amount, investor_id, investorId } = req.body || {};
  const resolvedPoolId = poolId || pool_id;
  const resolvedInvestorId = investorId || investor_id || 'demo-investor';
  if (!wallet) {
    return res.status(400).json({ message: 'wallet is required' });
  }
  if (!resolvedPoolId) {
    return res.status(400).json({ message: 'pool_id is required' });
  }
  try {
    let whitelistResult = null;
    try {
      whitelistResult = await whitelistInvestor(resolvedInvestorId, wallet);
    } catch (err) {
      console.warn('Skipping whitelist fallback:', err?.message || err);
    }

    const investment = await recordInvestment({
      pool_id: resolvedPoolId,
      investor_id: resolvedInvestorId,
      amount,
      wallet,
    });

    return res.status(201).json({
      ...investment,
      whitelist: whitelistResult?.whitelist,
    });
  } catch (err) {
    const message = err?.message || 'Unable to subscribe to pool';
    return res.status(400).json({ message });
  }
});

module.exports = router;
