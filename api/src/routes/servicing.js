const express = require('express');
const { createEntityRouter } = require('./entityRouter');

const router = express.Router();
router.use(createEntityRouter('/payments', 'payments'));
router.use(createEntityRouter('/inspections', 'inspections'));
router.use(createEntityRouter('/draws', 'draws'));
router.use(createEntityRouter('/escrows', 'escrows'));
router.use(createEntityRouter('/borrower-financials', 'borrower_financials'));
router.use(createEntityRouter('/management', 'management_items'));

module.exports = router;
