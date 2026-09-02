-- =============================================================================
-- Phase 3: Canonical Regulatory Rule Seed
--
-- Seeds the kontra_rules table with the full set of regulatory rules
-- across all Phase 3 categories. All rules start as 'published'.
-- Run once after schema-phase3-policy.sql has been applied.
--
-- Categories: freddie_mac, fannie_mae, hazard_loss, watchlist, reserve,
--             maturity, token_transfer, lender_specific, compliance
-- =============================================================================

-- Helper: create a published rule with all Phase 3 fields
-- We use INSERT ... ON CONFLICT (rule_key) DO UPDATE to allow re-seeding.

-- ═══════════════════════════════════════════════════════════════
-- FREDDIE MAC RULES (category: freddie_mac)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO kontra_rules (
  rule_key, name, description, category, source_agency, source_reference,
  rule_operator, threshold_value, threshold_unit,
  severity, status, version, effective_date,
  conditions, condition_logic, actions,
  override_allowed, override_requires_role, escalation_path
) VALUES

('GSE-INSP-01',
 'Critical Structural Deficiency — 30-Day Cure',
 'Any critical structural deficiency identified during inspection triggers a mandatory 30-day cure notice to the borrower. All active construction draws are held until the deficiency is cured and a re-inspection confirms resolution.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §58.4',
 'flag', NULL, NULL,
 'critical', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"block","message":"Draw requests held pending cure","label":"Draw Hold"},{"type":"require_approval","approver_role":"lender_admin","message":"30-day cure notice requires lender admin sign-off"},{"type":"notify","recipients":"borrower,servicer","message":"Critical deficiency cure notice issued"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('GSE-INSP-02',
 'High-Severity Deficiency — 60-Day Cure',
 'High-severity deficiencies require a 60-day cure window with formal written notice to the borrower. A follow-up inspection must confirm cure within 30 days of the deadline.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §58.4',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"60-day cure notice required"},{"type":"notify","recipients":"borrower","message":"High-severity deficiency notice"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

('COV-DSCR-01',
 'DSCR Minimum Covenant — 1.25x',
 'The minimum Debt Service Coverage Ratio is 1.25x, tested quarterly. A breach triggers a 30-day formal cure period, investor notification per PSA requirements, and escalation to credit committee.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §27.3',
 '>=', 1.25, 'x (multiplier)',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.dscr","operator":"gte","value":"1.25"}]', 'AND',
 '[{"type":"require_approval","approver_role":"lender_admin","message":"DSCR covenant breach requires lender admin action"},{"type":"notify","recipients":"investor,servicer","message":"Material DSCR covenant breach detected"}]',
 TRUE, 'lender_admin', '["lender_admin"]'),

('COV-LTV-MAX',
 'LTV Maximum Covenant — 80%',
 'The maximum Loan-to-Value ratio is 80%, tested annually at the financial review. Values above 80% require an approved valuation plan or paydown to restore compliance.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §27.2',
 '<=', 80, 'percent',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.ltv","operator":"lte","value":"80"}]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"LTV covenant breach — valuations needed"}]',
 TRUE, 'lender_admin', '["servicer_review","lender_admin"]'),

('COV-OCC-MIN',
 'Occupancy Minimum Covenant — 85%',
 'Minimum physical occupancy is 85%, tested quarterly. Occupancy below 85% for two consecutive quarters triggers a formal cure notice and enhanced reporting.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §27.4',
 '>=', 85, 'percent',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.occupancy","operator":"gte","value":"85"}]', 'AND',
 '[{"type":"notify","recipients":"servicer","message":"Occupancy below 85% threshold — enhanced monitoring triggered"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

('FREDDIE-ANNUAL',
 'Annual Financial Review Deadline — 120 Days',
 'A complete annual financial review package must be received and reviewed within 120 days of the borrower''s fiscal year-end. Missing packages trigger escalation and borrower requests.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §30.2',
 '<=', 120, 'days',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"review.days_since_year_end","operator":"lte","value":"120"}]', 'AND',
 '[{"type":"notify","recipients":"borrower,servicer","message":"Annual financial review package required"}]',
 FALSE, NULL, '["servicer_review"]'),

('FREDDIE-INS-MIN',
 'Hazard Insurance Minimum Coverage',
 'Property hazard insurance must provide coverage at no less than full replacement cost value of all improvements. Shortfalls require borrower notification and cure within 30 days.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §58.2',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"Insurance verification required"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('PSA-INVESTOR-NOTIFY',
 'PSA Material Breach — Investor Notification',
 'Any material covenant breach requires formal written investor notification within 5 business days per Pooling and Servicing Agreement §8.4.',
 'freddie_mac', 'freddie_mac', 'Pooling and Servicing Agreement §8.4',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"notify","recipients":"investor","message":"Material breach investor notification required within 5 business days"}]',
 FALSE, NULL, '["lender_admin"]'),

('DRAW-HOLD-CRIT',
 'Draw Hold — Critical Deficiency Pending',
 'All construction draw disbursements are suspended when one or more critical deficiencies are open and unresolved. Disbursement resumes only after re-inspection confirms cure.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §58.4(c)',
 'flag', NULL, NULL,
 'critical', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"block","message":"Draw disbursement blocked until critical deficiency cured"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('FREDDIE-5.3.2',
 'Hazard Insurance — Structural Coverage',
 'Hazard insurance policy must specifically include coverage for structural damage. Policies that exclude structural damage must be replaced within 60 days.',
 'freddie_mac', 'freddie_mac', 'Freddie Mac Multifamily Guide §58.2(b)',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"Structural coverage verification required"}]',
 FALSE, NULL, '["servicer_review"]'),

-- ═══════════════════════════════════════════════════════════════
-- FANNIE MAE RULES (category: fannie_mae)
-- ═══════════════════════════════════════════════════════════════

('FNMA-DSCR-MIN',
 'Fannie Mae DSCR Minimum — 1.20x',
 'Fannie Mae DUS loans require a minimum DSCR of 1.20x, tested annually. A breach triggers immediate notification to Fannie Mae and may result in required loan buyout.',
 'fannie_mae', 'fannie_mae', 'Fannie Mae Multifamily Selling and Servicing Guide Part V, §501',
 '>=', 1.20, 'x (multiplier)',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.dscr","operator":"gte","value":"1.20"}]', 'AND',
 '[{"type":"require_approval","approver_role":"lender_admin","message":"Fannie Mae DSCR breach requires immediate Fannie Mae notification"},{"type":"notify","recipients":"fannie_mae,lender_admin","message":"DUS DSCR covenant breach"}]',
 FALSE, NULL, '["lender_admin","platform_admin"]'),

('FNMA-LTV-MAX',
 'Fannie Mae LTV Maximum — 80%',
 'Fannie Mae DUS loans require LTV at or below 80% at origination, maintained throughout the loan term. Annual valuations required for loans within 5% of limit.',
 'fannie_mae', 'fannie_mae', 'Fannie Mae Multifamily Selling and Servicing Guide Part V, §502',
 '<=', 80, 'percent',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.ltv","operator":"lte","value":"80"}]', 'AND',
 '[{"type":"notify","recipients":"lender_admin","message":"Fannie Mae LTV approaching or exceeding limit"}]',
 FALSE, NULL, '["lender_admin"]'),

('FNMA-DELINQUENCY-30',
 'Fannie Mae — 30-Day Delinquency Reporting',
 'Any loan 30+ days delinquent must be reported to Fannie Mae within 5 business days. Reporting failure constitutes a DUS breach.',
 'fannie_mae', 'fannie_mae', 'Fannie Mae Multifamily Seller/Servicer Guide §602',
 '>=', 30, 'days',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.days_delinquent","operator":"gte","value":"30"}]', 'AND',
 '[{"type":"notify","recipients":"fannie_mae,lender_admin","message":"30-day delinquency must be reported to Fannie Mae within 5 business days"},{"type":"require_approval","approver_role":"lender_admin","message":"Delinquency reporting confirmation required"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

-- ═══════════════════════════════════════════════════════════════
-- HAZARD LOSS RULES (category: hazard_loss)
-- ═══════════════════════════════════════════════════════════════

('HAZARD-HOLD-50PCT',
 'Insurance Proceeds Holdback — 50% Rule',
 'When insurance proceeds exceed $100,000, 50% of proceeds must be held in escrow until construction or repair is at least 50% complete and verified by inspection. Remaining 50% released upon satisfactory final inspection.',
 'hazard_loss', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §59.3(b)',
 '>', 100000, 'USD',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"proceeds.amount","operator":"gt","value":"100000"}]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"50% holdback escrow required for insurance proceeds >$100K"},{"type":"notify","recipients":"borrower,servicer","message":"Insurance proceeds holdback applied"}]',
 TRUE, 'lender_admin', '["servicer_review","lender_admin"]'),

('HAZARD-PSA-NOTIFY',
 'Hazard Loss — PSA Investor Notification',
 'Insurance losses exceeding $50,000 require formal investor notification per the Pooling and Servicing Agreement within 5 business days of adjuster settlement.',
 'hazard_loss', 'freddie_mac', 'Pooling and Servicing Agreement §9.2',
 '>', 50000, 'USD',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loss.amount","operator":"gt","value":"50000"}]', 'AND',
 '[{"type":"notify","recipients":"investor","message":"Material hazard loss — investor PSA notification required within 5 business days"}]',
 FALSE, NULL, '["lender_admin"]'),

('HAZARD-INSPECT-REQ',
 'Post-Repair Inspection Required for Disbursement',
 'Final or progress disbursement of insurance proceeds requires a satisfactory property inspection confirming repair completion to the specified standard. No disbursement without inspection sign-off.',
 'hazard_loss', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §59.4',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"block","message":"Disbursement blocked until post-repair inspection signed off"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('HAZARD-CONTRACTOR-BID',
 'Contractor Bid Variance Limit — 10%',
 'Contractor bids must be within 10% of the insurance adjuster estimate. Bids exceeding 10% variance require independent review and lender approval before proceeding.',
 'hazard_loss', 'lender', 'Lender Hazard Loss Policy §4.2',
 '<=', 10, 'percent',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"bid.variance_pct","operator":"lte","value":"10"}]', 'AND',
 '[{"type":"require_approval","approver_role":"lender_admin","message":"Contractor bid variance exceeds 10% — independent review required"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

-- ═══════════════════════════════════════════════════════════════
-- WATCHLIST RULES (category: watchlist)
-- ═══════════════════════════════════════════════════════════════

('WATCH-DQ90',
 'Watchlist Placement — 90-Day Delinquency',
 'Any loan 90 or more days delinquent must be placed on the Special Assets/Watchlist immediately. Risk classification defaults to Substandard pending credit committee review.',
 'watchlist', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §74.2',
 '>=', 90, 'days',
 'critical', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.days_delinquent","operator":"gte","value":"90"}]', 'AND',
 '[{"type":"block","message":"Loan placed on watchlist — enhanced monitoring required"},{"type":"notify","recipients":"lender_admin,servicer","message":"90-day delinquency: mandatory watchlist placement"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('WATCH-DSCR-SUB',
 'Watchlist — DSCR Below Breakeven (< 1.00x)',
 'A DSCR below 1.00x indicates the property cannot cover its debt service from operations. Immediate Substandard classification, enhanced bi-weekly monitoring, and borrower engagement required.',
 'watchlist', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §74.3',
 '<', 1.00, 'x (multiplier)',
 'critical', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.dscr","operator":"lt","value":"1.00"}]', 'AND',
 '[{"type":"require_approval","approver_role":"lender_admin","message":"Substandard classification requires lender admin review"},{"type":"notify","recipients":"lender_admin","message":"DSCR below 1.00x — substandard risk classification triggered"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('WATCH-RESERVE-DEP',
 'Watchlist — Reserve Account Depletion',
 'Complete depletion of the capital reserve account triggers enhanced monitoring and a borrower request for reserve replenishment within 60 days.',
 'watchlist', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §74.4',
 '<=', 0, 'USD',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"reserve.balance","operator":"lte","value":"0"}]', 'AND',
 '[{"type":"notify","recipients":"servicer,lender_admin","message":"Reserve account depleted — enhanced monitoring and replenishment request required"}]',
 FALSE, NULL, '["servicer_review"]'),

('WATCH-DQ30-TREND',
 'Watchlist Watch — 30-Day Delinquency Trend',
 'Two or more 30-day delinquencies in a 12-month rolling window triggers Watch classification and enhanced monthly monitoring.',
 'watchlist', 'lender', 'Lender Watchlist Policy §3.1',
 '>=', 2, 'count',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.dq30_count_12m","operator":"gte","value":"2"}]', 'AND',
 '[{"type":"notify","recipients":"servicer","message":"Delinquency trend detected — Watch classification initiated"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

-- ═══════════════════════════════════════════════════════════════
-- RESERVE RULES (category: reserve)
-- ═══════════════════════════════════════════════════════════════

('RESERVE-TIER1-MIN',
 'Tier 1 Loan — Minimum Reserve Balance (3 Months PITI)',
 'Tier 1 performing loans must maintain a minimum reserve balance equal to 3 months of Principal, Interest, Taxes, and Insurance (PITI). Shortfall triggers a cure notice.',
 'reserve', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §31.2',
 '>=', 3, 'months_PITI',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"reserve.months_piti_covered","operator":"gte","value":"3"}]', 'AND',
 '[{"type":"notify","recipients":"borrower,servicer","message":"Reserve balance below 3-month PITI minimum — cure notice issued"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

('RESERVE-REPLENISH-90',
 'Reserve Draw Replenishment — 90-Day Window',
 'Draws from the capital reserve account must be replenished within 90 days. Failure triggers a formal cure notice and enhanced monitoring.',
 'reserve', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §31.4',
 '<=', 90, 'days',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"reserve.days_since_draw","operator":"lte","value":"90"}]', 'AND',
 '[{"type":"notify","recipients":"borrower","message":"Reserve replenishment due within 90 days"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

('RESERVE-CAPEX-APPROVAL',
 'Reserve Disbursement — CapEx Approval Required',
 'Any single capital reserve disbursement exceeding $25,000 requires servicer approval and supporting contractor documentation before release.',
 'reserve', 'lender', 'Lender Reserve Policy §5.3',
 '>', 25000, 'USD',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"disbursement.amount","operator":"gt","value":"25000"}]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"CapEx reserve disbursement >$25K requires servicer approval and contractor docs"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

-- ═══════════════════════════════════════════════════════════════
-- MATURITY EXTENSION RULES (category: maturity)
-- ═══════════════════════════════════════════════════════════════

('MAT-T90-NOTICE',
 'Maturity Notice — 90 Days Prior',
 'Formal written maturity notice must be delivered to the borrower no later than 90 days before the loan maturity date. Failure to send triggers regulatory non-compliance.',
 'maturity', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §65.3',
 '<=', 90, 'days',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.days_to_maturity","operator":"lte","value":"90"}]', 'AND',
 '[{"type":"notify","recipients":"borrower,servicer","message":"Maturity notice must be issued — 90 days to maturity reached"},{"type":"require_approval","approver_role":"servicer","message":"Maturity notice requires servicer confirmation"}]',
 FALSE, NULL, '["servicer_review"]'),

('MAT-EXT-PERFORMING',
 'Maturity Extension Eligibility — Performing DSCR',
 'A maturity extension may only be granted if the loan DSCR is at or above 1.10x at the time of the extension request. Underperforming loans require credit committee approval.',
 'maturity', 'lender', 'Lender Maturity Extension Policy §2.1',
 '>=', 1.10, 'x (multiplier)',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.dscr","operator":"gte","value":"1.10"}]', 'AND',
 '[{"type":"require_approval","approver_role":"lender_admin","message":"Maturity extension on sub-1.10x DSCR loan requires credit committee approval"}]',
 TRUE, 'lender_admin', '["lender_admin","platform_admin"]'),

('MAT-EXT-MAX-TERM',
 'Maturity Extension Maximum Duration — 24 Months',
 'The maximum allowable maturity extension is 24 months beyond the original maturity date. Extensions beyond 24 months require platform_admin approval and may require refinancing.',
 'maturity', 'lender', 'Lender Maturity Extension Policy §2.3',
 '<=', 24, 'months',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"extension.months","operator":"lte","value":"24"}]', 'AND',
 '[{"type":"require_approval","approver_role":"platform_admin","message":"Extension beyond 24 months requires platform admin approval"}]',
 FALSE, NULL, '["lender_admin","platform_admin"]'),

('MAT-EXT-CURRENT',
 'Maturity Extension — Loan Must Be Current',
 'A maturity extension request will only be considered for loans that are current (0 days delinquent) at the time of the request.',
 'maturity', 'lender', 'Lender Maturity Extension Policy §2.2',
 '<=', 0, 'days delinquent',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.days_delinquent","operator":"lte","value":"0"}]', 'AND',
 '[{"type":"block","message":"Maturity extension not available for delinquent loans"}]',
 TRUE, 'lender_admin', '["lender_admin"]'),

-- ═══════════════════════════════════════════════════════════════
-- TOKEN TRANSFER ELIGIBILITY (category: token_transfer)
-- ═══════════════════════════════════════════════════════════════

('TOKEN-DSCR-MIN',
 'Token Eligibility — DSCR Minimum 1.20x',
 'Loans must maintain a DSCR of at least 1.20x to remain eligible for token inclusion. Loans falling below this threshold are suspended from the token pool pending remediation.',
 'token_transfer', 'platform', 'Kontra Token Eligibility Standard v1.0 §3.1',
 '>=', 1.20, 'x (multiplier)',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.dscr","operator":"gte","value":"1.20"}]', 'AND',
 '[{"type":"block","message":"Token inclusion suspended: DSCR below 1.20x minimum"},{"type":"notify","recipients":"investor","message":"Loan removed from token pool — DSCR covenant breach"}]',
 FALSE, NULL, '["lender_admin"]'),

('TOKEN-LTV-MAX',
 'Token Eligibility — LTV Maximum 75%',
 'Tokenized loan positions are limited to loans with LTV at or below 75% to ensure adequate collateral coverage for token holders.',
 'token_transfer', 'platform', 'Kontra Token Eligibility Standard v1.0 §3.2',
 '<=', 75, 'percent',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.ltv","operator":"lte","value":"75"}]', 'AND',
 '[{"type":"block","message":"Token inclusion suspended: LTV exceeds 75% maximum"},{"type":"notify","recipients":"investor","message":"LTV exceeds token eligibility limit"}]',
 FALSE, NULL, '["lender_admin"]'),

('TOKEN-CURRENT',
 'Token Eligibility — Loan Must Be Current',
 'Only loans that are current (0-29 days) may be included in token pools. Delinquent loans are immediately suspended from the pool.',
 'token_transfer', 'platform', 'Kontra Token Eligibility Standard v1.0 §3.3',
 '<=', 29, 'days delinquent',
 'critical', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.days_delinquent","operator":"lte","value":"29"}]', 'AND',
 '[{"type":"block","message":"Token inclusion suspended: loan is delinquent"},{"type":"notify","recipients":"investor","message":"Delinquent loan removed from token pool"}]',
 FALSE, NULL, '["lender_admin","platform_admin"]'),

('TOKEN-AUDIT',
 'Token Eligibility — Annual Appraisal Required',
 'All loans in a token pool must have an appraisal completed within the past 12 months. Loans with stale appraisals must obtain a new one within 60 days or be suspended from the pool.',
 'token_transfer', 'platform', 'Kontra Token Eligibility Standard v1.0 §3.4',
 '<=', 365, 'days since appraisal',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"property.days_since_appraisal","operator":"lte","value":"365"}]', 'AND',
 '[{"type":"notify","recipients":"lender_admin","message":"Annual appraisal required — 60-day grace period for renewal"},{"type":"warn","message":"Token pool position at risk: appraisal stale"}]',
 FALSE, NULL, '["lender_admin"]'),

('TOKEN-TRANSFER-LOCK',
 'Token Transfer Lock-Up — 90 Days Post-Origination',
 'Token positions associated with newly originated loans are locked from secondary market transfer for 90 days from the loan origination date.',
 'token_transfer', 'platform', 'Kontra Token Transfer Policy §2.1',
 '>', 90, 'days from origination',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"loan.days_from_origination","operator":"gt","value":"90"}]', 'AND',
 '[{"type":"block","message":"Token transfer locked: 90-day post-origination lock-up period active"}]',
 FALSE, NULL, '["platform_admin"]'),

-- ═══════════════════════════════════════════════════════════════
-- CFPB / COMPLIANCE RULES (category: compliance)
-- ═══════════════════════════════════════════════════════════════

('CFPB-LOSS-MIT-REQ',
 'CFPB — Loss Mitigation Procedures Required',
 'Loss mitigation procedures must be documented, up-to-date, and available to borrowers upon request. Servicers must acknowledge and evaluate all complete loss mitigation applications within 5 days.',
 'compliance', 'cfpb', '12 CFR §1024.41 — Loss Mitigation Procedures',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"require_approval","approver_role":"servicer","message":"Loss mitigation documentation must be verified current and compliant"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

('COV-CURE-30',
 'Covenant Breach — 30-Day Formal Cure Period',
 'Any material covenant breach triggers a mandatory 30-day formal cure period with written notice to the borrower. Extensions require lender admin approval.',
 'compliance', 'freddie_mac', 'Freddie Mac Multifamily Seller/Servicer Guide §27.7',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"notify","recipients":"borrower","message":"30-day formal cure period initiated for covenant breach"},{"type":"require_approval","approver_role":"servicer","message":"Cure notice requires servicer confirmation"}]',
 FALSE, NULL, '["servicer_review","lender_admin"]'),

-- ═══════════════════════════════════════════════════════════════
-- LENDER-SPECIFIC RULES (category: lender_specific)
-- ═══════════════════════════════════════════════════════════════

('LENDER-DRAW-MAX',
 'Maximum Single Draw Disbursement — $500,000',
 'No single construction draw disbursement may exceed $500,000 without dual lender admin approval (maker-checker). Draws above this threshold are automatically escalated.',
 'lender_specific', 'lender', 'Lender Construction Draw Policy §3.1',
 '<=', 500000, 'USD',
 'high', 'published', 1, CURRENT_DATE,
 '[{"field":"draw.amount","operator":"lte","value":"500000"}]', 'AND',
 '[{"type":"require_approval","approver_role":"lender_admin","message":"Draw exceeds $500K single-disbursement limit — dual approval required"}]',
 TRUE, 'platform_admin', '["lender_admin","platform_admin"]'),

('LENDER-RISK-REVIEW-Q',
 'Quarterly Risk Review — All Watchlist Loans',
 'All loans classified as Watch, Substandard, Doubtful, or Loss must undergo a formal credit committee risk review at minimum quarterly.',
 'lender_specific', 'lender', 'Lender Risk Management Policy §7.2',
 '<=', 90, 'days since last review',
 'medium', 'published', 1, CURRENT_DATE,
 '[{"field":"watchlist.days_since_review","operator":"lte","value":"90"}]', 'AND',
 '[{"type":"notify","recipients":"lender_admin","message":"Quarterly watchlist risk review overdue — schedule credit committee review"}]',
 TRUE, 'lender_admin', '["servicer_review"]'),

('LENDER-SPONSOR-CROSS',
 'Cross-Default — Sponsor Portfolio Review',
 'When any loan in a sponsor portfolio is classified Substandard or worse, all other loans from the same sponsor undergo an immediate credit review.',
 'lender_specific', 'lender', 'Lender Cross-Default Policy §2.4',
 'flag', NULL, NULL,
 'high', 'published', 1, CURRENT_DATE,
 '[]', 'AND',
 '[{"type":"notify","recipients":"lender_admin","message":"Cross-default triggered: all sponsor portfolio loans require immediate review"}]',
 FALSE, NULL, '["lender_admin"]')

ON CONFLICT DO NOTHING;

-- Done. Run SELECT COUNT(*) FROM kontra_rules to verify seeding.
