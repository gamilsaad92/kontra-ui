/**
 * Tokenization Compliance Gate
 *
 * The single most important screen in Kontra for a pitch or regulator:
 * A loan or pool CANNOT issue or trade tokens unless ALL 12 compliance
 * criteria are green. This gate enforces the rule before issuance AND
 * monitors ongoing compliance to suspend token trading if a loan falls
 * out of compliance after issuance.
 *
 * Architecture: Servicing → Compliance Gate → Tokenization
 */

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  CubeIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

// ── Types ──────────────────────────────────────────────────────────────────────
type CriterionStatus = 'pass' | 'watch' | 'fail';
type TokenStatus = 'active' | 'suspended' | 'pending' | 'not-issued';

interface Criterion {
  id: string;
  name: string;
  description: string;
  group: string;
  status: CriterionStatus;
  detail: string;
  regulation?: string;
}

interface LoanGateRecord {
  loanId: string;
  title: string;
  propertyType: string;
  borrower: string;
  upb: number;
  tokenSymbol: string | null;
  tokenStatus: TokenStatus;
  criteria: Criterion[];
}

// ── Demo data: 12 criteria evaluated per loan ─────────────────────────────────
const LOANS: LoanGateRecord[] = [
  {
    loanId: 'LN-0728',
    title: 'Pacific Vista Industrial',
    propertyType: 'Industrial',
    borrower: 'PV Logistics Holdings LLC',
    upb: 6_487_500,
    tokenSymbol: 'KTRA-0728',
    tokenStatus: 'active',
    criteria: [
      { id: 'taxes',        group: 'Property & Collateral', name: 'Property Taxes Current',          description: 'No delinquent tax liens; taxes paid through current period.',          status: 'pass', detail: 'Paid through Q1 2026 — verified Apr 1, 2026',                    regulation: 'Freddie Mac Servicing Guide §73' },
      { id: 'insurance',    group: 'Property & Collateral', name: 'Insurance Active & Current',      description: 'All-risk property + liability policies active; expiry > 30 days.',     status: 'pass', detail: 'Commercial property policy expires Mar 15, 2027',               regulation: 'Fannie Mae Servicing Guide B-1-01' },
      { id: 'rentroll',     group: 'Property & Collateral', name: 'Rent Roll Verified (< 90 days)', description: 'Certified rent roll received and reviewed within 90 days.',           status: 'pass', detail: 'Certified Mar 5, 2026 — 100% NNN occupied',                    regulation: 'SEC Reg A+ Disclosure' },
      { id: 'reserves',     group: 'Property & Collateral', name: 'Reserves ≥ Minimum',             description: 'Escrow/reserve balance meets or exceeds required minimum.',           status: 'pass', detail: '$324,375 on deposit / $200,000 minimum required',               regulation: 'Loan Agreement §8.3' },
      { id: 'dscr',         group: 'Servicing Compliance',  name: 'DSCR ≥ Covenant Floor',          description: 'Debt service coverage ratio meets covenant threshold.',               status: 'pass', detail: '2.10x — floor 1.30x — tested Q1 2026',                        regulation: 'Loan Agreement §6.1(a)' },
      { id: 'ltv',          group: 'Servicing Compliance',  name: 'LTV ≤ Covenant Cap',             description: 'Loan-to-value ratio does not exceed covenant cap.',                  status: 'pass', detail: '55.0% — cap 65.0% — 2025 FIRREA appraisal',                  regulation: 'Loan Agreement §6.1(b)' },
      { id: 'occupancy',    group: 'Servicing Compliance',  name: 'Occupancy ≥ Floor',              description: 'Physical occupancy meets covenant minimum.',                          status: 'pass', detail: '100% occupied — floor 85% — certified Mar 5, 2026',           regulation: 'Loan Agreement §6.1(c)' },
      { id: 'repairs',      group: 'Servicing Compliance',  name: 'No Open Critical Repairs',       description: 'No outstanding critical repair findings from inspections.',            status: 'pass', detail: 'Last inspection Jan 2026 — zero critical findings',            regulation: 'Freddie Mac Inspection §83' },
      { id: 'default',      group: 'Default & Legal',       name: 'No Active Default / ROR',        description: 'Loan is not in default, cure period, or right-of-redemption.',        status: 'pass', detail: 'Current — no default events recorded',                         regulation: 'UCC §9-601' },
      { id: 'legal',        group: 'Default & Legal',       name: 'Legal Documentation Complete',   description: 'Note, mortgage/DOT, title policy, survey on file and current.',       status: 'pass', detail: 'All origination docs on file — title policy Feb 2024',         regulation: 'ALTA Title Standards' },
      { id: 'disclosures',  group: 'Investor Layer',        name: 'Investor Disclosures Filed',     description: 'PPM, subscription agreement, Form D filed; offering docs current.',   status: 'pass', detail: 'Form D filed Feb 2024 — PPM v2.1 current',                    regulation: 'SEC Reg D Rule 506(c)' },
      { id: 'kyc',          group: 'Investor Layer',        name: 'KYC/AML & Accreditation',        description: 'All token holders KYC/AML verified; accreditation status current.',   status: 'pass', detail: '12 investors — all verified via Persona — accreditation current', regulation: 'FinCEN 31 CFR §1010.230' },
    ],
  },
  {
    loanId: 'LN-3201',
    title: 'Rosewood Medical Plaza',
    propertyType: 'Office / Medical',
    borrower: 'Rosewood Health Properties Inc.',
    upb: 8_450_000,
    tokenSymbol: 'KTRA-3201',
    tokenStatus: 'active',
    criteria: [
      { id: 'taxes',       group: 'Property & Collateral', name: 'Property Taxes Current',          description: 'No delinquent tax liens; taxes paid through current period.',          status: 'pass', detail: 'Paid through Q1 2026 — Maricopa County',                       regulation: 'Freddie Mac Servicing Guide §73' },
      { id: 'insurance',   group: 'Property & Collateral', name: 'Insurance Active & Current',      description: 'All-risk property + liability policies active; expiry > 30 days.',     status: 'pass', detail: 'Commercial policy expires Nov 30, 2026',                       regulation: 'Fannie Mae Servicing Guide B-1-01' },
      { id: 'rentroll',    group: 'Property & Collateral', name: 'Rent Roll Verified (< 90 days)', description: 'Certified rent roll received and reviewed within 90 days.',           status: 'pass', detail: 'Certified Feb 28, 2026 — 97% leased',                         regulation: 'SEC Reg A+ Disclosure' },
      { id: 'reserves',    group: 'Property & Collateral', name: 'Reserves ≥ Minimum',             description: 'Escrow/reserve balance meets or exceeds required minimum.',           status: 'pass', detail: '$422,500 on deposit / $300,000 minimum required',              regulation: 'Loan Agreement §8.3' },
      { id: 'dscr',        group: 'Servicing Compliance',  name: 'DSCR ≥ Covenant Floor',          description: 'Debt service coverage ratio meets covenant threshold.',               status: 'pass', detail: '1.85x — floor 1.35x — tested Q1 2026',                        regulation: 'Loan Agreement §6.1(a)' },
      { id: 'ltv',         group: 'Servicing Compliance',  name: 'LTV ≤ Covenant Cap',             description: 'Loan-to-value ratio does not exceed covenant cap.',                  status: 'pass', detail: '57.9% — cap 70.0% — 2024 FIRREA appraisal',                  regulation: 'Loan Agreement §6.1(b)' },
      { id: 'occupancy',   group: 'Servicing Compliance',  name: 'Occupancy ≥ Floor',              description: 'Physical occupancy meets covenant minimum.',                          status: 'pass', detail: '97% occupied — floor 90% — certified Feb 28, 2026',           regulation: 'Loan Agreement §6.1(c)' },
      { id: 'repairs',     group: 'Servicing Compliance',  name: 'No Open Critical Repairs',       description: 'No outstanding critical repair findings from inspections.',            status: 'pass', detail: 'Last inspection Dec 2025 — zero critical findings',            regulation: 'Freddie Mac Inspection §83' },
      { id: 'default',     group: 'Default & Legal',       name: 'No Active Default / ROR',        description: 'Loan is not in default, cure period, or right-of-redemption.',        status: 'pass', detail: 'Current — no default events recorded',                         regulation: 'UCC §9-601' },
      { id: 'legal',       group: 'Default & Legal',       name: 'Legal Documentation Complete',   description: 'Note, mortgage/DOT, title policy, survey on file and current.',       status: 'pass', detail: 'All origination docs on file — title policy Dec 2023',         regulation: 'ALTA Title Standards' },
      { id: 'disclosures', group: 'Investor Layer',        name: 'Investor Disclosures Filed',     description: 'PPM, subscription agreement, Form D filed; offering docs current.',   status: 'pass', detail: 'Form D filed Jan 2024 — PPM v1.4 current',                    regulation: 'SEC Reg D Rule 506(c)' },
      { id: 'kyc',         group: 'Investor Layer',        name: 'KYC/AML & Accreditation',        description: 'All token holders KYC/AML verified; accreditation status current.',   status: 'pass', detail: '8 investors — all verified via Persona — accreditation current',  regulation: 'FinCEN 31 CFR §1010.230' },
    ],
  },
  {
    loanId: 'LN-2847',
    title: 'The Meridian Apartments',
    propertyType: 'Multifamily',
    borrower: 'Meridian Residential LLC',
    upb: 5_112_500,
    tokenSymbol: 'KTRA-2847',
    tokenStatus: 'active',
    criteria: [
      { id: 'taxes',       group: 'Property & Collateral', name: 'Property Taxes Current',          description: 'No delinquent tax liens; taxes paid through current period.',          status: 'pass',  detail: 'Paid through Q1 2026 — Denver County',                        regulation: 'Freddie Mac Servicing Guide §73' },
      { id: 'insurance',   group: 'Property & Collateral', name: 'Insurance Active & Current',      description: 'All-risk property + liability policies active; expiry > 30 days.',     status: 'watch', detail: 'Policy expires Jul 15, 2026 — renewal underway (48 days)',    regulation: 'Fannie Mae Servicing Guide B-1-01' },
      { id: 'rentroll',    group: 'Property & Collateral', name: 'Rent Roll Verified (< 90 days)', description: 'Certified rent roll received and reviewed within 90 days.',           status: 'pass',  detail: 'Certified Mar 15, 2026 — 94% occupied',                       regulation: 'SEC Reg A+ Disclosure' },
      { id: 'reserves',    group: 'Property & Collateral', name: 'Reserves ≥ Minimum',             description: 'Escrow/reserve balance meets or exceeds required minimum.',           status: 'pass',  detail: '$128,125 on deposit / $100,000 minimum required',              regulation: 'Loan Agreement §8.3' },
      { id: 'dscr',        group: 'Servicing Compliance',  name: 'DSCR ≥ Covenant Floor',          description: 'Debt service coverage ratio meets covenant threshold.',               status: 'pass',  detail: '1.42x — floor 1.25x — tested Q1 2026',                        regulation: 'Loan Agreement §6.1(a)' },
      { id: 'ltv',         group: 'Servicing Compliance',  name: 'LTV ≤ Covenant Cap',             description: 'Loan-to-value ratio does not exceed covenant cap.',                  status: 'pass',  detail: '65.2% — cap 75.0% — 2024 FIRREA appraisal',                  regulation: 'Loan Agreement §6.1(b)' },
      { id: 'occupancy',   group: 'Servicing Compliance',  name: 'Occupancy ≥ Floor',              description: 'Physical occupancy meets covenant minimum.',                          status: 'pass',  detail: '94% occupied — floor 85% — certified Mar 15, 2026',           regulation: 'Loan Agreement §6.1(c)' },
      { id: 'repairs',     group: 'Servicing Compliance',  name: 'No Open Critical Repairs',       description: 'No outstanding critical repair findings from inspections.',            status: 'pass',  detail: 'Last inspection Feb 2026 — zero critical findings',            regulation: 'Freddie Mac Inspection §83' },
      { id: 'default',     group: 'Default & Legal',       name: 'No Active Default / ROR',        description: 'Loan is not in default, cure period, or right-of-redemption.',        status: 'pass',  detail: 'Current — no default events recorded',                         regulation: 'UCC §9-601' },
      { id: 'legal',       group: 'Default & Legal',       name: 'Legal Documentation Complete',   description: 'Note, mortgage/DOT, title policy, survey on file and current.',       status: 'pass',  detail: 'All origination docs on file — maturity Jun 2026 — extension in review', regulation: 'ALTA Title Standards' },
      { id: 'disclosures', group: 'Investor Layer',        name: 'Investor Disclosures Filed',     description: 'PPM, subscription agreement, Form D filed; offering docs current.',   status: 'pass',  detail: 'Form D filed Jun 2024 — PPM v1.0 current',                    regulation: 'SEC Reg D Rule 506(c)' },
      { id: 'kyc',         group: 'Investor Layer',        name: 'KYC/AML & Accreditation',        description: 'All token holders KYC/AML verified; accreditation status current.',   status: 'pass',  detail: '6 investors — all verified via Persona — accreditation current',   regulation: 'FinCEN 31 CFR §1010.230' },
    ],
  },
  {
    loanId: 'LN-4108',
    title: 'Grand Central Offices',
    propertyType: 'Office',
    borrower: 'GCO Property Partners LP',
    upb: 3_762_500,
    tokenSymbol: 'KTRA-4108',
    tokenStatus: 'suspended',
    criteria: [
      { id: 'taxes',       group: 'Property & Collateral', name: 'Property Taxes Current',          description: 'No delinquent tax liens; taxes paid through current period.',          status: 'pass',  detail: 'Paid through Q1 2026 — Cook County',                           regulation: 'Freddie Mac Servicing Guide §73' },
      { id: 'insurance',   group: 'Property & Collateral', name: 'Insurance Active & Current',      description: 'All-risk property + liability policies active; expiry > 30 days.',     status: 'pass',  detail: 'Commercial policy expires Oct 10, 2026',                        regulation: 'Fannie Mae Servicing Guide B-1-01' },
      { id: 'rentroll',    group: 'Property & Collateral', name: 'Rent Roll Verified (< 90 days)', description: 'Certified rent roll received and reviewed within 90 days.',           status: 'pass',  detail: 'Certified Feb 10, 2026 — 81% occupied',                        regulation: 'SEC Reg A+ Disclosure' },
      { id: 'reserves',    group: 'Property & Collateral', name: 'Reserves ≥ Minimum',             description: 'Escrow/reserve balance meets or exceeds required minimum.',           status: 'pass',  detail: '$94,063 on deposit / $90,000 minimum required',                 regulation: 'Loan Agreement §8.3' },
      { id: 'dscr',        group: 'Servicing Compliance',  name: 'DSCR ≥ Covenant Floor',          description: 'Debt service coverage ratio meets covenant threshold.',               status: 'fail',  detail: '1.08x — floor 1.25x — BREACH — governance action required',    regulation: 'Loan Agreement §6.1(a)' },
      { id: 'ltv',         group: 'Servicing Compliance',  name: 'LTV ≤ Covenant Cap',             description: 'Loan-to-value ratio does not exceed covenant cap.',                  status: 'watch', detail: '74.2% — cap 75.0% — near cap — re-appraisal scheduled',        regulation: 'Loan Agreement §6.1(b)' },
      { id: 'occupancy',   group: 'Servicing Compliance',  name: 'Occupancy ≥ Floor',              description: 'Physical occupancy meets covenant minimum.',                          status: 'watch', detail: '81% occupied — floor 85% — 4% below floor',                    regulation: 'Loan Agreement §6.1(c)' },
      { id: 'repairs',     group: 'Servicing Compliance',  name: 'No Open Critical Repairs',       description: 'No outstanding critical repair findings from inspections.',            status: 'pass',  detail: 'Last inspection Mar 2026 — zero critical findings',             regulation: 'Freddie Mac Inspection §83' },
      { id: 'default',     group: 'Default & Legal',       name: 'No Active Default / ROR',        description: 'Loan is not in default, cure period, or right-of-redemption.',        status: 'fail',  detail: 'Cure period active — DSCR breach notified Apr 3, 2026 — 27d remaining', regulation: 'UCC §9-601' },
      { id: 'legal',       group: 'Default & Legal',       name: 'Legal Documentation Complete',   description: 'Note, mortgage/DOT, title policy, survey on file and current.',       status: 'pass',  detail: 'All origination docs on file — title policy Jan 2024',          regulation: 'ALTA Title Standards' },
      { id: 'disclosures', group: 'Investor Layer',        name: 'Investor Disclosures Filed',     description: 'PPM, subscription agreement, Form D filed; offering docs current.',   status: 'pass',  detail: 'Form D filed Jan 2024 — risk update letter issued Apr 5, 2026', regulation: 'SEC Reg D Rule 506(c)' },
      { id: 'kyc',         group: 'Investor Layer',        name: 'KYC/AML & Accreditation',        description: 'All token holders KYC/AML verified; accreditation status current.',   status: 'pass',  detail: '4 investors — all verified — accreditation current',             regulation: 'FinCEN 31 CFR §1010.230' },
    ],
  },
  {
    loanId: 'LN-5593',
    title: 'Harbour Square Retail',
    propertyType: 'Retail',
    borrower: 'Harbour Square Partners LLC',
    upb: 4_187_500,
    tokenSymbol: 'KTRA-5593',
    tokenStatus: 'suspended',
    criteria: [
      { id: 'taxes',       group: 'Property & Collateral', name: 'Property Taxes Current',          description: 'No delinquent tax liens; taxes paid through current period.',          status: 'pass',  detail: 'Paid through Q1 2026 — King County, WA',                       regulation: 'Freddie Mac Servicing Guide §73' },
      { id: 'insurance',   group: 'Property & Collateral', name: 'Insurance Active & Current',      description: 'All-risk property + liability policies active; expiry > 30 days.',     status: 'pass',  detail: 'Commercial policy expires Aug 1, 2026',                         regulation: 'Fannie Mae Servicing Guide B-1-01' },
      { id: 'rentroll',    group: 'Property & Collateral', name: 'Rent Roll Verified (< 90 days)', description: 'Certified rent roll received and reviewed within 90 days.',           status: 'pass',  detail: 'Certified Mar 1, 2026 — 79% occupied',                         regulation: 'SEC Reg A+ Disclosure' },
      { id: 'reserves',    group: 'Property & Collateral', name: 'Reserves ≥ Minimum',             description: 'Escrow/reserve balance meets or exceeds required minimum.',           status: 'watch', detail: '$78,500 on deposit / $90,000 minimum — reserve replenishment required', regulation: 'Loan Agreement §8.3' },
      { id: 'dscr',        group: 'Servicing Compliance',  name: 'DSCR ≥ Covenant Floor',          description: 'Debt service coverage ratio meets covenant threshold.',               status: 'watch', detail: '1.08x — floor 1.20x — below floor — cure period in effect',   regulation: 'Loan Agreement §6.1(a)' },
      { id: 'ltv',         group: 'Servicing Compliance',  name: 'LTV ≤ Covenant Cap',             description: 'Loan-to-value ratio does not exceed covenant cap.',                  status: 'fail',  detail: '71.8% — cap 70.0% — BREACH — partial paydown required',        regulation: 'Loan Agreement §6.1(b)' },
      { id: 'occupancy',   group: 'Servicing Compliance',  name: 'Occupancy ≥ Floor',              description: 'Physical occupancy meets covenant minimum.',                          status: 'fail',  detail: '79% occupied — floor 85% — BREACH — leasing plan required',    regulation: 'Loan Agreement §6.1(c)' },
      { id: 'repairs',     group: 'Servicing Compliance',  name: 'No Open Critical Repairs',       description: 'No outstanding critical repair findings from inspections.',            status: 'watch', detail: '2 moderate repair findings open — HVAC unit + parking surface', regulation: 'Freddie Mac Inspection §83' },
      { id: 'default',     group: 'Default & Legal',       name: 'No Active Default / ROR',        description: 'Loan is not in default, cure period, or right-of-redemption.',        status: 'fail',  detail: 'Cure period active — multiple covenant breaches — 14d remaining', regulation: 'UCC §9-601' },
      { id: 'legal',       group: 'Default & Legal',       name: 'Legal Documentation Complete',   description: 'Note, mortgage/DOT, title policy, survey on file and current.',       status: 'pass',  detail: 'All origination docs on file — title policy Mar 2023',          regulation: 'ALTA Title Standards' },
      { id: 'disclosures', group: 'Investor Layer',        name: 'Investor Disclosures Filed',     description: 'PPM, subscription agreement, Form D filed; offering docs current.',   status: 'pass',  detail: 'Form D filed Mar 2023 — risk update letter issued Mar 28, 2026', regulation: 'SEC Reg D Rule 506(c)' },
      { id: 'kyc',         group: 'Investor Layer',        name: 'KYC/AML & Accreditation',        description: 'All token holders KYC/AML verified; accreditation status current.',   status: 'pass',  detail: '9 investors — all verified — accreditation current',             regulation: 'FinCEN 31 CFR §1010.230' },
    ],
  },
  {
    loanId: 'LN-1120',
    title: 'Lakeside Mixed-Use',
    propertyType: 'Mixed Use',
    borrower: 'Lakeside Development Group',
    upb: 7_156_250,
    tokenSymbol: null,
    tokenStatus: 'not-issued',
    criteria: [
      { id: 'taxes',       group: 'Property & Collateral', name: 'Property Taxes Current',          description: 'No delinquent tax liens; taxes paid through current period.',          status: 'pass',  detail: 'Paid through Q1 2026 — Travis County, TX',                     regulation: 'Freddie Mac Servicing Guide §73' },
      { id: 'insurance',   group: 'Property & Collateral', name: 'Insurance Active & Current',      description: 'All-risk property + liability policies active; expiry > 30 days.',     status: 'pass',  detail: 'Commercial policy expires Sep 1, 2026',                         regulation: 'Fannie Mae Servicing Guide B-1-01' },
      { id: 'rentroll',    group: 'Property & Collateral', name: 'Rent Roll Verified (< 90 days)', description: 'Certified rent roll received and reviewed within 90 days.',           status: 'pass',  detail: 'Certified Mar 20, 2026 — 88% occupied',                        regulation: 'SEC Reg A+ Disclosure' },
      { id: 'reserves',    group: 'Property & Collateral', name: 'Reserves ≥ Minimum',             description: 'Escrow/reserve balance meets or exceeds required minimum.',           status: 'pass',  detail: '$214,688 on deposit / $180,000 minimum required',               regulation: 'Loan Agreement §8.3' },
      { id: 'dscr',        group: 'Servicing Compliance',  name: 'DSCR ≥ Covenant Floor',          description: 'Debt service coverage ratio meets covenant threshold.',               status: 'pass',  detail: '1.55x — floor 1.25x — tested Q1 2026',                         regulation: 'Loan Agreement §6.1(a)' },
      { id: 'ltv',         group: 'Servicing Compliance',  name: 'LTV ≤ Covenant Cap',             description: 'Loan-to-value ratio does not exceed covenant cap.',                  status: 'pass',  detail: '61.8% — cap 70.0% — 2025 FIRREA appraisal',                   regulation: 'Loan Agreement §6.1(b)' },
      { id: 'occupancy',   group: 'Servicing Compliance',  name: 'Occupancy ≥ Floor',              description: 'Physical occupancy meets covenant minimum.',                          status: 'pass',  detail: '88% occupied — floor 85% — certified Mar 20, 2026',            regulation: 'Loan Agreement §6.1(c)' },
      { id: 'repairs',     group: 'Servicing Compliance',  name: 'No Open Critical Repairs',       description: 'No outstanding critical repair findings from inspections.',            status: 'pass',  detail: 'Last inspection Jan 2026 — zero critical findings',             regulation: 'Freddie Mac Inspection §83' },
      { id: 'default',     group: 'Default & Legal',       name: 'No Active Default / ROR',        description: 'Loan is not in default, cure period, or right-of-redemption.',        status: 'pass',  detail: 'Current — no default events recorded',                          regulation: 'UCC §9-601' },
      { id: 'legal',       group: 'Default & Legal',       name: 'Legal Documentation Complete',   description: 'Note, mortgage/DOT, title policy, survey on file and current.',       status: 'pass',  detail: 'All origination docs on file — title policy Sep 2024',          regulation: 'ALTA Title Standards' },
      { id: 'disclosures', group: 'Investor Layer',        name: 'Investor Disclosures Filed',     description: 'PPM, subscription agreement, Form D filed; offering docs current.',   status: 'watch', detail: 'PPM draft v0.3 in counsel review — Form D not yet filed',       regulation: 'SEC Reg D Rule 506(c)' },
      { id: 'kyc',         group: 'Investor Layer',        name: 'KYC/AML & Accreditation',        description: 'All token holders KYC/AML verified; accreditation status current.',   status: 'watch', detail: 'No investors onboarded yet — KYC required before token sale',   regulation: 'FinCEN 31 CFR §1010.230' },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const CRITERION_CFG: Record<CriterionStatus, { icon: typeof CheckCircleIcon; classes: string; badge: string }> = {
  pass:  { icon: CheckCircleIcon,        classes: 'border-emerald-200 bg-emerald-50',  badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  watch: { icon: ExclamationTriangleIcon, classes: 'border-amber-200 bg-amber-50',     badge: 'bg-amber-100 text-amber-700 border border-amber-200' },
  fail:  { icon: XCircleIcon,             classes: 'border-red-200 bg-red-50',          badge: 'bg-red-100 text-red-700 border border-red-200' },
};

const TOKEN_STATUS_CFG: Record<TokenStatus, { label: string; classes: string; icon: typeof ShieldCheckIcon }> = {
  'active':     { label: 'Token Active',     classes: 'bg-emerald-50 border-emerald-300 text-emerald-800', icon: ShieldCheckIcon },
  'suspended':  { label: 'Token Suspended',  classes: 'bg-red-50 border-red-300 text-red-800',             icon: ShieldExclamationIcon },
  'pending':    { label: 'Pending Issuance', classes: 'bg-blue-50 border-blue-300 text-blue-800',          icon: ShieldCheckIcon },
  'not-issued': { label: 'Not Yet Issued',   classes: 'bg-slate-50 border-slate-300 text-slate-700',       icon: LockClosedIcon },
};

const GROUPS = ['Property & Collateral', 'Servicing Compliance', 'Default & Legal', 'Investor Layer'];

function computeVerdict(criteria: Criterion[]): { eligible: boolean; blocked: boolean; label: string; classes: string; passingCount: number } {
  const fails = criteria.filter((c) => c.status === 'fail').length;
  const watches = criteria.filter((c) => c.status === 'watch').length;
  const passing = criteria.filter((c) => c.status === 'pass').length;
  if (fails > 0) return { eligible: false, blocked: true,  label: `NOT ELIGIBLE — ${fails} breach${fails > 1 ? 'es' : ''} blocking`, classes: 'bg-red-700 text-white', passingCount: passing };
  if (watches > 0) return { eligible: false, blocked: false, label: `WATCH — ${watches} criterion${watches > 1 ? 'a' : ''} approaching threshold`, classes: 'bg-amber-500 text-white', passingCount: passing };
  return { eligible: true, blocked: false, label: 'ELIGIBLE FOR TOKENIZATION', classes: 'bg-emerald-700 text-white', passingCount: passing };
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnchainTokenGatePage() {
  const [searchParams] = useSearchParams();
  const paramLoan = searchParams.get('loan');
  const defaultLoan = paramLoan && LOANS.find((l) => l.loanId === paramLoan) ? paramLoan : 'LN-0728';
  const [selectedLoanId, setSelectedLoanId] = useState(defaultLoan);

  // Sync if URL param changes (e.g. deep-link navigation)
  useEffect(() => {
    if (paramLoan && LOANS.find((l) => l.loanId === paramLoan)) {
      setSelectedLoanId(paramLoan);
    }
  }, [paramLoan]);

  const loan = LOANS.find((l) => l.loanId === selectedLoanId) ?? LOANS[0];
  const verdict = computeVerdict(loan.criteria);
  const tokenCfg = TOKEN_STATUS_CFG[loan.tokenStatus];
  const TokenStatusIcon = tokenCfg.icon;

  const failCount  = loan.criteria.filter((c) => c.status === 'fail').length;
  const watchCount = loan.criteria.filter((c) => c.status === 'watch').length;
  const passCount  = loan.criteria.filter((c) => c.status === 'pass').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tokenization Compliance Gate</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            A loan must pass all 12 compliance criteria before tokens can be issued or traded.
            This gate enforces the rule at issuance <em>and</em> monitors ongoing compliance —
            suspending token trading automatically if a loan falls out of compliance.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <ShieldCheckIcon className="h-4 w-4 text-slate-400" />
          <span>Aligned with SEC Reg D · Freddie Mac · Fannie Mae · FinCEN</span>
        </div>
      </div>

      {/* Loan selector + token status */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Loan</label>
          <select
            value={selectedLoanId}
            onChange={(e) => setSelectedLoanId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {LOANS.map((l) => (
              <option key={l.loanId} value={l.loanId}>
                {l.loanId} — {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-5">
          <span className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold ${tokenCfg.classes}`}>
            <TokenStatusIcon className="h-4 w-4" />
            {tokenCfg.label}
            {loan.tokenSymbol && ` — ${loan.tokenSymbol}`}
          </span>
        </div>
        <div className="mt-5 text-xs text-slate-500">
          {loan.borrower} · {loan.propertyType} · {fmt(loan.upb)} UPB
        </div>
      </div>

      {/* Overall verdict banner */}
      <div className={`rounded-2xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap ${verdict.classes}`}>
        <div className="flex items-center gap-4">
          {verdict.eligible ? (
            <ShieldCheckIcon className="h-10 w-10 opacity-90 shrink-0" />
          ) : (
            <ShieldExclamationIcon className="h-10 w-10 opacity-90 shrink-0" />
          )}
          <div>
            <p className="text-xl font-black tracking-tight">{verdict.label}</p>
            <p className="text-sm opacity-80 mt-0.5">
              {passCount} of 12 criteria passing
              {watchCount > 0 ? ` · ${watchCount} on watch` : ''}
              {failCount > 0 ? ` · ${failCount} in breach` : ''}
            </p>
          </div>
        </div>
        {verdict.eligible && !loan.tokenSymbol && (
          <Link
            to="/onchain/tokens"
            className="shrink-0 flex items-center gap-2 rounded-xl bg-white/20 border border-white/30 px-5 py-2.5 text-sm font-black text-white hover:bg-white/30 transition-colors"
          >
            <CubeIcon className="h-4 w-4" />
            Initiate Token Issuance →
          </Link>
        )}
        {loan.tokenSymbol && loan.tokenStatus === 'active' && (
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/onchain/cap-table" className="flex items-center gap-1.5 rounded-xl bg-white/20 border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors">Cap Table</Link>
            <Link to="/onchain/distributions" className="flex items-center gap-1.5 rounded-xl bg-white/20 border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/30 transition-colors">Distributions</Link>
          </div>
        )}
        {loan.tokenStatus === 'suspended' && (
          <Link
            to="/governance/loan-control"
            className="shrink-0 flex items-center gap-2 rounded-xl bg-white/20 border border-white/30 px-5 py-2.5 text-sm font-black text-white hover:bg-white/30 transition-colors"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            Open Governance Action →
          </Link>
        )}
      </div>

      {/* Score summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-2xl font-black text-emerald-700 tabular-nums">{passCount}</p>
          <p className="text-xs font-bold text-emerald-600 mt-0.5">Passing</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 text-center ${watchCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
          <p className={`text-2xl font-black tabular-nums ${watchCount > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{watchCount}</p>
          <p className={`text-xs font-bold mt-0.5 ${watchCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>On Watch</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 text-center ${failCount > 0 ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
          <p className={`text-2xl font-black tabular-nums ${failCount > 0 ? 'text-red-700' : 'text-slate-300'}`}>{failCount}</p>
          <p className={`text-xs font-bold mt-0.5 ${failCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>In Breach</p>
        </div>
      </div>

      {/* 12 criteria — grouped */}
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const groupCriteria = loan.criteria.filter((c) => c.group === group);
          return (
            <div key={group}>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{group}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {groupCriteria.map((criterion) => {
                  const cfg = CRITERION_CFG[criterion.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={criterion.id}
                      className={`rounded-xl border p-4 ${cfg.classes} transition-all`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${
                            criterion.status === 'fail' ? 'text-red-600' :
                            criterion.status === 'watch' ? 'text-amber-600' : 'text-emerald-600'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800">{criterion.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{criterion.description}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black capitalize ${cfg.badge}`}>
                          {criterion.status === 'fail' ? 'Breach' : criterion.status === 'watch' ? 'Watch' : 'Pass'}
                        </span>
                      </div>
                      <div className="mt-3 ml-8 flex items-start justify-between gap-2 flex-wrap">
                        <p className={`text-xs font-semibold ${
                          criterion.status === 'fail' ? 'text-red-700' :
                          criterion.status === 'watch' ? 'text-amber-700' : 'text-emerald-700'
                        }`}>{criterion.detail}</p>
                        {criterion.regulation && (
                          <span className="shrink-0 text-[10px] font-bold text-slate-400 bg-white/60 px-2 py-0.5 rounded-full border border-slate-200">
                            {criterion.regulation}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Architecture note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Architecture</p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Servicing is the source of truth.</strong> Compliance is the gatekeeper.
          Tokenization is the downstream financial product. A loan that falls out of compliance after token issuance
          automatically has its token trading suspended — transfers are blocked at the smart contract level until
          all 12 criteria are restored to passing status and reviewed by the lender. This architecture is designed to
          meet SEC Reg D, Freddie Mac, Fannie Mae, and FDIC guidance on digital debt instruments.
        </p>
      </div>
    </div>
  );
}
