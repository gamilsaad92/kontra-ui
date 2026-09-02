const ROLE_TEMPLATES = {
  Servicing: {
    table: 'loans',
    fields: ['id', 'loan_number', 'borrower_name', 'status', 'curr_balance', 'risk_score'],
    filters: { status: 'delinquent' },
    groupBy: 'status',
  },
  Risk: {
    table: 'loans',
    fields: ['id', 'borrower_name', 'status', 'curr_balance', 'risk_score', 'state'],
    filters: { status: ['delinquent', 'default', 'watchlist'] },
    groupBy: 'status',
  },
  'Capital Markets': {
    table: 'trades',
    fields: ['id', 'trade_type', 'notional_amount', 'status', 'created_at'],
    filters: { status: 'open' },
    groupBy: 'trade_type',
  },
  Compliance: {
    table: 'document_review_logs',
    fields: ['id', 'doc_type', 'vendor_name', 'amount', 'document_date'],
    filters: {},
    groupBy: 'doc_type',
  },
};

const SCHEMA_CATALOG = {
  tables: {
    loans: {
      columns: [
        'id',
        'loan_number',
        'borrower_name',
        'borrower_user_id',
        'organization_id',
        'property_id',
        'collateral_type',
        'state',
        'amount',
        'orig_balance',
        'curr_balance',
        'note_rate',
        'interest_rate',
        'index',
        'spread',
        'term_months',
        'start_date',
        'status',
        'maturity_date',
        'io_end_date',
        'amort_type',
        'risk_score',
        'servicer_status_flags',
        'created_at',
        'updated_at',
      ],
      joins: [
        { table: 'loan_cashflows', on: 'loans.id = loan_cashflows.loan_id' },
      ],
    },
    loan_cashflows: {
      columns: [
        'id',
        'loan_id',
        'period_date',
        'scheduled_prin',
        'scheduled_int',
        'actual_prin',
        'actual_int',
        'fees',
        'advances',
        'recoveries',
        'net_to_investors',
        'created_at',
      ],
      joins: [{ table: 'loans', on: 'loan_cashflows.loan_id = loans.id' }],
    },
    document_review_logs: {
      columns: ['id', 'doc_type', 'vendor_name', 'amount', 'document_date', 'created_at'],
      joins: [],
    },
    trades: {
      columns: [
        'id',
        'trade_type',
        'notional_amount',
        'repo_rate_bps',
        'term_days',
        'collateral_ref',
        'tranche_id',
        'waterfall_config',
        'facility_line_id',
        'status',
        'created_at',
        'updated_at',
      ],
      joins: [
        { table: 'trade_participants', on: 'trades.id = trade_participants.trade_id' },
        { table: 'trade_settlements', on: 'trades.id = trade_settlements.trade_id' },
      ],
    },
    payments: {
      columns: ['id', 'loan_id', 'amount', 'method', 'status', 'date_received'],
      joins: [{ table: 'loans', on: 'payments.loan_id = loans.id' }],
    },
    asset_inspections: {
      columns: ['id', 'asset_id', 'report_json', 'created_at'],
      joins: [],
    },
    troubled_assets: {
      columns: ['id', 'asset_id', 'file_url', 'ai_notes', 'created_at'],
      joins: [],
    },
  },
  joins: [
    { left: 'loans', right: 'loan_cashflows', on: 'loans.id = loan_cashflows.loan_id' },
    { left: 'trades', right: 'trade_participants', on: 'trades.id = trade_participants.trade_id' },
    { left: 'trades', right: 'trade_settlements', on: 'trades.id = trade_settlements.trade_id' },
    { left: 'loans', right: 'payments', on: 'loans.id = payments.loan_id' },
  ],
};

const DEFAULT_HOOKS = [
  {
    action_type: 'create_servicing_task',
    label: 'Create servicing task',
    payload: { priority: 'normal' },
    requires_approval: true,
  },
  {
    action_type: 'notify_lender',
    label: 'Notify lender',
    payload: { channel: 'email' },
    requires_approval: true,
  },
];

const safeLower = (value) => String(value || '').toLowerCase();

function pickTemplate(role, description) {
  if (role && ROLE_TEMPLATES[role]) return ROLE_TEMPLATES[role];
  const normalized = safeLower(description);
  if (normalized.includes('trade') || normalized.includes('market')) {
    return ROLE_TEMPLATES['Capital Markets'];
  }
  if (normalized.includes('compliance') || normalized.includes('document')) {
    return ROLE_TEMPLATES.Compliance;
  }
  if (normalized.includes('risk') || normalized.includes('delinquent') || normalized.includes('default')) {
    return ROLE_TEMPLATES.Risk;
  }
  return ROLE_TEMPLATES.Servicing;
}

function pickDateColumn(columns) {
  if (columns.includes('created_at')) return 'created_at';
  if (columns.includes('document_date')) return 'document_date';
  if (columns.includes('period_date')) return 'period_date';
  if (columns.includes('updated_at')) return 'updated_at';
  return null;
}

function normalizeFilters(filters = {}) {
  return Object.entries(filters).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function validateReportSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Missing spec payload.'] };
  }
  if (!spec.table) {
    errors.push('Missing table.');
  }
  const table = SCHEMA_CATALOG.tables[spec.table];
  if (!table) {
    errors.push(`Table "${spec.table}" is not in the schema catalog.`);
  }
  const fields = Array.isArray(spec.fields) ? spec.fields : [];
  const availableColumns = table ? table.columns : [];
  const invalidFields = fields.filter((field) => !availableColumns.includes(field));
  if (invalidFields.length > 0) {
    errors.push(`Invalid fields: ${invalidFields.join(', ')}`);
  }
  if (spec.groupBy && !availableColumns.includes(spec.groupBy)) {
    errors.push(`Group by column "${spec.groupBy}" is not available on ${spec.table}.`);
  }
  const filters = spec.filters && typeof spec.filters === 'object' ? spec.filters : {};
  const invalidFilterKeys = Object.keys(filters).filter((key) => !availableColumns.includes(key));
  if (invalidFilterKeys.length > 0) {
    errors.push(`Invalid filter columns: ${invalidFilterKeys.join(', ')}`);
  }
  if (spec.joins && Array.isArray(spec.joins)) {
    const invalidJoins = spec.joins.filter((join) => {
      if (!join || !join.table || !join.on) return true;
      return !SCHEMA_CATALOG.joins.some((allowed) => {
        return (
          allowed.left === spec.table &&
          allowed.right === join.table &&
          allowed.on === join.on
        );
      });
    });
    if (invalidJoins.length > 0) {
      errors.push('One or more joins are not permitted by the schema catalog.');
    }
  }
  if (spec.forecast && typeof spec.forecast === 'object') {
    const horizon = Number(spec.forecast.horizon_days);
    if (!Number.isFinite(horizon) || horizon <= 0) {
      errors.push('Forecast horizon must be a positive number of days.');
    }
  }
  return { valid: errors.length === 0, errors };
}

function proposeReportPlan(input = {}) {
  const description = input.description || '';
  const role = input.role || '';
  const horizonDays = input.outlook_days;
  const includeExecutiveSummary = Boolean(input.include_executive_summary);
  const template = pickTemplate(role, description);
  const tableInfo = SCHEMA_CATALOG.tables[template.table];
  const selectedFields = template.fields.filter((field) => tableInfo.columns.includes(field));

  const filters = { ...template.filters };
  const lower = safeLower(description);
  if (lower.includes('current') && tableInfo.columns.includes('status')) {
    filters.status = 'current';
  }
  if (lower.includes('paid') && tableInfo.columns.includes('status')) {
    filters.status = 'paid_off';
  }
  if (lower.includes('watchlist') && tableInfo.columns.includes('status')) {
    filters.status = 'watchlist';
  }

  const dataWarnings = [];
  if (!Object.keys(filters).length) {
    dataWarnings.push('No filters detected. Results may include the full dataset.');
  }
  if (selectedFields.length === 0) {
    dataWarnings.push('No valid fields were selected from the schema catalog.');
  }

  const spec = {
    table: template.table,
    fields: selectedFields,
    filters: normalizeFilters(filters),
    groupBy: template.groupBy,
    joins: [],
  };

  if (horizonDays) {
    const dateColumn = pickDateColumn(tableInfo.columns);
    if (dateColumn) {
      spec.forecast = {
        horizon_days: Number(horizonDays),
        date_column: dateColumn,
        method: 'trend_projection',
      };
    } else {
      dataWarnings.push('Forecast horizon selected but no suitable date column is available.');
    }
  }

  const explanationParts = [
    `Using the ${template.table} table with key fields for ${template.table} reporting.`,
  ];
  if (description) {
    explanationParts.push(`Interpreted request: "${description}".`);
  }
  if (template.groupBy) {
    explanationParts.push(`Grouped by ${template.groupBy} to summarize trends.`);
  }
  if (spec.forecast) {
    explanationParts.push(`Includes a ${spec.forecast.horizon_days}-day outlook based on ${spec.forecast.date_column}.`);
  }

  const explanation = explanationParts.join(' ');
  const confidence = Math.max(0.45, Math.min(0.85, 0.62 + (description ? 0.08 : 0)));
  const executiveSummary = includeExecutiveSummary
    ? `Executive summary: This report highlights ${template.table} activity with ${spec.fields.length} fields and ${Object.keys(spec.filters).length || 'no'} filter constraints.`
    : null;

  return {
    spec,
    explanation,
    confidence,
    warnings: dataWarnings,
    executiveSummary,
    automationHooks: DEFAULT_HOOKS,
    roleUsed: role || Object.keys(ROLE_TEMPLATES).find((key) => ROLE_TEMPLATES[key] === template) || 'Servicing',
  };
}

module.exports = {
  ROLE_TEMPLATES,
  SCHEMA_CATALOG,
  proposeReportPlan,
  validateReportSpec,
};
