const webhooks = [];
async function triggerWebhooks(event, payload) {
  const hooks = webhooks.filter(h => h.event === event);
  await Promise.all(
    hooks.map(h =>
      fetch(h.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, payload })
      }).catch(err => console.error('Webhook error:', err))
    )
  );
}
module.exports = { webhooks, triggerWebhooks };
