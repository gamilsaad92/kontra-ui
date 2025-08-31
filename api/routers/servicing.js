const express = require('express');

const router = express.Router();

router.get('/loans/:id/escrow/upcoming', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid loan id' });
  res.json({
    upcoming: [
      { type: 'tax', due_date: '2024-01-01', amount: 1200 },
      { type: 'insurance', due_date: '2024-06-01', amount: 800 }
    ]
  });
});

router.post('/loans/:id/escrow/pay', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid loan id' });
  const { type, amount } = req.body || {};
  if (!type || !amount) {
    return res.status(400).json({ message: 'type and amount required' });
  }
  res.json({ message: 'Payment processed' });
});

router.get('/loans/:id/escrow/projection', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid loan id' });
  const projection = Array.from({ length: 12 }).map((_, i) => ({
    month: i + 1,
    tax: 100,
    insurance: 80
  }));
  res.json({ projection });
});

module.exports = router;
