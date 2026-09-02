require('dotenv').config({ override: true });
const { supabase } = require('./db');

async function seed() {
  const now = Date.now();
  const daysAgo = d => new Date(now - d * 86400000).toISOString();

  // 1. Upsert the demo deal room
  const { error: roomErr } = await supabase.from('deal_rooms').upsert({
    property_id: 'kontra-demo',
    property_name: 'The Meridian Apartments',
    property_type: 'Multifamily',
    address: '4200 Lamar Blvd, Austin, TX 78756',
    deal_amount: 14000000,
    deal_type: 'Acquisition',
    deal_stage: 'under_review',
    status: 'active',
    customer_email: 'demo@kontraplatform.com',
    first_name: 'Demo',
    activated_at: daysAgo(12),
    created_at: daysAgo(14),
  }, { onConflict: 'property_id' });
  console.log('deal_rooms:', roomErr?.message || '✅');

  // 2. Clear and re-seed analyses
  await supabase.from('deal_analyses').delete().eq('property_id', 'kontra-demo');

  const analyses = [
    {
      section: 'financials',
      filename: 'meridian-t12-operating-statement.pdf',
      uploaded_by_role: 'owner',
      created_at: daysAgo(11),
      analysis: {
        documentType: "T-12 Operating Statement",
        noi: "$842,400", occupancy: "94.2%", dscr: "1.31x",
        revenue: "$1,891,200", expenses: "$1,048,800",
        revpar: null, adr: null, gopPar: null, revparIndex: null,
        roomsRevenue: null, fbRevenue: null,
        anomalies: [
          { item: "Utilities", description: "Utility expenses 18% above prior year — likely rate increases", severity: "Medium" },
          { item: "Maintenance Reserve", description: "Reserve underfunded vs. property age", severity: "Low" },
        ],
        trends: [
          "NOI grew 6.4% year-over-year",
          "Rent collections 98.7% — above market",
          "OpEx ratio stable at 55.5%",
        ],
        covenantStatus: "Compliant",
        summary: "Strong performing asset. NOI of $842,400 supports the $14M acquisition at a 6.02% cap rate. DSCR of 1.31x comfortably above typical lender minimum of 1.20x. Minor utility variance warrants monitoring.",
        recommendations: [
          "Negotiate utility reimbursement clause in new leases",
          "Budget $85,000 for deferred maintenance reserve",
          "Verify rent roll against actual lease agreements",
        ],
        confidence: 94,
        sources: [
          { page: "Page 2", quote: "Total Revenue: $1,891,200 for the trailing 12-month period" },
          { page: "Page 4", quote: "Net Operating Income: $842,400" },
          { page: "Page 6", quote: "Average Occupancy: 94.2% across all 120 units" },
        ],
      },
    },
    {
      section: 'inspection',
      filename: 'meridian-inspection-report-rodriguez.pdf',
      uploaded_by_role: 'inspector',
      created_at: daysAgo(10),
      analysis: {
        overallCondition: "Good",
        yearBuilt: 1998,
        roofCondition: "Fair — original roof, 3-5 years remaining",
        hvacCondition: "Good — units replaced 2019–2022",
        plumbingCondition: "Good",
        electricalCondition: "Good — panels updated 2018",
        foundationCondition: "Excellent",
        lifeSafetyFindings: [],
        deferredMaintenance: [
          { item: "Roof replacement", estimatedCost: "$380,000", priority: "High", timeframe: "3-5 years" },
          { item: "Exterior paint & siding", estimatedCost: "$95,000", priority: "Medium", timeframe: "1-2 years" },
          { item: "Pool deck resurfacing", estimatedCost: "$28,000", priority: "Low", timeframe: "2-3 years" },
        ],
        totalDeferredMaintenanceCost: "$503,000",
        summary: "Good overall condition for a 1998 vintage asset. No life-safety or structural deficiencies identified. Primary capital need is roof replacement within 3-5 years, estimated at $380,000. Recommend seller credit or price adjustment of $450,000–$503,000.",
        recommendations: [
          "Negotiate $450,000–$503,000 seller credit for deferred maintenance",
          "Commission roof core samples to refine timeline",
          "Obtain HVAC service history for pre-2019 units",
        ],
        confidence: 91,
        sources: [
          { page: "Section 3.1", quote: "Roof system: original 1998 installation, estimated 3-5 years remaining useful life" },
          { page: "Section 5.2", quote: "No life-safety deficiencies identified" },
          { page: "Section 7", quote: "Total estimated deferred maintenance: $503,000" },
        ],
      },
    },
    {
      section: 'insurance',
      filename: 'meridian-insurance-cert-allied.pdf',
      uploaded_by_role: 'insurer',
      created_at: daysAgo(9),
      analysis: {
        policyType: "Commercial Property & General Liability",
        carrier: "Allied Property & Casualty",
        coverageAmount: "$16,500,000",
        liabilityLimit: "$2,000,000",
        deductible: "$25,000",
        policyExpiration: "2027-03-15",
        coverageGaps: [
          { gap: "Flood coverage not included — Zone X (low risk area)", severity: "Low" },
        ],
        complianceStatus: "Compliant",
        summary: "Coverage is adequate for the $14M acquisition. Property insured at $16.5M replacement cost, exceeding purchase price. GL at $2M. No material coverage gaps. Lender will require loss payee endorsement and 30-day cancellation notice.",
        recommendations: [
          "Request loss payee endorsement naming lender",
          "Confirm 30-day cancellation notice provision",
          "Evaluate $5M umbrella for institutional-grade coverage",
        ],
        confidence: 96,
        sources: [
          { page: "Dec Page", quote: "Property Coverage Limit: $16,500,000 replacement cost value" },
          { page: "Dec Page", quote: "General Liability: $2,000,000 each occurrence" },
          { page: "Endorsements", quote: "Policy expiration: March 15, 2027" },
        ],
      },
    },
    {
      section: 'legal',
      filename: 'meridian-purchase-sale-agreement.pdf',
      uploaded_by_role: 'attorney',
      created_at: daysAgo(8),
      analysis: {
        documentType: "Purchase and Sale Agreement",
        parties: ["Meridian Holdings LLC (Seller)", "Apex Capital Partners (Buyer)"],
        keyDates: [
          { event: "Effective Date", date: "2026-06-01" },
          { event: "Due Diligence Period Ends", date: "2026-07-15" },
          { event: "Closing Date", date: "2026-08-20" },
        ],
        contingencies: [
          "Financing contingency — 21 days",
          "Inspection contingency — 14 days",
          "Title review contingency — 10 days",
        ],
        redFlags: [
          { issue: "Seller's litigation representation is broad — confirm no active tenant claims before July 15", severity: "Moderate" },
        ],
        covenants: [
          "Seller to maintain property through closing",
          "No new leases exceeding 13 months without buyer consent",
          "Buyer deposit: $280,000 (2%) — hard after due diligence",
        ],
        complianceStatus: "Review Required",
        summary: "PSA is standard form with buyer-favorable terms. Key risk is broad litigation representation — recommend title search and PACER check before due diligence expiration July 15. $280,000 deposit goes hard after that date.",
        recommendations: [
          "Run PACER search for pending federal litigation",
          "Order preliminary title report within 5 business days",
          "Confirm lender commitment letter before July 15 hard deposit date",
        ],
        confidence: 89,
        sources: [
          { page: "Section 4.2", quote: "Seller represents and warrants: no pending or threatened litigation..." },
          { page: "Section 6.1", quote: "Closing Date: August 20, 2026" },
          { page: "Section 3.1", quote: "Earnest Money Deposit: $280,000 — non-refundable upon expiration of Due Diligence Period" },
        ],
      },
    },
  ];

  for (const a of analyses) {
    const { error } = await supabase.from('deal_analyses').insert({ property_id: 'kontra-demo', ...a });
    console.log(`  ${a.section}:`, error?.message || '✅');
  }

  // 3. Party submissions
  await supabase.from('party_submissions').delete().eq('property_id', 'kontra-demo');
  const parties = [
    { role: 'lender',    name: 'First National Capital',      email: 'lender@demo.kontraplatform.com',    doc_count: 0, submitted_at: daysAgo(7) },
    { role: 'inspector', name: 'Rodriguez & Associates',      email: 'inspector@demo.kontraplatform.com', doc_count: 1, submitted_at: daysAgo(10) },
    { role: 'insurer',   name: 'Allied Property & Casualty',  email: 'insurer@demo.kontraplatform.com',   doc_count: 1, submitted_at: daysAgo(9) },
    { role: 'attorney',  name: 'Morrison & Foerster LLP',     email: 'attorney@demo.kontraplatform.com',  doc_count: 1, submitted_at: daysAgo(8) },
  ];
  for (const p of parties) {
    const { error } = await supabase.from('party_submissions').upsert(
      { property_id: 'kontra-demo', ...p },
      { onConflict: 'property_id,role' }
    );
    console.log(`  ${p.role}:`, error?.message || '✅');
  }

  // 4. Deal events (activity timeline)
  await supabase.from('deal_events').delete().eq('property_id', 'kontra-demo');
  const events = [
    { event_type: 'room_created',       actor_role: 'owner',    actor_name: 'Apex Capital',           description: 'Deal room created for The Meridian Apartments',   metadata: {},                        created_at: daysAgo(14) },
    { event_type: 'document_analyzed',  actor_role: 'owner',    actor_name: 'Apex Capital',           description: 'T-12 Financial Statement analyzed by AI',          metadata: { section: 'financials' }, created_at: daysAgo(11) },
    { event_type: 'document_analyzed',  actor_role: 'inspector',actor_name: 'Rodriguez & Associates', description: 'Inspection Report analyzed — Good condition',       metadata: { section: 'inspection' }, created_at: daysAgo(10) },
    { event_type: 'party_submitted',    actor_role: 'inspector',actor_name: 'Rodriguez & Associates', description: 'Inspector signaled ready',                          metadata: { role: 'inspector' },    created_at: daysAgo(10) },
    { event_type: 'document_analyzed',  actor_role: 'insurer',  actor_name: 'Allied P&C',             description: 'Insurance Certificate analyzed — Compliant',       metadata: { section: 'insurance' }, created_at: daysAgo(9) },
    { event_type: 'party_submitted',    actor_role: 'insurer',  actor_name: 'Allied P&C',             description: 'Insurer signaled ready',                           metadata: { role: 'insurer' },      created_at: daysAgo(9) },
    { event_type: 'document_analyzed',  actor_role: 'attorney', actor_name: 'Morrison & Foerster',    description: 'Purchase Agreement reviewed — action items noted', metadata: { section: 'legal' },     created_at: daysAgo(8) },
    { event_type: 'party_submitted',    actor_role: 'attorney', actor_name: 'Morrison & Foerster',    description: 'Attorney signaled ready',                          metadata: { role: 'attorney' },     created_at: daysAgo(8) },
    { event_type: 'party_submitted',    actor_role: 'lender',   actor_name: 'First National Capital', description: 'Lender completed underwriting review',             metadata: { role: 'lender' },       created_at: daysAgo(7) },
    { event_type: 'stage_advanced',     actor_role: 'owner',    actor_name: 'Apex Capital',           description: 'Deal advanced to Under Review',                    metadata: { stage: 'under_review' },created_at: daysAgo(6) },
  ];
  for (const e of events) {
    const { error } = await supabase.from('deal_events').insert({ property_id: 'kontra-demo', ...e });
    if (error) console.log(`  event ${e.event_type}:`, error.message);
  }
  console.log('Deal events: ✅');
  console.log('\n🎉 Demo seeded — visit /deal-room/kontra-demo');
}

seed().catch(console.error);
