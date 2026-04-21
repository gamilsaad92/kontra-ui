#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length) {
  console.error(`Missing required env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tableColumnChecks = {
  assets: ['id', 'org_id'],
  loans: ['id', 'org_id'],
  inspections: ['id', 'org_id'],
  exchange_listings: ['id', 'org_id'],
  payments: ['id', 'org_id', 'currency'],
  escrows: ['id', 'org_id'],
  draws: ['id', 'org_id'],
  borrower_financials: ['id', 'org_id'],
  management_items: ['id', 'org_id'],
  pools: ['id', 'org_id'],
  tokens: ['id', 'org_id'],
  compliance_items: ['id', 'org_id'],
  legal_items: ['id', 'org_id'],
  regulatory_scans: ['id', 'org_id'],
  risk_items: ['id', 'org_id'],
  document_reviews: ['id', 'org_id'],
  reports: ['id', 'org_id'],
};

async function main() {
  const failures = [];

  for (const [table, columns] of Object.entries(tableColumnChecks)) {
    const select = columns.join(',');
    const { error } = await supabase.from(table).select(select).limit(1);
    if (error) {
      failures.push({ table, columns, code: error.code, message: error.message });
    }
  }

  if (failures.length) {
    console.error('Schema smoke test failed.');
    for (const failure of failures) {
      console.error(`- ${failure.table} [${failure.columns.join(', ')}]: ${failure.code || 'ERR'} ${failure.message}`);
    }
    process.exit(1);
  }

  console.log('Schema smoke test passed.');
}

main().catch((error) => {
  console.error('Schema smoke test crashed:', error.message);
  process.exit(1);
});
