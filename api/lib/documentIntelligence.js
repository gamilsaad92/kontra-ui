/**
 * Kontra Document Intelligence Engine — Phase 4
 *
 * OCR + structured extraction for all document types encountered in CRE
 * loan servicing. Uses OpenAI gpt-4o-mini with function-calling to extract
 * typed, validated fields with confidence scoring.
 *
 * Supported document types:
 *   loan_document        – promissory notes, loan agreements, modifications
 *   appraisal_report     – USPAP appraisals, desktop valuations
 *   insurance_acord      – ACORD 25/27/28, binders, loss runs
 *   inspection_report    – physical inspection reports from field vendors
 *   rent_roll            – monthly/quarterly rent roll exports
 *   operating_statement  – T-12, YTD, pro forma operating statements
 *   reserve_report       – capital/replacement reserve account statements
 *   draw_request         – construction draw request packages
 *   email_request        – email, fax, or letter servicing requests
 *   spreadsheet          – generic CSV/Excel data with column detection
 *   title_report         – title commitment, title policy
 *   environmental_report – Phase I/II ESA reports
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Extraction schemas per document type ──────────────────────────────────────

const EXTRACTION_SCHEMAS = {
  loan_document: {
    name: 'extract_loan_document',
    description: 'Extract structured data from a loan document, promissory note, or loan agreement.',
    parameters: {
      type: 'object',
      properties: {
        borrower_name:       { type: 'string', description: 'Legal name of the borrower or borrowing entity' },
        guarantor_names:     { type: 'array', items: { type: 'string' }, description: 'Guarantor names if any' },
        lender_name:         { type: 'string', description: 'Lender legal name' },
        loan_amount:         { type: 'number', description: 'Original principal loan amount in USD' },
        outstanding_balance: { type: 'number', description: 'Current outstanding principal balance if stated' },
        interest_rate:       { type: 'number', description: 'Annual interest rate as a decimal (e.g. 0.065 for 6.5%)' },
        rate_type:           { type: 'string', enum: ['fixed', 'floating', 'adjustable', 'blended', 'unknown'], description: 'Interest rate type' },
        loan_type:           { type: 'string', enum: ['term', 'bridge', 'construction', 'mezz', 'line_of_credit', 'unknown'] },
        origination_date:    { type: 'string', description: 'Origination date in ISO 8601 format YYYY-MM-DD' },
        maturity_date:       { type: 'string', description: 'Maturity date in ISO 8601 format YYYY-MM-DD' },
        loan_term_months:    { type: 'number', description: 'Loan term in months' },
        property_address:    { type: 'string', description: 'Full property address' },
        property_type:       { type: 'string', enum: ['multifamily', 'office', 'retail', 'industrial', 'mixed_use', 'hotel', 'other', 'unknown'] },
        dscr_covenant:       { type: 'number', description: 'Required DSCR covenant (e.g. 1.25)' },
        ltv_covenant:        { type: 'number', description: 'Maximum LTV covenant as percent (e.g. 80)' },
        prepayment_penalty:  { type: 'string', description: 'Prepayment penalty description (e.g. "5-4-3-2-1" step-down, yield maintenance)' },
        loan_number:         { type: 'string', description: 'Lender-assigned loan or reference number' },
        gse_agency:          { type: 'string', enum: ['freddie_mac', 'fannie_mae', 'fha', 'none', 'unknown'], description: 'GSE/Agency backing if applicable' },
        servicer_name:       { type: 'string', description: 'Named loan servicer' },
        recourse_type:       { type: 'string', enum: ['full_recourse', 'limited_recourse', 'non_recourse', 'unknown'] },
        notes:               { type: 'string', description: 'Key conditions, unusual terms, or extraction caveats' },
      },
      required: ['borrower_name', 'loan_amount', 'maturity_date'],
    },
  },

  appraisal_report: {
    name: 'extract_appraisal_report',
    description: 'Extract structured valuation data from a USPAP appraisal or desktop valuation report.',
    parameters: {
      type: 'object',
      properties: {
        property_address:          { type: 'string' },
        property_type:             { type: 'string', enum: ['multifamily', 'office', 'retail', 'industrial', 'mixed_use', 'hotel', 'other', 'unknown'] },
        appraiser_name:            { type: 'string' },
        appraisal_firm:            { type: 'string' },
        effective_date:            { type: 'string', description: 'YYYY-MM-DD' },
        report_date:               { type: 'string', description: 'YYYY-MM-DD' },
        as_is_value:               { type: 'number', description: 'As-is market value in USD' },
        as_stabilized_value:       { type: 'number', description: 'As-stabilized value in USD if applicable' },
        cap_rate:                  { type: 'number', description: 'Capitalization rate as decimal (e.g. 0.055)' },
        noi:                       { type: 'number', description: 'Net Operating Income used in value estimate (annual USD)' },
        gross_potential_rent:      { type: 'number', description: 'Annual GPR in USD' },
        vacancy_rate:              { type: 'number', description: 'Stabilized vacancy rate as decimal' },
        value_approach:            { type: 'string', enum: ['income', 'sales_comparison', 'cost', 'reconciled', 'unknown'] },
        unit_count:                { type: 'number', description: 'Number of units for multifamily' },
        land_area_sqft:            { type: 'number' },
        building_area_sqft:        { type: 'number' },
        year_built:                { type: 'number' },
        comparable_sales:          { type: 'array', items: { type: 'object', properties: { address: { type: 'string' }, sale_price: { type: 'number' }, sale_date: { type: 'string' } }, required: [] }, description: 'Comparable sales used' },
        notes:                     { type: 'string' },
      },
      required: ['property_address', 'as_is_value', 'effective_date'],
    },
  },

  insurance_acord: {
    name: 'extract_insurance_acord',
    description: 'Extract coverage details from ACORD 25, 27, 28 certificates, insurance binders, or loss run reports.',
    parameters: {
      type: 'object',
      properties: {
        policy_number:          { type: 'string' },
        carrier_name:           { type: 'string' },
        carrier_naic:           { type: 'string', description: 'NAIC company number' },
        named_insured:          { type: 'string' },
        property_address:       { type: 'string' },
        policy_type:            { type: 'string', enum: ['property', 'liability', 'flood', 'earthquake', 'umbrella', 'builders_risk', 'workers_comp', 'other'] },
        coverage_amount:        { type: 'number', description: 'Total coverage limit in USD' },
        replacement_cost_value: { type: 'number', description: 'Replacement cost value if stated' },
        deductible:             { type: 'number', description: 'Policy deductible in USD' },
        premium_annual:         { type: 'number', description: 'Annual premium in USD' },
        effective_date:         { type: 'string', description: 'YYYY-MM-DD' },
        expiration_date:        { type: 'string', description: 'YYYY-MM-DD' },
        additional_insured:     { type: 'array', items: { type: 'string' }, description: 'Additional insured parties listed' },
        lender_loss_payee:      { type: 'string', description: 'Mortgagee/loss payee name as shown' },
        flood_zone:             { type: 'string', description: 'FEMA flood zone designation if stated' },
        flood_coverage:         { type: 'number', description: 'Flood coverage amount if a separate policy' },
        loss_runs:              { type: 'array', items: { type: 'object', properties: { year: { type: 'number' }, claims_count: { type: 'number' }, total_paid: { type: 'number' } }, required: [] }, description: 'Loss run history by year' },
        coverage_gaps:          { type: 'array', items: { type: 'string' }, description: 'Any identified coverage gaps or exclusions' },
        notes:                  { type: 'string' },
      },
      required: ['policy_number', 'carrier_name', 'coverage_amount', 'effective_date', 'expiration_date'],
    },
  },

  inspection_report: {
    name: 'extract_inspection_report',
    description: 'Extract deficiency findings from a property inspection report.',
    parameters: {
      type: 'object',
      properties: {
        property_address:  { type: 'string' },
        inspection_date:   { type: 'string', description: 'YYYY-MM-DD' },
        inspector_name:    { type: 'string' },
        vendor_name:       { type: 'string', description: 'Inspection firm name' },
        overall_condition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'critical', 'unknown'] },
        condition_score:   { type: 'number', description: 'Numeric condition score if provided (e.g. 1-100)' },
        deficiencies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item:              { type: 'string', description: 'Deficiency description' },
              location:          { type: 'string', description: 'Location on property (e.g. "Unit 4B", "Roof - Section A")' },
              severity:          { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'informational'] },
              category:          { type: 'string', enum: ['structural', 'mechanical', 'electrical', 'plumbing', 'roofing', 'fire_safety', 'life_safety', 'exterior', 'interior', 'common_area', 'other'] },
              estimated_cost:    { type: 'number', description: 'Estimated repair cost in USD' },
              cure_timeline:     { type: 'string', description: 'Recommended cure timeline (e.g. "30 days", "immediate")' },
              photo_reference:   { type: 'string', description: 'Photo or exhibit reference if noted' },
            },
            required: ['item', 'severity'],
          },
          description: 'List of all deficiencies found',
        },
        total_critical_count:  { type: 'number' },
        total_high_count:      { type: 'number' },
        estimated_total_cost:  { type: 'number', description: 'Sum of all estimated repair costs' },
        draw_hold_recommended: { type: 'boolean', description: 'Whether the report recommends holding draws' },
        reinspection_required: { type: 'boolean' },
        notes:                 { type: 'string' },
      },
      required: ['property_address', 'inspection_date', 'deficiencies'],
    },
  },

  rent_roll: {
    name: 'extract_rent_roll',
    description: 'Extract occupancy and rent data from a rent roll spreadsheet or PDF.',
    parameters: {
      type: 'object',
      properties: {
        property_address:        { type: 'string' },
        report_date:             { type: 'string', description: 'As-of date YYYY-MM-DD' },
        total_units:             { type: 'number' },
        occupied_units:          { type: 'number' },
        vacant_units:            { type: 'number' },
        occupancy_rate:          { type: 'number', description: 'Physical occupancy as decimal (e.g. 0.923)' },
        total_scheduled_rent:    { type: 'number', description: 'Total monthly scheduled rent for occupied units in USD' },
        total_gpr_monthly:       { type: 'number', description: 'Total gross potential rent (all units) monthly in USD' },
        avg_rent_per_unit:       { type: 'number', description: 'Average rent per occupied unit monthly in USD' },
        delinquent_units:        { type: 'number', description: 'Count of units with past-due balances' },
        total_delinquency_amt:   { type: 'number', description: 'Total past-due balance across delinquent units in USD' },
        unit_mix: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              unit_type:  { type: 'string', description: 'e.g. "1BR/1BA", "2BR/2BA", "Studio"' },
              count:      { type: 'number' },
              avg_rent:   { type: 'number' },
              occupied:   { type: 'number' },
            },
            required: [],
          },
        },
        month_over_month_change: { type: 'string', description: 'Notable change vs prior period if stated' },
        notes:                   { type: 'string' },
      },
      required: ['total_units', 'occupancy_rate', 'total_scheduled_rent'],
    },
  },

  operating_statement: {
    name: 'extract_operating_statement',
    description: 'Extract income and expense data from a T-12, YTD, or pro forma operating statement.',
    parameters: {
      type: 'object',
      properties: {
        property_address:           { type: 'string' },
        statement_period_start:     { type: 'string', description: 'YYYY-MM-DD' },
        statement_period_end:       { type: 'string', description: 'YYYY-MM-DD' },
        statement_type:             { type: 'string', enum: ['t12', 'ytd', 'pro_forma', 'budget', 'monthly', 'unknown'] },
        gross_potential_rent:       { type: 'number', description: 'Gross potential rent (annual USD)' },
        vacancy_credit_loss:        { type: 'number', description: 'Vacancy and credit loss (annual USD, positive number)' },
        effective_gross_income:     { type: 'number', description: 'EGI (annual USD)' },
        vacancy_rate:               { type: 'number', description: 'Vacancy rate as decimal' },
        total_operating_expenses:   { type: 'number', description: 'Total OpEx (annual USD)' },
        expense_ratio:              { type: 'number', description: 'OpEx / EGI as decimal' },
        net_operating_income:       { type: 'number', description: 'NOI (annual USD)' },
        annual_debt_service:        { type: 'number', description: 'Annual debt service if stated (USD)' },
        dscr:                       { type: 'number', description: 'Calculated or stated DSCR' },
        cap_rate:                   { type: 'number', description: 'Implied cap rate as decimal' },
        major_expense_items: {
          type: 'array',
          items: { type: 'object', properties: { category: { type: 'string' }, annual_amount: { type: 'number' } }, required: [] },
          description: 'Top expense line items',
        },
        notes: { type: 'string' },
      },
      required: ['net_operating_income', 'effective_gross_income'],
    },
  },

  reserve_report: {
    name: 'extract_reserve_report',
    description: 'Extract balance and activity from a capital or replacement reserve account statement.',
    parameters: {
      type: 'object',
      properties: {
        property_address:    { type: 'string' },
        account_number:      { type: 'string' },
        statement_date:      { type: 'string', description: 'YYYY-MM-DD' },
        beginning_balance:   { type: 'number', description: 'Balance at start of period (USD)' },
        ending_balance:      { type: 'number', description: 'Balance at end of period (USD)' },
        contributions_ytd:   { type: 'number', description: 'Total contributions year-to-date (USD)' },
        disbursements_ytd:   { type: 'number', description: 'Total disbursements year-to-date (USD)' },
        interest_earned:     { type: 'number', description: 'Interest earned on account (USD)' },
        required_balance:    { type: 'number', description: 'Required minimum balance per loan agreement (USD)' },
        balance_shortfall:   { type: 'number', description: 'Shortfall vs required balance if negative (USD)' },
        pending_draws:       { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, amount: { type: 'number' }, requested_date: { type: 'string' } }, required: [] } },
        low_balance_flag:    { type: 'boolean', description: 'True if below required balance' },
        notes:               { type: 'string' },
      },
      required: ['ending_balance', 'statement_date'],
    },
  },

  draw_request: {
    name: 'extract_draw_request',
    description: 'Extract disbursement request details from a construction or improvement draw request package.',
    parameters: {
      type: 'object',
      properties: {
        borrower_name:        { type: 'string' },
        loan_number:          { type: 'string' },
        property_address:     { type: 'string' },
        draw_number:          { type: 'number' },
        request_date:         { type: 'string', description: 'YYYY-MM-DD' },
        amount_requested:     { type: 'number', description: 'Total draw amount requested (USD)' },
        draw_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category:      { type: 'string', description: 'Cost category (e.g. "Structural", "MEP", "Soft Costs")' },
              contractor:    { type: 'string' },
              amount:        { type: 'number' },
              pct_complete:  { type: 'number', description: 'Percent complete for this line item' },
              invoice_ref:   { type: 'string' },
            },
            required: [],
          },
        },
        total_budget:         { type: 'number', description: 'Total approved project budget (USD)' },
        draws_to_date:        { type: 'number', description: 'Sum of all previous draws (USD)' },
        remaining_budget:     { type: 'number', description: 'Remaining undisbursed balance (USD)' },
        pct_complete_overall: { type: 'number', description: 'Overall project completion percentage' },
        inspector_approval:   { type: 'boolean', description: 'Whether inspector sign-off is included' },
        lien_waiver_included: { type: 'boolean' },
        notes:                { type: 'string' },
      },
      required: ['amount_requested', 'request_date'],
    },
  },

  email_request: {
    name: 'extract_email_request',
    description: 'Parse a servicer email, fax, or letter to extract a structured servicing request.',
    parameters: {
      type: 'object',
      properties: {
        request_type:    {
          type: 'string',
          enum: [
            'payoff_request', 'draw_request', 'insurance_update', 'inspection_scheduling',
            'covenant_inquiry', 'payment_question', 'reserve_disbursement', 'maturity_extension',
            'modification_request', 'complaint', 'general_inquiry', 'other'
          ],
          description: 'Classification of the servicing request'
        },
        urgency:         { type: 'string', enum: ['immediate', 'high', 'normal', 'low'] },
        sender_name:     { type: 'string' },
        sender_email:    { type: 'string' },
        sender_company:  { type: 'string' },
        loan_number:     { type: 'string', description: 'Referenced loan number if mentioned' },
        property_address:{ type: 'string', description: 'Referenced property if mentioned' },
        borrower_name:   { type: 'string' },
        received_date:   { type: 'string', description: 'YYYY-MM-DD if determinable from email headers' },
        subject_line:    { type: 'string' },
        summary:         { type: 'string', description: '2-3 sentence summary of the request' },
        action_required: { type: 'string', description: 'Specific action the servicer needs to take' },
        deadline:        { type: 'string', description: 'Any deadline mentioned in the request (YYYY-MM-DD or description)' },
        amount_mentioned:{ type: 'number', description: 'Dollar amount referenced if any (USD)' },
        documents_attached: { type: 'array', items: { type: 'string' }, description: 'List of attachments mentioned' },
        notes:           { type: 'string' },
      },
      required: ['request_type', 'urgency', 'summary', 'action_required'],
    },
  },

  spreadsheet: {
    name: 'extract_spreadsheet_data',
    description: 'Analyze a CSV or spreadsheet and identify data type, columns, and key metrics.',
    parameters: {
      type: 'object',
      properties: {
        inferred_doc_type: {
          type: 'string',
          enum: ['rent_roll', 'loan_tape', 'financial_statement', 'draw_schedule', 'reserve_ledger', 'property_list', 'payment_history', 'investor_report', 'unknown'],
          description: 'Best guess at what this spreadsheet represents',
        },
        row_count:          { type: 'number' },
        column_count:       { type: 'number' },
        columns: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, inferred_type: { type: 'string', enum: ['text', 'number', 'date', 'currency', 'percent', 'boolean', 'id', 'unknown'] }, sample_values: { type: 'array', items: { type: 'string' } } }, required: ['name'] },
        },
        key_metrics:        { type: 'object', description: 'Any key financial metrics extracted (e.g. {total_balance: 12345000})' },
        recommended_adapter:{ type: 'string', description: 'Which Kontra adapter should process this file' },
        data_quality_issues:{ type: 'array', items: { type: 'string' }, description: 'Any data quality issues detected (missing fields, inconsistent formats, etc.)' },
        notes:              { type: 'string' },
      },
      required: ['inferred_doc_type', 'columns'],
    },
  },
};

// ── Auto-classification ───────────────────────────────────────────────────────

async function classifyDocument(textOrContent) {
  if (!process.env.OPENAI_API_KEY) {
    return { doc_type: 'unknown', confidence: 0, reasoning: 'OpenAI not configured' };
  }

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a document classifier for commercial real estate loan servicing.
Classify the document into exactly one of these types:
loan_document, appraisal_report, insurance_acord, inspection_report, rent_roll,
operating_statement, reserve_report, draw_request, email_request, spreadsheet,
title_report, environmental_report, other

Return JSON: {"doc_type": string, "confidence": 0-1, "reasoning": string}`
        },
        { role: 'user', content: `Classify this document:\n\n${String(textOrContent).slice(0, 4000)}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });

    return JSON.parse(resp.choices[0].message.content || '{}');
  } catch (err) {
    return { doc_type: 'unknown', confidence: 0, reasoning: err.message };
  }
}

// ── Core extraction function ──────────────────────────────────────────────────

/**
 * Extract structured data from document text or base64-encoded content.
 *
 * @param {object} params
 * @param {string} params.content       — Raw text or base64 image/PDF content
 * @param {string} params.docType       — One of the EXTRACTION_SCHEMAS keys
 * @param {string} [params.contentType] — 'text' | 'image/jpeg' | 'image/png' | 'application/pdf'
 * @param {string} [params.filename]    — Original filename for context
 */
async function extractFromDocument({ content, docType, contentType = 'text', filename = '' }) {
  const started = Date.now();
  const schema = EXTRACTION_SCHEMAS[docType];

  if (!process.env.OPENAI_API_KEY) {
    return buildDemoResult(docType, filename);
  }

  if (!schema) {
    return { error: `Unknown doc_type: ${docType}`, extracted: null };
  }

  try {
    const systemPrompt = `You are a specialist in CRE loan servicing document analysis.
Extract structured data from the provided document using the supplied function schema.
Be precise with numbers — extract exact values, not approximations.
For dates, always use YYYY-MM-DD format.
For monetary amounts, return the numeric USD value without formatting symbols.
For rates, return as decimals (0.065 not 6.5%).
If a field cannot be determined from the document, omit it rather than guessing.
Identify and include in notes any data quality issues, ambiguities, or items requiring human review.`;

    const userContent = contentType === 'text'
      ? `Extract structured data from this ${docType.replace('_', ' ')}:\n\nFilename: ${filename}\n\n${content.slice(0, 15000)}`
      : [
          { type: 'text', text: `Extract structured data from this ${docType.replace('_', ' ')}. Filename: ${filename}` },
          { type: 'image_url', image_url: { url: `data:${contentType};base64,${content}`, detail: 'high' } },
        ];

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      tools: [{ type: 'function', function: schema }],
      tool_choice: { type: 'function', function: { name: schema.name } },
      max_tokens: 2000,
    });

    const toolCall = resp.choices[0]?.message?.tool_calls?.[0];
    const extracted = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    const processingMs = Date.now() - started;

    return {
      doc_type: docType,
      filename,
      extracted,
      confidence: computeConfidence(extracted, schema),
      model: 'gpt-4o-mini',
      processing_ms: processingMs,
      usage: resp.usage,
      extracted_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[documentIntelligence] extraction error:', err.message);
    return { doc_type: docType, filename, extracted: null, error: err.message, processing_ms: Date.now() - started };
  }
}

// ── Confidence scoring ────────────────────────────────────────────────────────

function computeConfidence(extracted, schema) {
  if (!extracted || !schema?.parameters?.required?.length) return 0.5;
  const required = schema.parameters.required;
  const present = required.filter((field) => extracted[field] != null && extracted[field] !== '');
  const fieldScore = present.length / required.length;

  // Penalize if notes contains "unable", "unclear", "not found"
  const notesText = (extracted.notes || '').toLowerCase();
  const qualityPenalty = /unable|unclear|not found|cannot determine|missing/.test(notesText) ? 0.15 : 0;

  return Math.max(0, Math.min(1, fieldScore - qualityPenalty));
}

// ── Demo results (when OpenAI not configured) ─────────────────────────────────

function buildDemoResult(docType, filename) {
  const demos = {
    loan_document: {
      borrower_name: 'Meridian Realty Partners LLC', lender_name: 'Summit Capital Group',
      loan_amount: 12500000, interest_rate: 0.0675, rate_type: 'fixed',
      origination_date: '2023-04-01', maturity_date: '2026-04-01', loan_term_months: 36,
      property_address: '1204 Harbor View Drive, Miami, FL 33101', property_type: 'multifamily',
      dscr_covenant: 1.25, ltv_covenant: 75, gse_agency: 'freddie_mac',
      loan_number: 'LN-0094', recourse_type: 'non_recourse',
    },
    appraisal_report: {
      property_address: '1204 Harbor View Drive, Miami, FL 33101', property_type: 'multifamily',
      appraiser_name: 'Robert Chen, MAI', appraisal_firm: 'Southeast Valuation Group',
      effective_date: '2026-02-15', as_is_value: 18750000, cap_rate: 0.0545,
      noi: 1021875, gross_potential_rent: 1512000, vacancy_rate: 0.05,
      value_approach: 'income', unit_count: 96,
    },
    insurance_acord: {
      policy_number: 'CPP-2024-88341', carrier_name: 'Travelers Insurance',
      named_insured: 'Meridian Realty Partners LLC',
      property_address: '1204 Harbor View Drive, Miami, FL 33101',
      policy_type: 'property', coverage_amount: 18000000, deductible: 25000,
      effective_date: '2026-01-01', expiration_date: '2027-01-01',
      additional_insured: ['Summit Capital Group'], lender_loss_payee: 'Summit Capital Group',
    },
    inspection_report: {
      property_address: '1204 Harbor View Drive, Miami, FL 33101',
      inspection_date: '2026-04-11', inspector_name: 'James Torres',
      vendor_name: 'Field Services Inc.', overall_condition: 'fair', condition_score: 68,
      deficiencies: [
        { item: 'Roof membrane delamination — Section C', location: 'Roof Level', severity: 'critical', category: 'roofing', estimated_cost: 45000, cure_timeline: '30 days' },
        { item: 'Elevator cab deterioration — Unit 3', location: 'Building A', severity: 'high', category: 'mechanical', estimated_cost: 12000, cure_timeline: '60 days' },
        { item: 'Parking lot resurfacing required', location: 'East parking', severity: 'medium', category: 'exterior', estimated_cost: 8500, cure_timeline: '90 days' },
        { item: 'Pool pump replacement', location: 'Amenity deck', severity: 'medium', category: 'mechanical', estimated_cost: 4200, cure_timeline: '60 days' },
      ],
      total_critical_count: 1, total_high_count: 2, estimated_total_cost: 69700, draw_hold_recommended: true,
    },
    email_request: {
      request_type: 'payoff_request', urgency: 'high',
      sender_name: 'Sarah Mitchell', sender_email: 'smitchell@meridianlp.com', sender_company: 'Meridian Realty Partners',
      loan_number: 'LN-0094', received_date: '2026-04-14', subject_line: 'Payoff Request — LN-0094',
      summary: 'Borrower is requesting a payoff statement for loan LN-0094 ahead of a planned refinancing. They require the statement within 3 business days.',
      action_required: 'Generate and deliver payoff statement including prepayment calculation to borrower within 3 business days.',
      deadline: '2026-04-17',
    },
  };

  const extracted = demos[docType] || { note: `Demo extraction for ${docType}` };
  return {
    doc_type: docType,
    filename,
    extracted,
    confidence: 0.92,
    model: 'demo',
    processing_ms: 250,
    extracted_at: new Date().toISOString(),
  };
}

module.exports = { extractFromDocument, classifyDocument, EXTRACTION_SCHEMAS };
