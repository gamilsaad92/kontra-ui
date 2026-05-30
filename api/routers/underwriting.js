/**
 * underwriting.js — AI term sheet generation
 * POST /api/underwriting/term-sheet  — takes extracted document fields, returns a full term sheet
 */
const express = require('express');
const router  = express.Router();
const OpenAI  = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/underwriting/term-sheet', async (req, res) => {
  const { fields = [], docType = 'Unknown', fileName = '' } = req.body || {};

  const fieldText = fields.map(f => `${f.label}: ${f.value}`).join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a senior CRE loan officer at an institutional lender. 
Given extracted document data, generate a professional loan term sheet in clean structured text.
Include: Loan Amount (calculate at ~65% LTV if appraisal present, or infer from NOI/cap rate),
Rate (SOFR + appropriate spread for asset type), Term (5-year IO typical), Amortization,
DSCR requirement, LTV cap, Recourse, Prepayment, Key Covenants, Conditions Precedent, and Lender.
Be specific with numbers. Sign off as "Kontra Lending Platform — AI Underwriting Engine".`
        },
        {
          role: 'user',
          content: `Document type: ${docType}\nFile: ${fileName}\n\nExtracted data:\n${fieldText}\n\nGenerate the term sheet now.`
        }
      ],
      max_tokens: 700,
    });

    const termSheet = completion.choices[0].message.content;
    return res.json({ termSheet, model: 'gpt-4o-mini', generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[underwriting]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = { router };
