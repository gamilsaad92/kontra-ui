let getOrders = () => [];
let getPayments = () => [];

const clients = [];

function initAnalytics(deps = {}) {
  if (typeof deps.getOrders === 'function') getOrders = deps.getOrders;
  if (typeof deps.getPayments === 'function') getPayments = deps.getPayments;
}

function calcMetrics(orgId) {
  const orders = getOrders(orgId);
  const payments = getPayments(orgId);
  const totalOrders = orders.length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  return { totalOrders, totalRevenue };
}

function broadcastAnalytics(orgId) {
  const data = `data: ${JSON.stringify(calcMetrics(orgId))}\n\n`;
  clients.filter(c => c.orgId === orgId).forEach(c => c.res.write(data));
}

module.exports = { initAnalytics, broadcastAnalytics, clients, calcMetrics };
