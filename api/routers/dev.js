const express = require('express');
const generateLoans = require('../scripts/generateLoans');

const router = express.Router();

// POST /dev/generate-loans?count=10
router.post('/generate-loans', async (req, res) => {
  const count = parseInt(req.query.count, 10) || 10;
  try {
    const inserted = await generateLoans(count);
    res.json({ inserted });
  } catch (err) {
    console.error('Generate loans error:', err);
    res.status(500).json({ message: 'Failed to generate loans' });
  }
});

module.exports = router;
