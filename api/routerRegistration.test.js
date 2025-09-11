process.env.SUPABASE_URL = 'http://example.com';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
process.env.OPENAI_API_KEY = 'test';
process.env.SENTRY_DSN = 'https://example.com';
process.env.STRIPE_SECRET_KEY = 'sk_test';
process.env.PII_ENCRYPTION_KEY = 'secret';
process.env.FEATURE_FLAGS = 'assets,sso,compliance';

const app = require('./index');

const assetsRouter = require('./routers/assets');
const inspectionsRouter = require('./routers/inspections');
const dashboardRouter = require('./routers/dashboard');
const loansRouter = require('./routers/loans');
const drawsRouter = require('./routers/draws');
const projectsRouter = require('./routers/projects');
const organizationsRouter = require('./routers/organizations');
const invitesRouter = require('./routers/invites');
const documentReviewRouter = require('./routers/documentReview');
const ssoRouter = require('./routers/sso');
const reportsRouter = require('./routers/reports');
const { router: menuRouter } = require('./routers/menu');
const { router: ordersRouter } = require('./routers/orders');
const { router: paymentsRouter } = require('./routers/payments');
const paymentsStripeRouter = require('./routers/paymentsStripe');
const tradesRouter = require('./routers/trades');
const exchangeRouter = require('./routers/exchange');
const marketplaceRouter = require('./routers/marketplace');
const { router: analyticsRouter } = require('./routers/analytics');
const restaurantRouter = require('./routers/restaurant');
const restaurantsRouter = require('./routers/restaurants');
const applicationsRouter = require('./routers/applications');
const riskRouter = require('./routers/risk');
const servicingRouter = require('./routers/servicing');
const webhooksRouter = require('./routers/webhookRoutes');
const { router: integrationsRouter } = require('./routers/integrations');
const subscriptionsRouter = require('./routers/subscriptions');
const siteAnalysisRouter = require('./routers/siteAnalysis');
const savedSearchesRouter = require('./routers/savedSearches');
const complianceRouter = require('./routers/compliance');
const otpRouter = require('./routers/otp');

function isRegistered(router) {
  return app._router.stack.some(layer => layer.handle === router);
}

describe('API server router registration', () => {
  const routers = [
    ['assets', assetsRouter],
    ['inspections', inspectionsRouter],
    ['dashboard', dashboardRouter],
    ['loans', loansRouter],
    ['draws', drawsRouter],
    ['projects', projectsRouter],
    ['organizations', organizationsRouter],
    ['invites', invitesRouter],
    ['document review', documentReviewRouter],
    ['sso', ssoRouter],
    ['reports', reportsRouter],
    ['menu', menuRouter],
    ['orders', ordersRouter],
    ['payments', paymentsRouter],
    ['payments stripe', paymentsStripeRouter],
    ['trades', tradesRouter],
    ['exchange', exchangeRouter],
    ['marketplace', marketplaceRouter],
    ['analytics', analyticsRouter],
    ['restaurant', restaurantRouter],
    ['restaurants', restaurantsRouter],
    ['applications', applicationsRouter],
    ['risk', riskRouter],
    ['servicing', servicingRouter],
    ['webhooks', webhooksRouter],
    ['integrations', integrationsRouter],
    ['subscriptions', subscriptionsRouter],
    ['site analysis', siteAnalysisRouter],
    ['saved searches', savedSearchesRouter],
    ['compliance', complianceRouter],
    ['otp', otpRouter],
  ];

  test.each(routers)('registers %s router', (_name, router) => {
    expect(isRegistered(router)).toBe(true);
  });
});
