/**
 * Kontra Legacy System Adapters — Phase 4
 *
 * Each adapter normalizes data from a specific source system format into
 * Kontra's unified schema objects. Adapters are stateless, pure functions.
 *
 * Supported source systems:
 *   fics_export        – FICS loan servicing fixed-width or XML export
 *   situs_csv          – Situs/AMC servicing platform CSV export
 *   yardi_json         – Yardi API response or export JSON
 *   mri_csv            – MRI Software CSV export
 *   riskmetrics_csv    – RiskMetrics/Trepp CMBS surveillance CSV
 *   spreadsheet_csv    – Generic CSV/Excel (column auto-mapping)
 *   email_text         – Raw email or fax text
 *   inspection_vendor  – Field Services Inc., Axis, etc. JSON/CSV report
 *   insurance_acord    – ACORD XML or structured insurance data
 *   reserve_xml        – Reserve system XML export
 */

// ── Shared normalizer utilities ───────────────────────────────────────────────

function parseNum(v) {
  if (v == null || v === '') return null;
  return Number(String(v).replace(/[,$%]/g, '')) || null;
}

function parsePct(v) {
  const n = parseNum(v);
  if (n == null) return null;
  return n > 1 ? n / 100 : n; // Convert 92.5 → 0.925
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function mapLoanType(v) {
  const s = String(v || '').toLowerCase();
  if (/bridge|brdg/.test(s)) return 'bridge';
  if (/construct|const/.test(s)) return 'construction';
  if (/mezz|mezzanine/.test(s)) return 'mezz';
  if (/term|perm/.test(s)) return 'term';
  if (/loc|line/.test(s)) return 'line_of_credit';
  return 'term';
}

function mapPropertyType(v) {
  const s = String(v || '').toLowerCase();
  if (/multi|apt|apart|resid/.test(s)) return 'multifamily';
  if (/office/.test(s)) return 'office';
  if (/retail|shop|strip/.test(s)) return 'retail';
  if (/industri|warehouse|flex/.test(s)) return 'industrial';
  if (/hotel|hospitality|motel/.test(s)) return 'hotel';
  if (/mixed|mix/.test(s)) return 'mixed_use';
  return 'other';
}

function mapSeverity(v) {
  const s = String(v || '').toLowerCase();
  if (/crit|4|urgent|immedi/.test(s)) return 'critical';
  if (/high|3|major/.test(s)) return 'high';
  if (/med|2|moder/.test(s)) return 'medium';
  if (/low|1|minor/.test(s)) return 'low';
  return 'medium';
}

// ── Adapter registry ──────────────────────────────────────────────────────────

const ADAPTERS = {

  // ── FICS Export ─────────────────────────────────────────────────────────────
  fics_export: {
    id: 'fics_export',
    name: 'FICS Loan Servicing',
    category: 'servicing_platform',
    formats: ['xml', 'fixed_width', 'csv'],
    description: 'Financial Industry Computer Systems (FICS) loan servicing export. Handles both XML and fixed-width formats.',
    fields_mapped: 48,
    icon: 'server',

    normalize(raw) {
      // FICS XML or parsed object format
      const d = raw.LoanRecord || raw.loan_record || raw;
      return {
        _source: 'fics_export',
        _normalized_at: new Date().toISOString(),
        loan: {
          external_id:       d.LOAN_NO || d.loan_no || d.LoanNumber,
          loan_number:       d.LOAN_NO || d.loan_no || d.LoanNumber,
          borrower_name:     d.BORROWER_NAME || d.BorrowerName || d.borrower_name,
          original_balance:  parseNum(d.ORIG_BAL || d.OriginalBalance || d.orig_bal),
          current_balance:   parseNum(d.CURR_BAL || d.CurrentBalance || d.curr_bal),
          interest_rate:     parsePct(d.INT_RATE || d.InterestRate || d.int_rate),
          loan_type:         mapLoanType(d.LOAN_TYPE || d.LoanType || d.loan_type),
          property_type:     mapPropertyType(d.PROP_TYPE || d.PropertyType || d.prop_type),
          property_address:  [d.PROP_ADDR || d.PropertyAddress, d.PROP_CITY, d.PROP_STATE, d.PROP_ZIP].filter(Boolean).join(', '),
          origination_date:  parseDate(d.ORIG_DATE || d.OriginationDate || d.orig_date),
          maturity_date:     parseDate(d.MAT_DATE || d.MaturityDate || d.mat_date),
          payment_status:    d.PAY_STATUS || d.PaymentStatus || d.pay_status,
          days_delinquent:   parseNum(d.DAYS_DLQ || d.DaysDelinquent || d.days_dlq) || 0,
          next_payment_date: parseDate(d.NXT_PAY_DT || d.NextPaymentDate),
          servicer_id:       d.SERVICER_ID || d.ServicerId,
        },
      };
    },
  },

  // ── Situs/AMC CSV ───────────────────────────────────────────────────────────
  situs_csv: {
    id: 'situs_csv',
    name: 'Situs / CRES (AMC)',
    category: 'servicing_platform',
    formats: ['csv'],
    description: 'Situs and CRES by AMC servicing platform CSV export. Common in CMBS and institutional loan servicing.',
    fields_mapped: 42,
    icon: 'table',

    normalize(raw) {
      const d = Array.isArray(raw) ? raw[0] : raw;
      return {
        _source: 'situs_csv',
        _normalized_at: new Date().toISOString(),
        loan: {
          external_id:       d['Loan Number'] || d.loan_number,
          loan_number:       d['Loan Number'] || d.loan_number,
          borrower_name:     d['Borrower Name'] || d.borrower_name,
          original_balance:  parseNum(d['Original Balance'] || d.original_balance),
          current_balance:   parseNum(d['UPB'] || d['Current Balance'] || d.current_balance),
          interest_rate:     parsePct(d['Interest Rate'] || d.interest_rate),
          property_type:     mapPropertyType(d['Property Type'] || d.property_type),
          property_address:  d['Property Address'] || d.property_address,
          maturity_date:     parseDate(d['Maturity Date'] || d.maturity_date),
          dscr:              parseNum(d['DSCR'] || d.dscr),
          ltv:               parsePct(d['LTV'] || d.ltv),
          occupancy:         parsePct(d['Occupancy'] || d.occupancy),
          days_delinquent:   parseNum(d['Days Delinquent'] || d.days_delinquent) || 0,
          watchlist_flag:    /yes|true|1|y/i.test(String(d['Watchlist'] || d.watchlist || '')),
          pool_id:           d['Pool ID'] || d.pool_id,
          cusip:             d['CUSIP'] || d.cusip,
        },
      };
    },
  },

  // ── Yardi JSON ──────────────────────────────────────────────────────────────
  yardi_json: {
    id: 'yardi_json',
    name: 'Yardi Voyager',
    category: 'property_management',
    formats: ['json', 'xml'],
    description: 'Yardi Voyager property management API response. Exports rent rolls, GL data, and property financial data.',
    fields_mapped: 38,
    icon: 'building',

    normalize(raw) {
      const props = raw.Properties || raw.properties || [raw];
      const prop = props[0] || {};
      const units = prop.Units || prop.units || [];
      const occupied = units.filter((u) => /occupied|leased/i.test(u.Status || u.status || ''));
      const totalRent = units.reduce((s, u) => s + (parseNum(u.ContractRent || u.contract_rent || u.MonthlyRent) || 0), 0);
      return {
        _source: 'yardi_json',
        _normalized_at: new Date().toISOString(),
        property: {
          external_id:       prop.PropertyId || prop.property_id,
          name:              prop.PropertyName || prop.property_name,
          address:           prop.Address || prop.address,
          unit_count:        units.length,
          occupied_units:    occupied.length,
          occupancy_rate:    units.length > 0 ? occupied.length / units.length : null,
          total_monthly_rent:totalRent,
          avg_rent_per_unit: occupied.length > 0 ? totalRent / occupied.length : null,
        },
        financial: {
          noi:     parseNum(prop.NOI || prop.noi),
          egi:     parseNum(prop.EGI || prop.egi || prop.EffectiveGrossIncome),
          opex:    parseNum(prop.OpEx || prop.opex || prop.OperatingExpenses),
          vacancy_rate: parsePct(prop.VacancyRate || prop.vacancy_rate),
        },
        unit_mix: Object.entries(
          units.reduce((acc, u) => {
            const type = u.UnitType || u.unit_type || 'Unknown';
            if (!acc[type]) acc[type] = { count: 0, occupied: 0, total_rent: 0 };
            acc[type].count++;
            if (/occupied|leased/i.test(u.Status || '')) acc[type].occupied++;
            acc[type].total_rent += parseNum(u.ContractRent || u.MonthlyRent) || 0;
            return acc;
          }, {})
        ).map(([type, data]) => ({ unit_type: type, ...data, avg_rent: data.count > 0 ? data.total_rent / data.count : 0 })),
      };
    },
  },

  // ── MRI CSV ─────────────────────────────────────────────────────────────────
  mri_csv: {
    id: 'mri_csv',
    name: 'MRI Software',
    category: 'property_management',
    formats: ['csv', 'excel'],
    description: 'MRI Software commercial property management export. Common for office, retail, and industrial portfolios.',
    fields_mapped: 35,
    icon: 'table',

    normalize(raw) {
      const rows = Array.isArray(raw) ? raw : [raw];
      const first = rows[0] || {};
      return {
        _source: 'mri_csv',
        _normalized_at: new Date().toISOString(),
        leases: rows.map((r) => ({
          tenant_name:     r['Tenant Name'] || r.tenant_name,
          unit:            r['Unit'] || r['Suite'] || r.unit,
          lease_start:     parseDate(r['Lease Start'] || r.lease_start),
          lease_end:       parseDate(r['Lease End'] || r.lease_end),
          monthly_rent:    parseNum(r['Monthly Rent'] || r.monthly_rent),
          sqft:            parseNum(r['SqFt'] || r.sqft),
          status:          r['Status'] || r.status,
          deposit:         parseNum(r['Security Deposit'] || r.security_deposit),
        })),
        property: { address: first['Property Address'] || first.property_address },
      };
    },
  },

  // ── Trepp/RiskMetrics CMBS CSV ──────────────────────────────────────────────
  riskmetrics_csv: {
    id: 'riskmetrics_csv',
    name: 'Trepp / RiskMetrics CMBS',
    category: 'surveillance',
    formats: ['csv'],
    description: 'Trepp or RiskMetrics CMBS surveillance export with loan-level DSCR, LTV, and watchlist data.',
    fields_mapped: 28,
    icon: 'chart',

    normalize(raw) {
      const rows = Array.isArray(raw) ? raw : [raw];
      return {
        _source: 'riskmetrics_csv',
        _normalized_at: new Date().toISOString(),
        loans: rows.map((r) => ({
          cusip:             r['CUSIP'] || r.cusip,
          loan_id:           r['Loan ID'] || r['Loan Number'] || r.loan_id,
          property_name:     r['Property Name'] || r.property_name,
          property_type:     mapPropertyType(r['Property Type'] || r.property_type),
          current_balance:   parseNum(r['Current Balance'] || r['UPB'] || r.current_balance),
          dscr_ncf:          parseNum(r['DSCR (NCF)'] || r['DSCR'] || r.dscr),
          ltv_current:       parsePct(r['Current LTV'] || r.ltv_current),
          occupancy:         parsePct(r['Occupancy'] || r.occupancy),
          maturity_date:     parseDate(r['Maturity Date'] || r.maturity_date),
          watchlist:         /yes|true|1|y/i.test(String(r['Watchlist'] || r.watchlist || '')),
          specially_serviced:/yes|true|1|y/i.test(String(r['Special Servicing'] || r.specially_serviced || '')),
          days_delinquent:   parseNum(r['Days Delinquent'] || r.days_delinquent) || 0,
        })),
      };
    },
  },

  // ── Generic Spreadsheet CSV ──────────────────────────────────────────────────
  spreadsheet_csv: {
    id: 'spreadsheet_csv',
    name: 'Generic Spreadsheet (CSV/Excel)',
    category: 'general',
    formats: ['csv', 'excel', 'tsv'],
    description: 'Flexible adapter for any CSV or Excel file. Auto-maps columns to Kontra fields based on header name patterns.',
    fields_mapped: 'dynamic',
    icon: 'upload',

    normalize(raw) {
      const rows = Array.isArray(raw) ? raw : [raw];
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Auto-detect column purpose
      const colMap = {};
      for (const h of headers) {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (/loan_?num|loan_?id|ref_?no/.test(lower)) colMap.loan_number = h;
        else if (/borrower|obligor/.test(lower)) colMap.borrower_name = h;
        else if (/balance|upb|principal/.test(lower)) colMap.current_balance = h;
        else if (/rate|coupon/.test(lower)) colMap.interest_rate = h;
        else if (/dscr|debt.*cov/.test(lower)) colMap.dscr = h;
        else if (/ltv|loan.*val/.test(lower)) colMap.ltv = h;
        else if (/occ.*rate|occupancy/.test(lower)) colMap.occupancy = h;
        else if (/matur.*date|due_?date/.test(lower)) colMap.maturity_date = h;
        else if (/prop.*type|asset.*type/.test(lower)) colMap.property_type = h;
        else if (/address|location/.test(lower)) colMap.property_address = h;
        else if (/delinq|days.*del/.test(lower)) colMap.days_delinquent = h;
      }

      return {
        _source: 'spreadsheet_csv',
        _normalized_at: new Date().toISOString(),
        _column_map: colMap,
        row_count: rows.length,
        headers,
        loans: rows.map((r) => Object.fromEntries(
          Object.entries(colMap).map(([kontraField, csvCol]) => [kontraField, r[csvCol]])
        )),
      };
    },
  },

  // ── Email / Fax Text ─────────────────────────────────────────────────────────
  email_text: {
    id: 'email_text',
    name: 'Email / Fax / Letter',
    category: 'correspondence',
    formats: ['text', 'eml', 'msg'],
    description: 'Parses raw email, fax, or letter text into a structured servicing request object.',
    fields_mapped: 16,
    icon: 'mail',

    normalize(raw) {
      const text = typeof raw === 'string' ? raw : (raw.body || raw.text || JSON.stringify(raw));
      const loanMatch = text.match(/loan\s*[:#]?\s*([A-Z]{0,3}-?\d{4,10})/i);
      const amtMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
      const urgentMatch = /urgent|immediate|asap|by\s+(?:eod|cob|noon)/i.test(text);

      // Extract subject line (first non-blank line or "Subject:" line)
      const subjectLine = text.match(/Subject:\s*(.+)/i)?.[1]?.trim()
        || text.split('\n').find((l) => l.trim().length > 10 && l.trim().length < 200)?.trim()
        || '';

      return {
        _source: 'email_text',
        _normalized_at: new Date().toISOString(),
        request: {
          raw_text:        text,
          subject_line:    subjectLine,
          loan_number:     loanMatch?.[1] || null,
          amount_mentioned:amtMatch ? parseNum(amtMatch[1]) : null,
          date_mentioned:  dateMatch ? parseDate(dateMatch[1]) : null,
          urgency:         urgentMatch ? 'high' : 'normal',
          char_count:      text.length,
          word_count:      text.split(/\s+/).length,
        },
      };
    },
  },

  // ── Inspection Vendor ─────────────────────────────────────────────────────────
  inspection_vendor: {
    id: 'inspection_vendor',
    name: 'Inspection Vendor Report',
    category: 'inspection',
    formats: ['json', 'csv', 'xml'],
    description: 'Structured inspection report from vendors (Field Services Inc., Axis, etc.). Normalizes deficiency data to Kontra format.',
    fields_mapped: 24,
    icon: 'clipboard',

    normalize(raw) {
      const d = raw.inspection || raw.report || raw;
      const deficiencies = (d.deficiencies || d.findings || d.items || []).map((item) => ({
        item:           item.description || item.desc || item.item,
        location:       item.location || item.loc || '',
        severity:       mapSeverity(item.severity || item.priority || item.level),
        category:       item.category || item.type || 'other',
        estimated_cost: parseNum(item.estimated_cost || item.cost || item.repair_estimate),
        cure_timeline:  item.cure_timeline || item.timeline || null,
        photo_reference:item.photo_ref || item.exhibit || null,
      }));

      const critical = deficiencies.filter((x) => x.severity === 'critical').length;
      const high = deficiencies.filter((x) => x.severity === 'high').length;

      return {
        _source: 'inspection_vendor',
        _normalized_at: new Date().toISOString(),
        inspection: {
          property_address:  d.property_address || d.address || d.location,
          inspection_date:   parseDate(d.inspection_date || d.date || d.report_date),
          inspector_name:    d.inspector_name || d.inspector || d.agent_name,
          vendor_name:       d.vendor_name || d.vendor || d.company,
          overall_condition: (d.overall_condition || d.condition || '').toLowerCase() || 'unknown',
          condition_score:   parseNum(d.score || d.condition_score),
          deficiencies,
          total_critical_count:  critical,
          total_high_count:      high,
          estimated_total_cost:  deficiencies.reduce((s, x) => s + (x.estimated_cost || 0), 0),
          draw_hold_recommended: critical > 0 || d.draw_hold || false,
        },
      };
    },
  },

  // ── Insurance ACORD ──────────────────────────────────────────────────────────
  insurance_acord: {
    id: 'insurance_acord',
    name: 'Insurance ACORD / Certificate',
    category: 'insurance',
    formats: ['xml', 'json', 'csv'],
    description: 'ACORD 25/27/28 certificate or binder data. Normalizes coverage, carrier, named insured, and lender loss payee.',
    fields_mapped: 22,
    icon: 'shield',

    normalize(raw) {
      const d = raw.Certificate || raw.Policy || raw.acord || raw;
      return {
        _source: 'insurance_acord',
        _normalized_at: new Date().toISOString(),
        insurance: {
          policy_number:     d.PolicyNumber || d.policy_number || d.CertNumber,
          carrier_name:      d.CarrierName || d.carrier || d.Insurer,
          named_insured:     d.NamedInsured || d.named_insured || d.Insured,
          coverage_amount:   parseNum(d.CoverageAmount || d.coverage_amount || d.Limit),
          deductible:        parseNum(d.Deductible || d.deductible),
          effective_date:    parseDate(d.EffectiveDate || d.effective_date || d.PolicyStart),
          expiration_date:   parseDate(d.ExpirationDate || d.expiration_date || d.PolicyEnd),
          property_address:  d.PropertyAddress || d.property_address || d.Location,
          lender_loss_payee: d.MortgageeClause || d.loss_payee || d.Mortgagee,
          policy_type:       (d.PolicyType || d.policy_type || 'property').toLowerCase(),
          additional_insured:(d.AdditionalInsured || d.additional_insured || []).map((x) => (typeof x === 'string' ? x : x.Name || x.name)),
        },
      };
    },
  },

  // ── Reserve System XML ────────────────────────────────────────────────────────
  reserve_xml: {
    id: 'reserve_xml',
    name: 'Reserve System Export',
    category: 'reserve',
    formats: ['xml', 'json', 'csv'],
    description: 'Capital/replacement reserve account statement export from escrow or reserve management platforms.',
    fields_mapped: 18,
    icon: 'bank',

    normalize(raw) {
      const d = raw.ReserveAccount || raw.Account || raw.reserve || raw;
      return {
        _source: 'reserve_xml',
        _normalized_at: new Date().toISOString(),
        reserve: {
          account_number:    d.AccountNumber || d.account_number || d.AcctNo,
          property_address:  d.PropertyAddress || d.property_address,
          statement_date:    parseDate(d.StatementDate || d.statement_date || d.AsOf),
          beginning_balance: parseNum(d.BeginningBalance || d.beginning_balance || d.BeginBal),
          ending_balance:    parseNum(d.EndingBalance || d.ending_balance || d.EndBal),
          contributions_ytd: parseNum(d.ContributionsYTD || d.contributions_ytd || d.DepositsYTD),
          disbursements_ytd: parseNum(d.DisbursementsYTD || d.disbursements_ytd || d.DrawsYTD),
          interest_earned:   parseNum(d.InterestEarned || d.interest_earned || d.Interest),
          required_balance:  parseNum(d.RequiredBalance || d.required_balance || d.MinBalance),
          low_balance_flag:  (() => {
            const ending = parseNum(d.EndingBalance || d.ending_balance || d.EndBal);
            const required = parseNum(d.RequiredBalance || d.required_balance || d.MinBalance);
            if (ending == null || required == null) return false;
            return ending < required;
          })(),
          pending_draws: (d.PendingDraws || d.pending_draws || []).map((draw) => ({
            description:   draw.Description || draw.description || draw.Desc,
            amount:        parseNum(draw.Amount || draw.amount),
            requested_date:parseDate(draw.RequestedDate || draw.requested_date || draw.Date),
          })),
        },
      };
    },
  },
};

// ── Adapter runner ─────────────────────────────────────────────────────────────

/**
 * Run the specified adapter on raw input data.
 * Returns normalized data + metadata about the transformation.
 */
function runAdapter(adapterId, rawData) {
  const adapter = ADAPTERS[adapterId];
  if (!adapter) {
    return {
      success: false,
      error: `No adapter found for '${adapterId}'. Available: ${Object.keys(ADAPTERS).join(', ')}`,
    };
  }

  try {
    const normalized = adapter.normalize(rawData);
    return {
      success: true,
      adapter_id: adapterId,
      adapter_name: adapter.name,
      normalized,
      normalized_at: new Date().toISOString(),
    };
  } catch (err) {
    return { success: false, adapter_id: adapterId, error: err.message };
  }
}

/**
 * Parse CSV text into array of row objects.
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

module.exports = { ADAPTERS, runAdapter, parseCSV };
