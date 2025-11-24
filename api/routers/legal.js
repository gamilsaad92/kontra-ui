const express = require('express');
const authenticate = require('../middlewares/authenticate');
const auditLogger = require('../middlewares/auditLogger');
const requireRole = require('../middlewares/requireRole');
const { getLegalConfiguration, updateLegalConfiguration } = require('../legalConfiguration');

const router = express.Router();

router.use(authenticate);
router.use(auditLogger);

router.get('/config', (_req, res) => {
  res.json({ config: getLegalConfiguration() });
});

router.post('/config', requireRole('admin'), (req, res) => {
  const updates = req.body || {};
  const config = updateLegalConfiguration(updates);
  res.status(200).json({ config });
});

module.exports = router;
