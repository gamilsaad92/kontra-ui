const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runStep(step) {
  switch (step.type) {
    case 'http': {
      const resp = await fetch(step.url, {
        method: step.method || 'GET',
        headers: step.headers || { 'Content-Type': 'application/json' },
        body: step.body ? JSON.stringify(step.body) : undefined
      });
      try {
        return await resp.json();
      } catch (_) {
        return { status: resp.status };
      }
    }
    case 'ai_review': {
      const text = step.text || '';
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Provide a short summary of the document.' },
            { role: 'user', content: text.slice(0, 12000) }
          ]
        });
        return { summary: completion.choices[0].message.content.trim() };
      } catch (err) {
        console.error('AI review step error:', err);
        return { error: 'ai_failed' };
      }
    }
    case 'transfer': {
      if (!step.from || !step.to || !step.id) return { error: 'invalid_params' };
      try {
        const { data, error } = await supabase
          .from(step.from)
          .select('*')
          .eq('id', step.id)
          .single();
        if (error) return { error: 'fetch_failed' };
        const { error: insErr } = await supabase.from(step.to).insert([data]);
        if (insErr) return { error: 'insert_failed' };
        return { transferred: true };
      } catch (err) {
        console.error('Transfer step error:', err);
        return { error: 'transfer_failed' };
      }
    }
    default:
      return { error: 'unknown_step' };
  }
}

async function runWorkflow(workflow) {
  const results = [];
  for (const step of workflow.steps) {
    results.push(await runStep(step));
  }
  return results;
}

module.exports = { runWorkflow };
