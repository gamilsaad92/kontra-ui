// ── Transaction Record Schema ─────────────────────────────────────────────────
//
// Each workflow pack declares the structured fields Kontra expects to build
// during that transaction. The seven universal categories are always present;
// the fields inside them vary by transaction type. This is the natural
// extension of the pack architecture:
//
//   Participants + Documents + Stages + Transaction Record Schema
//
// AI-generated custom packs use the generic fallback or generate their own
// schema as part of pack creation.
//
// field shape:
//   key:   unique dot-prefixed key (category.field_name)
//   label: human label shown in the record UI
//   setup: (optional) workspaceMeta key that seeds an initial value from workspace creation
//   hint:  (optional) one-line description shown in the edit tooltip

// ── Universal transaction fields (present for every pack) ─────────────────────
const UNIVERSAL_TRANSACTION_FIELDS = [
  { key: "transaction.type",         label: "Transaction type",     setup: "deal_type"         },
  { key: "transaction.stage",        label: "Current stage",        setup: "stage"             },
  { key: "transaction.closing_date", label: "Target closing date",  setup: "closing_date"      },
  { key: "transaction.value",        label: "Transaction value",    setup: "transaction_value" },
  { key: "transaction.jurisdiction", label: "Jurisdiction",         setup: "jurisdiction"      },
];

// ── Per-pack field schemas ─────────────────────────────────────────────────────
const PACK_SCHEMAS = {
  cre_acquisition: {
    asset_identity: [
      { key: "asset.name",              label: "Property name",              setup: "name" },
      { key: "asset.address",           label: "Property address" },
      { key: "asset.type",              label: "Property type",              hint: "e.g. Hotel, Office, Multifamily" },
      { key: "asset.room_count",        label: "Room count / GLA" },
      { key: "asset.brand",             label: "Flag / brand" },
      { key: "asset.ownership_entity",  label: "Ownership entity" },
    ],
    parties: [
      { key: "parties.buyer",           label: "Buyer" },
      { key: "parties.seller",          label: "Seller" },
      { key: "parties.lender",          label: "Lender" },
      { key: "parties.buyer_broker",    label: "Buyer's broker" },
      { key: "parties.seller_broker",   label: "Seller's broker" },
      { key: "parties.counsel",         label: "Legal counsel" },
    ],
    beneficial_ownership: [
      { key: "ownership.entity",        label: "Ownership entity" },
      { key: "ownership.beneficial_owners", label: "Beneficial owner(s)" },
      { key: "ownership.structure",     label: "Ownership structure" },
    ],
    financial: [
      { key: "financial.purchase_price", label: "Purchase price" },
      { key: "financial.loan_amount",   label: "Loan amount" },
      { key: "financial.ltv",           label: "LTV ratio" },
      { key: "financial.cap_rate",      label: "Cap rate" },
      { key: "financial.noi",           label: "Net operating income (NOI)" },
      { key: "financial.dscr",          label: "DSCR" },
      { key: "financial.debt_yield",    label: "Debt yield" },
    ],
    legal: [
      { key: "legal.zoning",            label: "Zoning classification" },
      { key: "legal.title_status",      label: "Title status" },
      { key: "legal.environmental",     label: "Environmental status" },
      { key: "legal.encumbrances",      label: "Lease / lien encumbrances" },
    ],
    approvals: [
      { key: "approval.lender",         label: "Lender approval" },
      { key: "approval.legal",          label: "Legal sign-off" },
      { key: "approval.regulatory",     label: "Regulatory clearance" },
    ],
  },

  business_acquisition: {
    asset_identity: [
      { key: "asset.legal_name",        label: "Legal entity name",         setup: "name" },
      { key: "asset.dba",               label: "DBA / trade name" },
      { key: "asset.industry",          label: "Industry" },
      { key: "asset.hq",                label: "Headquarters" },
      { key: "asset.entity_type",       label: "Entity type" },
    ],
    parties: [
      { key: "parties.buyer",           label: "Buyer" },
      { key: "parties.seller",          label: "Seller" },
      { key: "parties.ma_advisor",      label: "M&A advisor" },
      { key: "parties.counsel",         label: "Legal counsel" },
      { key: "parties.accountant",      label: "Accountant / CPA" },
    ],
    beneficial_ownership: [
      { key: "ownership.existing_owners", label: "Existing shareholders" },
      { key: "ownership.cap_table",     label: "Cap table" },
      { key: "ownership.structure",     label: "Ownership structure" },
    ],
    financial: [
      { key: "financial.purchase_price", label: "Purchase price" },
      { key: "financial.revenue",       label: "Revenue (trailing 12 months)" },
      { key: "financial.ebitda",        label: "EBITDA" },
      { key: "financial.multiple",      label: "EV / EBITDA multiple" },
      { key: "financial.working_capital", label: "Working capital peg" },
    ],
    legal: [
      { key: "legal.purchase_agreement", label: "Purchase agreement type" },
      { key: "legal.ip_status",         label: "IP and proprietary assets" },
      { key: "legal.key_employee",      label: "Key employee arrangements" },
      { key: "legal.contingencies",     label: "Contingencies" },
    ],
    approvals: [
      { key: "approval.board",          label: "Board approval" },
      { key: "approval.shareholder",    label: "Shareholder consent" },
      { key: "approval.regulatory",     label: "Regulatory clearance" },
    ],
  },

  fundraising: {
    asset_identity: [
      { key: "asset.issuer",            label: "Issuer / company name",     setup: "name" },
      { key: "asset.entity_type",       label: "Entity type" },
      { key: "asset.incorporation",     label: "Jurisdiction of incorporation", setup: "jurisdiction" },
    ],
    parties: [
      { key: "parties.lead_investor",   label: "Lead investor" },
      { key: "parties.counsel",         label: "Legal counsel" },
      { key: "parties.existing_investors", label: "Existing investors" },
      { key: "parties.placement_agent", label: "Placement agent" },
    ],
    beneficial_ownership: [
      { key: "ownership.pre_money_cap_table", label: "Pre-money cap table" },
      { key: "ownership.founders",      label: "Founders / founding team" },
      { key: "ownership.option_pool",   label: "Option pool" },
    ],
    financial: [
      { key: "financial.target_raise",  label: "Target raise",              setup: "transaction_value" },
      { key: "financial.pre_money_val", label: "Pre-money valuation" },
      { key: "financial.post_money_val", label: "Post-money valuation" },
      { key: "financial.instrument",    label: "Instrument (SAFE / note / equity)" },
      { key: "financial.lead_terms",    label: "Lead investor terms" },
    ],
    legal: [
      { key: "legal.term_sheet",        label: "Term sheet status" },
      { key: "legal.securities_exemption", label: "Securities exemption" },
      { key: "legal.investor_rights",   label: "Investor rights agreement" },
    ],
    approvals: [
      { key: "approval.board",          label: "Board consent" },
      { key: "approval.investor_commitments", label: "Investor commitments received" },
    ],
  },

  tokenization: {
    asset_identity: [
      { key: "asset.name",              label: "Underlying asset name",     setup: "name" },
      { key: "asset.type",              label: "Asset type" },
      { key: "asset.ownership_entity",  label: "Ownership entity" },
    ],
    parties: [
      { key: "parties.issuer",          label: "Issuer" },
      { key: "parties.counsel",         label: "Legal counsel" },
      { key: "parties.issuance_provider", label: "External issuance provider" },
      { key: "parties.transfer_agent",  label: "External transfer agent" },
      { key: "parties.custodian",       label: "External custodian" },
    ],
    beneficial_ownership: [
      { key: "ownership.beneficial_owners", label: "Beneficial owners" },
      { key: "ownership.cap_table",     label: "Existing cap table" },
      { key: "ownership.aml_kyc",       label: "AML / KYC status" },
    ],
    financial: [
      { key: "financial.target_raise",  label: "Target raise",              setup: "transaction_value" },
      { key: "financial.asset_valuation", label: "Asset valuation" },
      { key: "financial.use_of_proceeds", label: "Use of proceeds" },
    ],
    legal: [
      { key: "legal.exemption",         label: "Legal exemption" },
      { key: "legal.offering_docs",     label: "Offering documents status" },
      { key: "legal.legal_opinion",     label: "Legal opinion" },
    ],
    approvals: [
      { key: "approval.legal",          label: "Legal counsel sign-off" },
      { key: "approval.compliance",     label: "Compliance review" },
    ],
  },
};

// Generic schema for custom packs — uses transactionType hint if available,
// otherwise falls back to CRE structure. Future: AI builder generates the schema.
const GENERIC_SCHEMA = {
  asset_identity: [
    { key: "asset.name",              label: "Entity / asset name",       setup: "name" },
    { key: "asset.type",              label: "Type" },
    { key: "asset.jurisdiction",      label: "Jurisdiction",              setup: "jurisdiction" },
  ],
  parties: [
    { key: "parties.primary",         label: "Primary party" },
    { key: "parties.counterparty",    label: "Counterparty" },
    { key: "parties.counsel",         label: "Legal counsel" },
  ],
  beneficial_ownership: [
    { key: "ownership.owners",        label: "Beneficial owner(s)" },
    { key: "ownership.structure",     label: "Ownership structure" },
  ],
  financial: [
    { key: "financial.deal_value",    label: "Deal value",                setup: "transaction_value" },
    { key: "financial.terms",         label: "Key financial terms" },
  ],
  legal: [
    { key: "legal.governing_docs",    label: "Governing documents" },
    { key: "legal.jurisdiction",      label: "Governing jurisdiction" },
  ],
  approvals: [
    { key: "approval.primary",        label: "Primary party approval" },
    { key: "approval.counsel",        label: "Counsel sign-off" },
  ],
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return the full category → fields schema for a given packId.
 * Always merges universal transaction fields into the `transaction` category.
 */
export function getPackRecordSchema(packId) {
  const specific = PACK_SCHEMAS[packId] || GENERIC_SCHEMA;
  return {
    transaction:          UNIVERSAL_TRANSACTION_FIELDS,
    asset_identity:       specific.asset_identity        || [],
    parties:              specific.parties               || [],
    beneficial_ownership: specific.beneficial_ownership  || [],
    financial:            specific.financial             || [],
    legal:                specific.legal                 || [],
    approvals:            specific.approvals             || [],
  };
}

/**
 * Build the display list for the empty-state Transaction Record.
 * Only fields whose setup key maps to a non-empty workspaceMeta value get a value;
 * all others are returned with value: null (shown as "Not provided").
 */
export function buildSeededFromSchema(packId, workspaceMeta) {
  const schema = getPackRecordSchema(packId);
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
      result.push({ category, key: field.key, label: field.label, value });
    }
  }
  return result;
}

export { PACK_SCHEMAS, UNIVERSAL_TRANSACTION_FIELDS, GENERIC_SCHEMA };
