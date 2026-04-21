const express = require('express');
const { createEntityRouter } = require('./entityRouter');

const router = express.Router();
router.use(createEntityRouter('/reports', 'reports'));

module.exports = router;
