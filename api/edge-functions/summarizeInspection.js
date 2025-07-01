const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async function summarizeInspection(event) {
  const { asset_id, file_url } = JSON.parse(event.body || '{}');
  if (!asset_id || !file_url) return new Response('missing data', { status: 400 });
  try {
    const resp = await fetch(file_url);
    const text = await resp.text();
    let summary = text.slice(0, 200);
    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize the inspection findings.' },
            { role: 'user', content: text.slice(0, 12000) }
          ]
        });
        summary = res.choices[0].message.content.trim();
      } catch (err) {
        console.error('AI summary error', err);
      }
    }
    await supabase.from('asset_inspections').insert([{ asset_id, report_json: { summary } }]);
    return new Response('ok');
  } catch (err) {
    console.error('summarizeInspection error', err);
    return new Response('error', { status: 500 });
  }
};
