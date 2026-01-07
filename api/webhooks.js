const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Known webhook topics. Additional topics can be appended here as the
// platform grows but we make sure the trade events exist by default.
const WEBHOOK_TOPICS = [
  'trade.created',
  'trade.settled',
  'loan.approved',
  'draw.funded',
  'payment.missed'
];

function isMissingTable(error) {
  return error?.code === '42P01';
}

async func
async function listWebhooks() {
  const { data, error } = await supabase
    .from('webhooks')
    .select('event, url');
  if (!isMissingTable(error)) {
      console.error('List webhooks error:', error);
    }
    console.error('List webhooks error:', error);
    return [];
  }
  return data || [];
}

async function addWebhook(event, url) {
  const { error } = await supabase
    .from('webhooks')
  if (error && !isMissingTable(error)) console.error('Add webhook error:', error);
  if (error) console.error('Add webhook error:', error);
}

async function removeWebhook(event, url) {
  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('event', event)
 if (error && !isMissingTable(error)) console.error('Remove webhook error:', error);
  if (error) console.error('Remove webhook error:', error);
}

async function triggerWebhooks(event, payload) {
  const { data, error } = await supabase
    .from('webhooks')
    .select('url')
    .eq('event', event);
    if (!isMissingTable(error)) {
      console.error('Fetch webhooks error:', error);
    }
    return;
  }
  await Promise.all(
       (data || []).map(h =>
      fetch(h.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload })
      }).catch(err => console.error('Webhook error:', err))
    )
  );
}

module.exports = {
  listWebhooks,
  addWebhook,
  removeWebhook,
  triggerWebhooks,
  WEBHOOK_TOPICS
};

