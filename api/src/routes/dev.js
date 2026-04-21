const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const requireRole = require('../../middlewares/requireRole');
const { buildRoutesManifest } = require('../dev/routesManifest');

const router = express.Router();

router.get('/routes', authenticate, requireRole('admin'), (req, res) => {
  const routes = buildRoutesManifest(req.app);
  res.json({ routes });
});

module.exports = router;
