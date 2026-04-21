const express = require('express');
const OpenAI = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { zip, lotSize, zoning } = req.body || {};
  if (!zip || !lotSize || !zoning) {
    return res.status(400).json({ message: 'Missing zip, lotSize or zoning' });
  }
  let score = null;
  let reasons = {
    walkability: '',
    transit: '',
    regulations: ''
  };

  if (process.env.OPENAI_API_KEY) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Assess site suitability on a 1-10 scale and provide short reasons for walkability, proximity to transit and local regulations. Respond as JSON {"score":number,"reasons":{"walkability":string,"transit":string,"regulations":string}}.'
          },
          {
            role: 'user',
            content: `ZIP: ${zip}; Lot Size: ${lotSize}; Zoning: ${zoning}`
          }
        ]
      });
      const data = JSON.parse(resp.choices[0].message.content || '{}');
      if (data.score) score = data.score;
      reasons = Object.assign(reasons, data.reasons);
    } catch (err) {
      console.error('Site analysis AI error:', err);
    }
  }

  if (score === null) {
    // Fallback stub
    score = Math.floor(Math.random() * 10) + 1;
    reasons.walkability = 'Walkability data unavailable';
    reasons.transit = 'Transit data unavailable';
    reasons.regulations = 'Regulations data unavailable';
  }

  res.json({ score, reasons });
});

module.exports = router;
