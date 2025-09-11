const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/process', upload.single('file'), async (req, res) => {
  const { doc_type } = req.body;
  if (!doc_type || !req.file) {
    return res.status(400).json({ message: 'Missing doc_type or file' });
  }
  const text = req.file.buffer.toString('utf8');
  let extracted = {};
  let summary = text.slice(0, 200);
  if (process.env.OPENAI_API_KEY) {
    try {
      const prompt = `Extract vendor name, amount, and date from this ${doc_type} text as JSON {"vendor":string,"amount":number,"date":string}.`;
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: `${prompt}\n${text.slice(0, 12000)}` }
        ]
      });
      extracted = JSON.parse(resp.choices[0].message.content || '{}');
    } catch (err) {
      console.error('Document AI extraction error:', err);
    }
       try {
      const sumResp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: `Summarize this ${doc_type} in 3 sentences:\n${text.slice(0, 12000)}` }
        ]
      });
      summary = sumResp.choices[0].message.content || summary;
    } catch (err) {
      console.error('Document AI summary error:', err);
    }
  }
  const missingSignature = !/signature/i.test(text);
  const complianceIssues = !/compliance/i.test(text);
  let version = 1;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: existing } = await supabase
        .from('document_review_logs')
        .select('id')
        .eq('doc_type', doc_type);
      version = (existing?.length || 0) + 1;
      await supabase.from('document_review_logs').insert([
        {
          doc_type,
          vendor_name: extracted.vendor || null,
          amount: extracted.amount || null,
          document_date: extracted.date || null,
          summary,
          missing_signature: missingSignature,
          compliance_issues: complianceIssues,
          version,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.error('Supabase document review log error:', err);
    }
   }
  res.json({ extracted, summary, version, missingSignature, complianceIssues });
});

module.exports = router;
