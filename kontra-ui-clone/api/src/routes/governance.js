const express = require('express');
const { createEntityRouter } = require('./entityRouter');

const router = express.Router();
router.use(createEntityRouter('/compliance-items', 'compliance_items'));
router.use(createEntityRouter('/legal-items', 'legal_items'));
router.use(createEntityRouter('/regulatory-scans', 'regulatory_scans'));
router.use(createEntityRouter('/risk-items', 'risk_items'));
router.use(createEntityRouter('/document-reviews', 'document_reviews'));

module.exports = router;
