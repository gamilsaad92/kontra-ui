jest.mock('@supabase/supabase-js');

const { createClient } = require('@supabase/supabase-js');

['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'SENTRY_DSN', 'STRIPE_SECRET_KEY', 'ENCRYPTION_KEY', 'PII_ENCRYPTION_KEY'].forEach(
  key => {
    if (!process.env[key]) {
      process.env[key] = key === 'SUPABASE_URL'
        ? 'https://supabase.test'
        : `${key.toLowerCase()}-test-value`;
    }
  }
);

const resetSupabase = () => {
  if (createClient.__reset) {
    createClient.__reset();
    createClient.__setAuthUser({
      id: 'user-1',
      user_metadata: { organization_id: 'org-1' },
    });
    createClient.__setTable('org_memberships', {
      records: [{
        id: 'membership-1',
        org_id: '00000000-0000-0000-0000-000000000001',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        deleted_at: null,
        created_at: '2026-01-01T00:00:00Z',
      }],
    });
    createClient.__setTable('organization_members', {
      maybeSingle: { role: 'member' },
    });
  }
};

resetSupabase();

const app = require('../index');

module.exports = { app, createClient, resetSupabase };
