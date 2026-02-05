const express = require('express');

const packsRouter = require('./policy.packs');
const regulationsRouter = require('./policy.regulations');
const rulesRouter = require('./policy.rules');
const impactRouter = require('./policy.impact');
const evaluateRouter = require('./policy.evaluate');
const findingsRouter = require('./policy.findings');

const router = express.Router();

router.use(packsRouter);
router.use(regulationsRouter);
router.use(rulesRouter);
router.use(impactRouter);
router.use(evaluateRouter);
router.use(findingsRouter);

module.exports = router;
