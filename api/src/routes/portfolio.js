const express = require('express');
const { createEntityRouter } = require('./entityRouter');

const router = express.Router();
router.use(createEntityRouter('/loans', 'loans'));
router.use(createEntityRouter('/assets', 'assets'));

module.exports = router;
