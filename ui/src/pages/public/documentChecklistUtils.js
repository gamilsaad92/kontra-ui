/**
 * Document checklist template utilities.
 * Returns the required document sections for a given property/deal type.
 */

const TEMPLATES = {
  Multifamily: [
    { key: 'purchase_agreement', label: 'Purchase & Sale Agreement', required: true },
    { key: 'rent_roll', label: 'Rent Roll (current)', required: true },
    { key: 'financials', label: 'Financial Statements (2yr)', required: true },
    { key: 'estoppel', label: 'Estoppel Certificates', required: true },
    { key: 'inspection', label: 'Property Inspection Report', required: true },
    { key: 'environmental', label: 'Phase I Environmental (ESA)', required: true },
    { key: 'title', label: 'Title Commitment / Report', required: true },
    { key: 'insurance', label: 'Insurance Certificate', required: true },
  ],
  Office: [
    { key: 'purchase_agreement', label: 'Purchase & Sale Agreement', required: true },
    { key: 'leases', label: 'Executed Leases', required: true },
    { key: 'financials', label: 'Financial Statements (2yr)', required: true },
    { key: 'inspection', label: 'Building Inspection Report', required: true },
    { key: 'environmental', label: 'Phase I Environmental', required: true },
    { key: 'title', label: 'Title Commitment', required: true },
    { key: 'insurance', label: 'Insurance Certificate', required: true },
  ],
  Retail: [
    { key: 'purchase_agreement', label: 'Purchase & Sale Agreement', required: true },
    { key: 'leases', label: 'Tenant Leases', required: true },
    { key: 'financials', label: 'Financial Statements', required: true },
    { key: 'inspection', label: 'Inspection Report', required: true },
    { key: 'environmental', label: 'Phase I Environmental', required: true },
    { key: 'title', label: 'Title Commitment', required: true },
    { key: 'insurance', label: 'Insurance Certificate', required: true },
  ],
  Industrial: [
    { key: 'purchase_agreement', label: 'Purchase & Sale Agreement', required: true },
    { key: 'leases', label: 'Lease Agreements', required: true },
    { key: 'financials', label: 'Financial Statements', required: true },
    { key: 'inspection', label: 'Inspection & Engineering Report', required: true },
    { key: 'environmental', label: 'Phase I/II Environmental', required: true },
    { key: 'title', label: 'Title Commitment', required: true },
    { key: 'insurance', label: 'Insurance Certificate', required: true },
  ],
  'Business Acquisition': [
    { key: 'financials', label: 'Audited Financial Statements (3yr)', required: true },
    { key: 'contracts', label: 'Key Customer Contracts', required: true },
    { key: 'ip', label: 'IP & Asset Documentation', required: true },
    { key: 'corporate', label: 'Corporate Documents & Cap Table', required: true },
    { key: 'employees', label: 'Key Employee Agreements', required: true },
    { key: 'legal', label: 'Legal/Litigation Summary', required: true },
  ],
};

const DEFAULT_TEMPLATE = [
  { key: 'purchase_agreement', label: 'Purchase Agreement', required: true },
  { key: 'financials', label: 'Financial Statements', required: true },
  { key: 'inspection', label: 'Inspection Report', required: false },
  { key: 'title', label: 'Title / Ownership Documents', required: true },
  { key: 'insurance', label: 'Insurance Certificate', required: false },
];

/**
 * Returns the document checklist template for a given property type.
 * Falls back to a generic template if the type is unrecognised.
 */
export function getTemplate(propertyType) {
  return TEMPLATES[propertyType] || DEFAULT_TEMPLATE;
}
