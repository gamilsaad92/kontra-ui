// ── Transaction Record Schema ─────────────────────────────────────────────────
//
// Each workflow pack declares the structured fields Kontra expects to build
// during that transaction. The seven universal categories stay constant;
// the fields inside them are transaction-specific.
//
// Field shape:
//   key:      unique dot-prefixed key (category.field_name)
//   label:    human label shown in the record UI
//   workflowRequired: true → required by this workspace workflow; false → optional
//   requirement: "workflow" | "suggested" | "expected" | "optional"
//   setup:    (optional) workspaceMeta key that seeds an initial value at room creation
//   sources:  (optional) expected source documents for this field
//   role:     (optional) confirmation role expected for approvals fields
//   hint:     (optional) one-line description shown in the field tooltip
//   aliasOf:  (optional) another field key that owns the canonical value
//   dependsOn: (optional) confirmed fact that activates this field

// ── Universal transaction fields (present for every pack) ─────────────────────
const UNIVERSAL_TRANSACTION_FIELDS = [
  { key: "transaction.type",         label: "Transaction type",        workflowRequired: true,  setup: "deal_type"         },
  { key: "transaction.stage",        label: "Current stage",           workflowRequired: true,  setup: "stage"             },
  { key: "transaction.closing_date", label: "Target closing date",     workflowRequired: true,  setup: "closing_date"      },
  { key: "transaction.value",        label: "Transaction value",       workflowRequired: false, setup: "transaction_value" },
  { key: "transaction.jurisdiction", label: "Jurisdiction",            workflowRequired: true,  setup: "jurisdiction"      },
];

// ── Per-pack schemas ──────────────────────────────────────────────────────────

const PACK_SCHEMAS = {

  // ── Commercial Real Estate Acquisition ─────────────────────────────────────
  // Covers all CRE asset types: hotel/hospitality, office, multifamily, retail,
  // industrial. Hotel-specific fields (brand, ADR, RevPAR, franchise/management
  // agreements) are included because CRE commonly includes hospitality deals.
  // Custom AI-generated packs (e.g. Marriott Hotel Acquisition) extend this
  // schema at pack-creation time with asset-type-specific fields.
  cre_acquisition: {
    transaction_extra: [
      { key: "transaction.purchase_price",          label: "Purchase price",              workflowRequired: true,  sources: ["Purchase Agreement", "LOI"] },
      { key: "transaction.earnest_money",           label: "Earnest money deposit",       required: true,  sources: ["Purchase Agreement"] },
      { key: "transaction.dd_expiration",           label: "Due-diligence expiration",    required: true,  sources: ["Purchase Agreement"] },
      { key: "transaction.financing_contingency",   label: "Financing contingency",       workflowRequired: false, sources: ["Purchase Agreement"] },
    ],
    asset_identity: [
      { key: "asset.name",                label: "Property name",               required: true,  setup: "name",   sources: ["Purchase Agreement", "Title Report"] },
      { key: "asset.address",             label: "Property address",            required: true,           sources: ["Purchase Agreement", "Survey"] },
      { key: "asset.type",                label: "Property type",               required: true,           sources: ["Purchase Agreement"], hint: "e.g. Hotel, Office, Multifamily, Retail" },
      { key: "asset.brand",               label: "Hotel brand / flag",          required: false,          sources: ["Franchise Agreement"], hint: "e.g. Marriott, Hilton, Hyatt" },
      { key: "asset.room_count",          label: "Number of rooms / keys",      required: false,          sources: ["Offering Memorandum", "Appraisal"] },
      { key: "asset.ownership_entity",    label: "Current owner entity",        required: true,           sources: ["Title Report", "Operating Agreement"] },
      { key: "asset.property_manager",    label: "Property manager",            required: false,          sources: ["Management Agreement"] },
      { key: "asset.franchise_agreement", label: "Franchise / flag agreement",  required: false,          sources: ["Franchise Agreement"] },
      { key: "asset.management_agreement",label: "Management agreement",        required: false,          sources: ["Management Agreement"] },
      { key: "asset.parcel_ref",          label: "Parcel / title reference",    required: false,          sources: ["Title Report", "Survey"] },
    ],
    parties: [
      { key: "parties.buyer",          label: "Buyer",                     required: true,  sources: ["Purchase Agreement"] },
      { key: "parties.seller",         label: "Seller",                    required: true,  sources: ["Purchase Agreement"] },
      { key: "parties.buyer_broker",   label: "Buyer's representative",    required: false, sources: ["Representation Agreement"] },
      { key: "parties.seller_broker",  label: "Seller's representative",   required: false, sources: ["Listing Agreement"] },
      { key: "parties.counsel",        label: "Legal counsel",             required: true,  sources: ["Engagement Letter"] },
      { key: "parties.lender",         label: "Lender",                    workflowRequired: false, sources: ["Term Sheet", "Loan Application"], dependsOn: { field: "transaction.financing_contingency", inactiveWhen: ["n/a", "no", "none", "not applicable", "not needed"] } },
      { key: "parties.title_company",  label: "Title / escrow company",    required: true,  sources: ["Title Commitment"] },
      { key: "parties.inspector",      label: "Property inspector",        required: false, sources: ["Inspection Report"] },
    ],
    beneficial_ownership: [
      { key: "ownership.titled_owner",      label: "Current titled owner",      required: true,  sources: ["Title Report"] },
      { key: "ownership.acquiring_entity",  label: "Proposed acquiring entity", required: true,  sources: ["Purchase Agreement", "Operating Agreement"] },
      { key: "ownership.beneficial_owners", label: "Beneficial owners",         required: false, sources: ["Operating Agreement"] },
      { key: "ownership.percentages",       label: "Ownership percentages",     required: false, sources: ["Operating Agreement"] },
      { key: "ownership.liens",             label: "Existing liens / encumbrances", required: true, sources: ["Title Report"] },
    ],
    financial: [
      { key: "financial.purchase_price",      label: "Purchase price",              aliasOf: "transaction.purchase_price", workflowRequired: true, sources: ["Purchase Agreement"] },
      { key: "financial.revenue",             label: "Historical revenue",          required: false, sources: ["Profit & Loss", "Offering Memorandum"] },
      { key: "financial.noi",                 label: "Net operating income (NOI)",  required: true,  sources: ["Profit & Loss", "Appraisal"] },
      { key: "financial.occupancy",           label: "Occupancy rate",              required: false, sources: ["STR Report", "Offering Memorandum"], hint: "Trailing 12 months %" },
      { key: "financial.adr",                 label: "ADR (Average Daily Rate)",    required: false, sources: ["STR Report", "Offering Memorandum"] },
      { key: "financial.revpar",              label: "RevPAR",                      required: false, sources: ["STR Report", "Offering Memorandum"] },
      { key: "financial.existing_debt",       label: "Existing debt",               required: false, sources: ["Loan Documents", "Title Report"] },
      { key: "financial.proposed_financing",  label: "Proposed financing",          workflowRequired: false, sources: ["Term Sheet", "Loan Application"], dependsOn: { field: "transaction.financing_contingency", inactiveWhen: ["n/a", "no", "none", "not applicable", "not needed"] } },
      { key: "financial.required_equity",     label: "Required equity",             workflowRequired: false, sources: ["Loan Application"], dependsOn: { field: "transaction.financing_contingency", inactiveWhen: ["n/a", "no", "none", "not applicable", "not needed"] } },
      { key: "financial.capex",               label: "CapEx obligations",           required: false, sources: ["Property Inspection", "PIP Report"] },
      { key: "financial.cap_rate",            label: "Cap rate",                    required: false, sources: ["Appraisal", "Offering Memorandum"] },
      { key: "financial.ltv",                 label: "LTV ratio",                   required: false, sources: ["Appraisal", "Term Sheet"] },
      { key: "financial.dscr",                label: "DSCR",                        required: false, sources: ["Loan Application"] },
      { key: "financial.debt_yield",          label: "Debt yield",                  required: false, sources: ["Loan Application"] },
    ],
    legal: [
      { key: "legal.purchase_agreement",    label: "Purchase agreement",          required: true,  sources: ["Purchase Agreement"] },
      { key: "legal.title_status",          label: "Title status",                required: true,  sources: ["Title Commitment"] },
      { key: "legal.survey_status",         label: "Survey status",               required: false, sources: ["Survey"] },
      { key: "legal.zoning",                label: "Zoning classification",       required: true,  sources: ["Zoning Letter", "Survey"] },
      { key: "legal.environmental",         label: "Environmental matters",       required: true,  sources: ["Phase I ESA", "Phase II ESA"] },
      { key: "legal.franchise_status",      label: "Franchise agreement status",  required: false, sources: ["Franchise Agreement"] },
      { key: "legal.management_status",     label: "Management agreement status", required: false, sources: ["Management Agreement"] },
      { key: "legal.transfer_approvals",    label: "Transfer approvals required", required: false, sources: ["Franchise Agreement", "Loan Documents"] },
      { key: "legal.material_litigation",   label: "Material litigation",         required: true,  sources: ["Litigation Search", "Seller Disclosure"] },
      { key: "legal.encumbrances",          label: "Lease / lien encumbrances",   required: true,  sources: ["Title Report"] },
    ],
    approvals: [
      { key: "approval.buyer",     label: "Buyer approval",        required: true,  role: "Buyer" },
      { key: "approval.seller",    label: "Seller approval",       required: true,  role: "Seller" },
      { key: "approval.counsel",   label: "Counsel review",        required: true,  role: "Legal Counsel" },
      { key: "approval.lender",    label: "Lender approval",       workflowRequired: false, role: "Lender", dependsOn: { field: "transaction.financing_contingency", inactiveWhen: ["n/a", "no", "none", "not applicable", "not needed"] } },
      { key: "approval.franchise", label: "Franchise / brand approval", required: false, role: "Franchisor" },
      { key: "approval.closing",   label: "Closing authorization", required: true,  role: "Deal Coordinator" },
    ],
  },

  // ── Business Acquisition ───────────────────────────────────────────────────
  business_acquisition: {
    transaction_extra: [
      { key: "transaction.purchase_price",        label: "Purchase price",            required: true,  sources: ["Purchase Agreement", "LOI"] },
      { key: "transaction.earnest_money",         label: "Deposit / escrow",          required: false, sources: ["Purchase Agreement"] },
      { key: "transaction.dd_expiration",         label: "Due-diligence deadline",    required: true,  sources: ["Purchase Agreement"] },
      { key: "transaction.financing_contingency", label: "Financing contingency",     required: false, sources: ["Purchase Agreement"] },
    ],
    asset_identity: [
      { key: "asset.legal_name",   label: "Legal entity name",  required: true,  setup: "name", sources: ["Purchase Agreement"] },
      { key: "asset.dba",          label: "DBA / trade name",   required: false,               sources: ["Operating Agreement"] },
      { key: "asset.industry",     label: "Industry",           required: true,                sources: ["Offering Memorandum"] },
      { key: "asset.hq",           label: "Headquarters",       required: false,               sources: ["Purchase Agreement"] },
      { key: "asset.entity_type",  label: "Entity type",        required: true,                sources: ["Articles of Incorporation"] },
    ],
    parties: [
      { key: "parties.buyer",       label: "Buyer",             required: true,  sources: ["Purchase Agreement"] },
      { key: "parties.seller",      label: "Seller",            required: true,  sources: ["Purchase Agreement"] },
      { key: "parties.ma_advisor",  label: "M&A advisor",       required: false, sources: ["Engagement Letter"] },
      { key: "parties.counsel",     label: "Legal counsel",     required: true,  sources: ["Engagement Letter"] },
      { key: "parties.accountant",  label: "Accountant / CPA",  required: false, sources: ["Engagement Letter"] },
    ],
    beneficial_ownership: [
      { key: "ownership.existing_owners", label: "Existing shareholders", required: true,  sources: ["Cap Table"] },
      { key: "ownership.cap_table",       label: "Cap table",             required: true,  sources: ["Cap Table"] },
      { key: "ownership.structure",       label: "Ownership structure",   required: false, sources: ["Operating Agreement"] },
    ],
    financial: [
      { key: "financial.purchase_price",    label: "Purchase price",                 aliasOf: "transaction.purchase_price", workflowRequired: true, sources: ["Purchase Agreement"] },
      { key: "financial.revenue",           label: "Revenue (trailing 12 months)",   required: true,  sources: ["Profit & Loss", "Tax Return"] },
      { key: "financial.ebitda",            label: "EBITDA",                         required: true,  sources: ["Profit & Loss"] },
      { key: "financial.multiple",          label: "EV / EBITDA multiple",           required: false, sources: ["Purchase Agreement", "LOI"] },
      { key: "financial.working_capital",   label: "Working capital peg",            required: false, sources: ["Purchase Agreement"] },
    ],
    legal: [
      { key: "legal.purchase_agreement", label: "Purchase agreement type", required: true,  sources: ["Purchase Agreement"] },
      { key: "legal.ip_status",          label: "IP and proprietary assets", required: false, sources: ["IP Schedule", "Purchase Agreement"] },
      { key: "legal.key_employee",       label: "Key employee arrangements", required: false, sources: ["Employment Agreements"] },
      { key: "legal.contingencies",      label: "Contingencies",            required: true,  sources: ["Purchase Agreement"] },
    ],
    approvals: [
      { key: "approval.board",       label: "Board approval",        required: true,  role: "Board Member" },
      { key: "approval.shareholder", label: "Shareholder consent",   required: true,  role: "Shareholder" },
      { key: "approval.regulatory",  label: "Regulatory clearance",  required: false, role: "Deal Coordinator" },
      { key: "approval.closing",     label: "Closing authorization", required: true,  role: "Deal Coordinator" },
    ],
  },

  // ── Fundraising ────────────────────────────────────────────────────────────
  fundraising: {
    transaction_extra: [
      { key: "transaction.target_close",     label: "Target close date",      required: false, sources: ["Term Sheet"] },
      { key: "transaction.instrument_type",  label: "Instrument type",        required: true,  sources: ["Term Sheet"], hint: "SAFE, convertible note, equity" },
    ],
    asset_identity: [
      { key: "asset.issuer",       label: "Issuer / company name",           required: true,  setup: "name",         sources: ["Term Sheet"] },
      { key: "asset.entity_type",  label: "Entity type",                     required: true,                         sources: ["Articles of Incorporation"] },
      { key: "asset.incorporation",label: "Jurisdiction of incorporation",   required: true,  setup: "jurisdiction", sources: ["Articles of Incorporation"] },
    ],
    parties: [
      { key: "parties.lead_investor",     label: "Lead investor",        required: false, sources: ["Term Sheet"] },
      { key: "parties.counsel",           label: "Legal counsel",        required: true,  sources: ["Engagement Letter"] },
      { key: "parties.existing_investors",label: "Existing investors",   required: false, sources: ["Cap Table"] },
      { key: "parties.placement_agent",   label: "Placement agent",      required: false, sources: ["Engagement Letter"] },
    ],
    beneficial_ownership: [
      { key: "ownership.pre_money_cap_table", label: "Pre-money cap table", required: true,  sources: ["Cap Table"] },
      { key: "ownership.founders",            label: "Founders / founding team", required: true,  sources: ["Cap Table"] },
      { key: "ownership.option_pool",         label: "Option pool",          required: false, sources: ["Cap Table"] },
    ],
    financial: [
      { key: "financial.target_raise",   label: "Target raise",              required: true,  setup: "transaction_value", sources: ["Term Sheet"] },
      { key: "financial.pre_money_val",  label: "Pre-money valuation",       required: true,                             sources: ["Term Sheet"] },
      { key: "financial.post_money_val", label: "Post-money valuation",      required: false,                            sources: ["Term Sheet"] },
      { key: "financial.instrument",     label: "Instrument (SAFE / note / equity)", required: true,                    sources: ["Term Sheet"] },
      { key: "financial.lead_terms",     label: "Lead investor terms",       required: false,                            sources: ["Term Sheet"] },
    ],
    legal: [
      { key: "legal.term_sheet",           label: "Term sheet status",        required: true,  sources: ["Term Sheet"] },
      { key: "legal.securities_exemption", label: "Securities exemption",     required: true,  sources: ["Legal Opinion"] },
      { key: "legal.investor_rights",      label: "Investor rights agreement",required: false, sources: ["Investor Rights Agreement"] },
    ],
    approvals: [
      { key: "approval.board",               label: "Board consent",                  required: true,  role: "Board Member" },
      { key: "approval.investor_commitments",label: "Investor commitments received",  required: false, role: "Deal Coordinator" },
    ],
  },

  // ── Digital Asset / Tokenization Preparation ───────────────────────────────
  tokenization: {
    transaction_extra: [
      { key: "transaction.target_raise",    label: "Target raise",          required: true,  setup: "transaction_value", sources: ["Offering Documents"] },
      { key: "transaction.instrument_type", label: "Token / instrument type", required: true,                            sources: ["Offering Documents"] },
    ],
    asset_identity: [
      { key: "asset.name",             label: "Underlying asset name",  required: true,  setup: "name", sources: ["Offering Documents"] },
      { key: "asset.type",             label: "Asset type",             required: true,               sources: ["Offering Documents"] },
      { key: "asset.ownership_entity", label: "Ownership entity",       required: true,               sources: ["Operating Agreement"] },
    ],
    parties: [
      { key: "parties.issuer",             label: "Issuer",                          required: true,  sources: ["Offering Documents"] },
      { key: "parties.counsel",            label: "Legal counsel",                   required: true,  sources: ["Engagement Letter"] },
      { key: "parties.issuance_provider",  label: "External issuance provider",      required: false, sources: [] },
      { key: "parties.transfer_agent",     label: "External transfer agent",         required: false, sources: [] },
      { key: "parties.custodian",          label: "External custodian",              required: false, sources: [] },
    ],
    beneficial_ownership: [
      { key: "ownership.beneficial_owners",label: "Beneficial owners",    required: true,  sources: ["Operating Agreement", "Cap Table"] },
      { key: "ownership.cap_table",        label: "Existing cap table",   required: true,  sources: ["Cap Table"] },
      { key: "ownership.aml_kyc",          label: "AML / KYC status",     required: true,  sources: [] },
    ],
    financial: [
      { key: "financial.asset_valuation",  label: "Asset valuation",      required: true,  sources: ["Appraisal", "Offering Documents"] },
      { key: "financial.use_of_proceeds",  label: "Use of proceeds",      required: true,  sources: ["Offering Documents"] },
    ],
    legal: [
      { key: "legal.exemption",       label: "Legal exemption",           required: true,  sources: ["Legal Opinion"] },
      { key: "legal.offering_docs",   label: "Offering documents status", required: true,  sources: ["Offering Documents"] },
      { key: "legal.legal_opinion",   label: "Legal opinion",             required: true,  sources: ["Legal Opinion"] },
    ],
    approvals: [
      { key: "approval.legal",       label: "Legal counsel sign-off",  required: true,  role: "Legal Counsel" },
      { key: "approval.compliance",  label: "Compliance review",       required: true,  role: "Compliance Officer" },
    ],
  },
};

// Generic fallback for custom/AI-generated packs
const GENERIC_SCHEMA = {
  transaction_extra: [],
  asset_identity: [
    { key: "asset.name",        label: "Entity / asset name", workflowRequired: false, requirement: "expected", setup: "name", sources: [] },
    { key: "asset.type",        label: "Type",                workflowRequired: false, requirement: "suggested",                 sources: [] },
    { key: "asset.jurisdiction",label: "Jurisdiction",        required: false, setup: "jurisdiction", sources: [] },
  ],
  parties: [
    { key: "parties.primary",      label: "Primary party",  workflowRequired: false, requirement: "suggested",  sources: [] },
    { key: "parties.counterparty", label: "Counterparty",   workflowRequired: false, requirement: "suggested",   sources: [] },
    { key: "parties.counsel",      label: "Legal counsel",  required: false, sources: [] },
  ],
  beneficial_ownership: [
    { key: "ownership.owners",    label: "Beneficial owner(s)", required: false, sources: [] },
    { key: "ownership.structure", label: "Ownership structure", required: false, sources: [] },
  ],
  financial: [
    { key: "financial.deal_value", label: "Deal value",         workflowRequired: false, requirement: "suggested",  setup: "transaction_value", sources: [] },
    { key: "financial.terms",      label: "Key financial terms", required: false,                            sources: [] },
  ],
  legal: [
    { key: "legal.governing_docs", label: "Governing documents",  required: false, sources: [] },
    { key: "legal.jurisdiction",   label: "Governing jurisdiction",required: false, sources: [] },
  ],
  approvals: [
    { key: "approval.primary", label: "Primary party approval", workflowRequired: false, requirement: "expected",  role: "Primary Party" },
    { key: "approval.counsel", label: "Counsel sign-off",       required: false, role: "Legal Counsel" },
  ],
};

// ── Schema pack resolution ─────────────────────────────────────────────────────
//
// Resolution order (first match wins):
//   1. Direct hit — packId is a known built-in key (cre_acquisition, etc.)
//   2. Custom ws_* pack — use pack.transactionType to find the base schema
//   3. Workspace name inference — detect asset class from the room name
//   4. Fall through to GENERIC_SCHEMA
//
// This means the Transaction Record always shows CRE/hotel/M&A/fundraising
// fields even when the workspace was created through the custom AI pack builder
// (which stores its own ws_* ID and a transactionType pointing back to the base).

// Keywords that map a workspace name to a base schema
const NAME_TO_SCHEMA = [
  {
    schema: 'cre_acquisition',
    words:  ['hotel', 'motel', 'resort', 'lodge', 'inn', 'hospitality', 'cre',
             'real estate', 'property', 'apartment', 'multifamily', 'office',
             'retail', 'industrial', 'warehouse', 'mall', 'commercial', 'ground lease',
             'flag conversion', 'refinanc', 'construction loan', 'asset acquisition'],
  },
  {
    schema: 'fundraising',
    words:  ['fundrais', 'capital raise', 'investment round', 'seed round',
             'series a', 'series b', 'series c', 'venture', 'term sheet',
             'safe note', 'convertible note', 'raise capital'],
  },
  {
    schema: 'business_acquisition',
    words:  ['business acquisition', 'company acquisition', 'corporate acquisition',
             'business purchase', 'buy a business', 'selling a business',
             'asset purchase', 'merger', 'm&a', 'management buyout', 'mbo'],
  },
  {
    schema: 'tokenization',
    words:  ['tokeniz', 'token issuance', 'token offering', 'security token',
             'digital asset', ' sto', 'rwa ', 'real world asset', 'fractionali'],
  },
];

function inferSchemaFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const { schema, words } of NAME_TO_SCHEMA) {
    if (words.some(w => lower.includes(w))) return schema;
  }
  return null;
}

/**
 * Resolve the schema key to use for a given packId + pack object + workspace name.
 * Returns a key present in PACK_SCHEMAS, or null (→ GENERIC_SCHEMA).
 *
 * Usage: call this once in the component, then pass the result to getPackRecordSchema.
 */
export function resolveSchemaKey(packId, pack, workspaceName) {
  // 1. Direct hit — built-in pack with its own schema
  if (packId && PACK_SCHEMAS[packId]) return packId;

  // 2. Custom ws_* pack — trust pack.transactionType (set by registerCustomPack)
  if (pack?.transactionType && PACK_SCHEMAS[pack.transactionType]) {
    return pack.transactionType;
  }

  // 3. Workspace name inference
  const fromName = inferSchemaFromName(workspaceName);
  if (fromName) return fromName;

  // 4. Pack name inference (last resort for ws_* packs with descriptive names)
  const fromPackName = inferSchemaFromName(pack?.name);
  if (fromPackName) return fromPackName;

  return null; // will use GENERIC_SCHEMA
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return the full category → fields schema for a given resolved schema key.
 * Universal transaction fields are always present; transaction_extra from the
 * pack are merged in after them.
 *
 * Pass the result of resolveSchemaKey() as schemaKey, or a raw packId for
 * built-in packs. Defaults to GENERIC_SCHEMA when the key is unrecognized.
 */
export function getPackRecordSchema(schemaKey) {
  const specific = PACK_SCHEMAS[schemaKey] || GENERIC_SCHEMA;
  const normalize = (field) => {
    const workflowRequired = field.workflowRequired ?? field.required ?? false;
    return {
      ...field,
      workflowRequired,
      requirement: field.requirement || (workflowRequired ? "workflow" : "expected"),
      canonicalKey: field.aliasOf || field.key,
    };
  };
  return Object.fromEntries([
    ["transaction",          [...UNIVERSAL_TRANSACTION_FIELDS, ...(specific.transaction_extra || [])]],
    ["asset_identity",       specific.asset_identity        || []],
    ["parties",              specific.parties               || []],
    ["beneficial_ownership", specific.beneficial_ownership  || []],
    ["financial",            specific.financial             || []],
    ["legal",                specific.legal                 || []],
    ["approvals",            specific.approvals             || []],
  ].map(([category, fields]) => [category, fields.map(normalize)]));
}

/**
 * Build the display list for the Transaction Record before documents arrive.
 * Returns all schema fields with their seeded value (or null), plus
 * `required` and `sources` for contextual actions.
 *
 * schemaKey should be the result of resolveSchemaKey(); falls back to raw packId.
 */
export function buildSeededFromSchema(schemaKey, workspaceMeta) {
  const schema = getPackRecordSchema(schemaKey);
  const m      = workspaceMeta || {};
  const result = [];

  for (const [category, fields] of Object.entries(schema)) {
    for (const field of fields) {
      let value = null;
      if (field.setup) {
        const raw = m[field.setup];
        if (raw) {
          if (field.setup === "deal_type" || field.setup === "stage") {
            value = String(raw).replace(/_/g, " ");
          } else if (field.setup === "transaction_value") {
            const n = Number(raw);
            value = !isNaN(n) && n > 0 ? `$${n.toLocaleString()}` : String(raw);
          } else {
            value = String(raw);
          }
        }
      }
      result.push({
        category,
        key:      field.key,
        canonicalKey: field.canonicalKey,
        label:    field.label,
        workflowRequired: field.workflowRequired,
        requirement: field.requirement,
        aliasOf:   field.aliasOf || null,
        sources:  field.sources  || [],
        role:     field.role     || null,
        hint:     field.hint     || null,
        dependsOn: field.dependsOn || null,
        value,
      });
    }
  }
  const valuesByKey = new Map(result.map(field => [field.key, field.value]));
  for (const field of result) {
    if (field.aliasOf && !field.value) field.value = valuesByKey.get(field.aliasOf) || null;
  }
  return result;
}

export { PACK_SCHEMAS, UNIVERSAL_TRANSACTION_FIELDS, GENERIC_SCHEMA };
