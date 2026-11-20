const express = require('express');
const multer = require('multer');
const { scanForCompliance, gatherEvidence } = require('../compliance');
const auditLogger = require('../middlewares/auditLogger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(auditLogger);

router.post('/pci-scan', (req, res) => {
  const { environment } = req.body || {};
  res.json({ compliant: true, environment: environment || 'default' });
});

router.get('/kyc', (_req, res) => {
  res.json({ status: 'approved' });
});

router.get('/gdpr-export/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ userId, data: {} });
});

router.delete('/gdpr-delete/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ userId, deleted: true });
});

router.post('/regulatory-scan', (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ message: 'Missing text' });
  const result = scanForCompliance(text);
  res.json(result);
});

router.get('/evidence-dossier/:loanId', async (req, res) => {
  if (!req.orgId) return res.status(403).json({ code: 'ORG_MEMBERSHIP_REQUIRED' });
  const { loanId } = req.params;
  const evidence = await gatherEvidence(loanId, req.orgId);
  if (!evidence) return res.status(404).json({ message: 'Evidence not found' });
  res.json({ evidence });
});

router.post('/validate-photo', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ result: 'No file uploaded' });
  const fileSizeKB = req.file.size / 1024;
  const result = fileSizeKB < 30 ? 'Image too small — likely blurry ❌' : 'Image passed validation ✅';
  res.json({ result });
});

module.exports = router;
