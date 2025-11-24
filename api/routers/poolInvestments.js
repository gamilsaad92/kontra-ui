const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { createPool, recordInvestment, getPoolDetails } = require('../services/poolInvestmentService');

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

router.post('/investments', async (req, res) => {
  try {
    const result = await recordInvestment(req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    const message = err?.message || 'Unable to record investment';
    return res.status(400).json({ message });
  }
});

module.exports = router;
