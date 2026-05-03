/**
 * Kontra Command Center Shell — Phase 8
 * Reusable command center layout used by all 6 operational centers.
 * Falls back to rich per-center demo data when API is unavailable.
 */

import React, { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPI {
  label: string;
  value: number | string;
  delta: string;
  unit: string;
  trend: "up" | "down" | "flat";
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  agent: string;
  slaHours: number;
  elapsedMins: number;
  priority: "low" | "normal" | "high" | "critical";
  [key: string]: unknown;
}

interface AgentOutput {
  id: string;
  agent: string;
  model: string;
  action: string;
  confidence: number;
  ts: string;
  status: string;
  [key: string]: unknown;
}

interface Approval {
  id: string;
  type: string;
  amount?: number;
  submittedAt: string;
  urgency: string;
  requestedBy?: string;
  [key: string]: unknown;
}

interface SLABreach {
  id: string;
  workflow: string;
  breachedBy: string;
  assignee: string;
  severity: string;
  [key: string]: unknown;
}

interface Exception {
  id: string;
  code: string;
  description: string;
  severity: string;
  [key: string]: unknown;
}

interface DashboardData {
  kpis: KPI[];
  workflows: Workflow[];
  agentOutputs: AgentOutput[];
  approvals: Approval[];
  slaBreaches: SLABreach[];
  exceptions: Exception[];
  generatedAt?: string;
}

interface CommandCenterShellProps {
  centerId: string;
  title: string;
  subtitle: string;
  accentColor: string;
  accentHex: string;
  icon: React.ReactNode;
}

// ── Per-center demo data ────────────────────────────────────────────────────────

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const DEMO_DATA: Record<string, DashboardData> = {
  servicing: {
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Active Loans",       value: 847,      delta: "+12 MTD",    unit: "",   trend: "up"   },
      { label: "Portfolio UPB",      value: 2_410_000_000, delta: "+$28M",  unit: "$",  trend: "up"   },
      { label: "P&I Collected",      value: 18_240_000, delta: "99.1%",   unit: "$",  trend: "up"   },
      { label: "Delinquency Rate",   value: "1.41%",  delta: "+0.12%",    unit: "",   trend: "up"   },
      { label: "Open Exceptions",    value: 14,       delta: "-3 today",  unit: "",   trend: "down" },
      { label: "SLA Compliance",     value: "97.8%",  delta: "+0.4%",     unit: "",   trend: "up"   },
    ],
    workflows: [
      { id: "WF-001", name: "Payment Processing — April Cycle",    status: "running",  agent: "payment_agent",    slaHours: 4,  elapsedMins: 142, priority: "high",     loan: "LN-2847" },
      { id: "WF-002", name: "Draw Disbursement — DR-0094",         status: "review",   agent: "draw_agent",       slaHours: 8,  elapsedMins: 310, priority: "critical", loan: "LN-2847" },
      { id: "WF-003", name: "Escrow Reconciliation — Q1 2026",     status: "running",  agent: "escrow_agent",     slaHours: 24, elapsedMins: 680, priority: "normal",   loan: "LN-3201" },
      { id: "WF-004", name: "Covenant Monitoring — Monthly",       status: "complete", agent: "compliance_agent", slaHours: 12, elapsedMins: 720, priority: "normal",   loan: "Portfolio" },
      { id: "WF-005", name: "Special Servicing Escalation — LN-3011", status: "escalated", agent: "risk_agent",  slaHours: 2,  elapsedMins: 195, priority: "critical", loan: "LN-3011" },
      { id: "WF-006", name: "Borrower Notice — Insurance Renewal", status: "pending",  agent: "comms_agent",     slaHours: 6,  elapsedMins: 45,  priority: "high",     loan: "LN-2847" },
    ],
    agentOutputs: [
      { id: "AO-1", agent: "payment_agent",    model: "gpt-3.5-turbo", action: "Processed $18.24M P&I across 831 loans. 8 loans flagged for 30-day follow-up. Delinquency report attached.",       confidence: 0.99, ts: ago(3),  status: "complete" },
      { id: "AO-2", agent: "draw_agent",       model: "gpt-4o",        action: "HOLD on DR-0091 (LN-3011 Harbor Point $2.1M): site photos show 45% framing vs 70% claimed. Re-inspection ordered.", confidence: 0.94, ts: ago(8),  status: "flagged"  },
      { id: "AO-3", agent: "escrow_agent",     model: "gpt-3.5-turbo", action: "Escrow shortfall on LN-2847: $42,100 below minimum reserve. Auto-notification sent to Cedar Grove Partners.",        confidence: 0.99, ts: ago(12), status: "flagged"  },
      { id: "AO-4", agent: "compliance_agent", model: "gpt-4o",        action: "DSCR breach confirmed on LN-3011: 0.94× vs 1.15× covenant. Special servicing memo drafted per Freddie Mac Ch.28.", confidence: 0.97, ts: ago(18), status: "escalated" },
    ],
    approvals: [
      { id: "AP-1", type: "Draw Approval — DR-0094 · LN-2847 Meridian Apts",   amount: 82_000,    submittedAt: ago(45),  urgency: "high",     requestedBy: "Cedar Grove Partners" },
      { id: "AP-2", type: "Special Servicing Transfer — LN-3011 Harbor Point", amount: 0,         submittedAt: ago(120), urgency: "critical", requestedBy: "Risk Committee" },
      { id: "AP-3", type: "Escrow Advance — LN-2847 Insurance Reserve",        amount: 18_400,    submittedAt: ago(200), urgency: "high",     requestedBy: "Servicing Ops" },
    ],
    slaBreaches: [
      { id: "SB-1", workflow: "Special Servicing Escalation",  breachedBy: "1h 35m", assignee: "j.martinez", severity: "critical", loan: "LN-3011" },
    ],
    exceptions: [
      { id: "EX-1", code: "DSCR-BREACH-001",      description: "LN-3011 Harbor Point: DSCR 0.94× below 1.15× covenant floor. 45 days delinquent.",                severity: "critical" },
      { id: "EX-2", code: "ESCROW-SHORT-004",     description: "LN-2847 Meridian Apts: Escrow balance $89,400 vs $131,500 required. Projected shortage Sep 2026.", severity: "high"     },
      { id: "EX-3", code: "INSURANCE-EXPIRE-007", description: "LN-2847 Meridian Apts: Property insurance renewal due in 14 days. Borrower notified.",              severity: "high"     },
      { id: "EX-4", code: "OCCUPANCY-WATCH-012",  description: "LN-3204 Riverview Office: Occupancy 81% vs 85% trigger. Rent roll review requested.",               severity: "medium"   },
    ],
  },

  inspection: {
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Active Inspections",  value: 23,      delta: "+5 this week",  unit: "",   trend: "up"   },
      { label: "Avg Completion",      value: "2.4 days", delta: "-0.3 days",  unit: "",   trend: "down" },
      { label: "Photo Sets Analyzed", value: 1_847,   delta: "+312 MTD",     unit: "",   trend: "up"   },
      { label: "Discrepancies Found", value: 8,       delta: "2 critical",   unit: "",   trend: "up"   },
      { label: "Draws Gated",         value: 3,       delta: "Pending re-inspect", unit: "", trend: "flat" },
      { label: "AI Accuracy",         value: "94.8%", delta: "+1.2%",        unit: "",   trend: "up"   },
    ],
    workflows: [
      { id: "WF-I01", name: "Field Inspection — LN-3011 Harbor Point Phase 3",   status: "escalated", agent: "inspection_ai", slaHours: 24, elapsedMins: 1440, priority: "critical", property: "Harbor Point Mixed-Use" },
      { id: "WF-I02", name: "Photo Validation — DR-0094 Electrical Rough-In",    status: "complete",  agent: "vision_agent",  slaHours: 8,  elapsedMins: 320,  priority: "high",     property: "The Meridian Apartments" },
      { id: "WF-I03", name: "Progress Verification — LN-4012 Sunset Ridge TI",  status: "running",   agent: "inspection_ai", slaHours: 12, elapsedMins: 280,  priority: "normal",   property: "Sunset Ridge Retail" },
      { id: "WF-I04", name: "Annual Property Condition Assessment — LN-1899",    status: "pending",   agent: "inspection_ai", slaHours: 48, elapsedMins: 120,  priority: "normal",   property: "Pacific Gateway Office" },
      { id: "WF-I05", name: "Draw Photo Audit — DR-0102 LN-2741",               status: "pending",   agent: "vision_agent",  slaHours: 8,  elapsedMins: 45,   priority: "normal",   property: "Sunset Ridge Retail" },
    ],
    agentOutputs: [
      { id: "AI-1", agent: "vision_agent",    model: "gpt-4o", action: "DR-0094 APPROVED: 12 photos confirm 78% milestone. Electrical rough-in verified by licensed inspector. No lien waiver gaps.", confidence: 0.96, ts: ago(2),  status: "approved" },
      { id: "AI-2", agent: "inspection_ai",  model: "gpt-4o", action: "DR-0091 HOLD: Photo set shows 45% framing completion vs 70% claimed in draw request. 25pp discrepancy exceeds 10pp threshold.", confidence: 0.94, ts: ago(7),  status: "flagged"  },
      { id: "AI-3", agent: "inspection_ai",  model: "gpt-4o", action: "LN-4012 TI progress at 62%. Flooring and millwork 80% complete. HVAC rough-in pending. On track for May 15 substantial completion.", confidence: 0.91, ts: ago(15), status: "complete" },
    ],
    approvals: [
      { id: "AP-I1", type: "Re-Inspection Order — LN-3011 Harbor Point Phase 3", amount: 3_500, submittedAt: ago(30),  urgency: "critical", requestedBy: "Draw Review Agent" },
      { id: "AP-I2", type: "PCA Vendor Authorization — Pacific Gateway Office",  amount: 8_200, submittedAt: ago(180), urgency: "normal",   requestedBy: "Asset Management" },
    ],
    slaBreaches: [
      { id: "SB-I1", workflow: "LN-3011 Harbor Point Phase 3 Inspection", breachedBy: "12h 0m", assignee: "field_ops", severity: "critical", property: "Harbor Point Mixed-Use" },
    ],
    exceptions: [
      { id: "EX-I1", code: "PHOTO-DISCREPANCY-003", description: "LN-3011 Phase 3: 25pp framing discrepancy. Inspector report vs photographic evidence conflict. Draw gated.", severity: "critical" },
      { id: "EX-I2", code: "INSPECTOR-CONFLICT-007", description: "LN-2741 DR-0102: Inspector has prior relationship with GC. Independence waiver required before approval.", severity: "high" },
    ],
  },

  hazard: {
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Open Claims",       value: 7,        delta: "+2 this month", unit: "",   trend: "up"   },
      { label: "Claim Value",       value: 2_840_000, delta: "$840K new",   unit: "$",  trend: "up"   },
      { label: "Avg Resolution",    value: "47 days", delta: "-8 days",     unit: "",   trend: "down" },
      { label: "Insurance Expiring",value: 3,        delta: "Next 30 days", unit: "",   trend: "up"   },
      { label: "Force-Place Risk",  value: 1,        delta: "LN-2847",      unit: "",   trend: "up"   },
      { label: "Recovery Rate",     value: "91.2%",  delta: "+2.1%",        unit: "",   trend: "up"   },
    ],
    workflows: [
      { id: "WF-H01", name: "Fire Damage Claim — LN-6671 Oakwood Apts",        status: "running",  agent: "claims_agent",    slaHours: 72, elapsedMins: 2880, priority: "critical", property: "Oakwood Garden Apts" },
      { id: "WF-H02", name: "Insurance Renewal Tracking — LN-2847",            status: "escalated", agent: "insurance_agent", slaHours: 48, elapsedMins: 840,  priority: "high",     property: "The Meridian Apartments" },
      { id: "WF-H03", name: "Flood Loss Assessment — LN-3201 Westgate",        status: "complete",  agent: "claims_agent",    slaHours: 96, elapsedMins: 5760, priority: "normal",   property: "Westgate Industrial Park" },
      { id: "WF-H04", name: "Force-Place Insurance — LN-2847 Meridian",        status: "pending",   agent: "insurance_agent", slaHours: 24, elapsedMins: 60,   priority: "high",     property: "The Meridian Apartments" },
      { id: "WF-H05", name: "Wind Damage Claim — LN-1899 Pacific Gateway",     status: "running",   agent: "claims_agent",    slaHours: 48, elapsedMins: 960,  priority: "normal",   property: "Pacific Gateway Office" },
    ],
    agentOutputs: [
      { id: "AH-1", agent: "claims_agent",    model: "gpt-4o",        action: "LN-6671 fire claim: $1.84M structural damage confirmed by adjuster. Contractor bids received. Disbursement in 2 tranches recommended.", confidence: 0.93, ts: ago(4),  status: "review"   },
      { id: "AH-2", agent: "insurance_agent", model: "gpt-3.5-turbo", action: "LN-2847 insurance expires June 1. Borrower non-responsive for 8 days. Force-place policy quote obtained: $28,400/yr.", confidence: 0.99, ts: ago(11), status: "flagged"  },
      { id: "AH-3", agent: "claims_agent",    model: "gpt-4o",        action: "LN-3201 Westgate flood claim closed: $218,500 recovered from carrier. Net loss to trust: $0. Subrogation waived.",  confidence: 0.97, ts: ago(22), status: "complete" },
    ],
    approvals: [
      { id: "AP-H1", type: "Force-Place Insurance Binding — LN-2847",     amount: 28_400, submittedAt: ago(20),  urgency: "critical", requestedBy: "Insurance Agent" },
      { id: "AP-H2", type: "Claim Disbursement Tranche 1 — LN-6671",     amount: 920_000, submittedAt: ago(90), urgency: "high",     requestedBy: "Claims Committee" },
    ],
    slaBreaches: [
      { id: "SB-H1", workflow: "Force-Place Insurance — LN-2847 Meridian", breachedBy: "4h 0m", assignee: "k.rodriguez", severity: "critical", property: "The Meridian Apartments" },
    ],
    exceptions: [
      { id: "EX-H1", code: "INSURANCE-LAPSE-001",  description: "LN-2847: Property insurance expires June 1. Borrower unresponsive. Force-place required per loan agreement §12.4.", severity: "critical" },
      { id: "EX-H2", code: "CLAIM-OPEN-60D-003",   description: "LN-6671: Fire damage claim open 62 days vs 45-day SLA. Contractor delay. Carrier approved extension.",             severity: "high"     },
    ],
  },

  compliance: {
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Covenant Tests",    value: 847,     delta: "Monthly run",   unit: "",   trend: "flat" },
      { label: "DSCR Breaches",     value: 2,       delta: "LN-3011/3204",  unit: "",   trend: "up"   },
      { label: "Reporting On-Time", value: "96.4%", delta: "+1.1%",         unit: "",   trend: "up"   },
      { label: "Freddie Violations",value: 0,       delta: "✓ Clean",       unit: "",   trend: "flat" },
      { label: "Open Waivers",      value: 3,       delta: "+1 this month", unit: "",   trend: "up"   },
      { label: "Reg D/S Status",    value: "Active",delta: "10,290 investors",unit: "", trend: "flat" },
    ],
    workflows: [
      { id: "WF-C01", name: "Monthly DSCR Test — Full Portfolio",         status: "complete",  agent: "compliance_agent", slaHours: 12, elapsedMins: 420,  priority: "high",   scope: "847 loans"   },
      { id: "WF-C02", name: "Freddie Mac Annual Certification — 2026",    status: "running",   agent: "compliance_agent", slaHours: 48, elapsedMins: 1200, priority: "high",   scope: "Regulatory"  },
      { id: "WF-C03", name: "Covenant Waiver Request — LN-3011",          status: "review",    agent: "legal_agent",      slaHours: 24, elapsedMins: 900,  priority: "critical",loan: "LN-3011"     },
      { id: "WF-C04", name: "Reg D Offering Compliance — KTRA-2847",      status: "complete",  agent: "compliance_agent", slaHours: 8,  elapsedMins: 480,  priority: "normal", token: "KTRA-2847"   },
      { id: "WF-C05", name: "AML/KYC Refresh — Investor Registry",        status: "running",   agent: "kyc_agent",        slaHours: 24, elapsedMins: 360,  priority: "normal", scope: "10,290 investors" },
    ],
    agentOutputs: [
      { id: "AC-1", agent: "compliance_agent", model: "gpt-4o", action: "Monthly DSCR test complete: 843/847 loans passing. 2 active breaches (LN-3011, LN-3204). 2 at-floor (LN-2847-alt, LN-0087). Reports generated.", confidence: 0.99, ts: ago(1),  status: "complete"  },
      { id: "AC-2", agent: "legal_agent",      model: "gpt-4o", action: "Covenant waiver memo drafted for LN-3011. Cures: (1) partial payoff, (2) springing cash trap, (3) 90-day cure period. Awaiting lender committee approval.", confidence: 0.95, ts: ago(9),  status: "review"    },
      { id: "AC-3", agent: "compliance_agent", model: "gpt-4o", action: "KTRA-2847 Reg D compliance confirmed: 4,218 accredited investors verified, 506 Reg S offshore. ERC-1400 transfer restrictions enforced on-chain.", confidence: 0.98, ts: ago(20), status: "complete"  },
    ],
    approvals: [
      { id: "AP-C1", type: "Covenant Waiver Authorization — LN-3011",         amount: 0,      submittedAt: ago(60),  urgency: "critical", requestedBy: "Legal Agent"      },
      { id: "AP-C2", type: "Reg D Investor Certification — 22 new investors",  amount: 0,      submittedAt: ago(180), urgency: "normal",   requestedBy: "KYC Agent"        },
      { id: "AP-C3", type: "Freddie Mac Reporting Package — March 2026",       amount: 0,      submittedAt: ago(300), urgency: "high",     requestedBy: "Compliance Agent" },
    ],
    slaBreaches: [],
    exceptions: [
      { id: "EX-C1", code: "DSCR-BREACH-LN3011",  description: "LN-3011 DSCR 0.94× vs 1.15× floor. Active breach. Covenant waiver in progress. Freddie Mac notification sent.", severity: "critical" },
      { id: "EX-C2", code: "DSCR-FLOOR-LN3204",   description: "LN-3204 DSCR 1.21× vs 1.20× floor. At-floor watch. Q2 financials due May 15 will determine waiver need.",       severity: "high"     },
      { id: "EX-C3", code: "WAIVER-PENDING-003",   description: "LN-0087 occupancy covenant waiver pending 32 days. Lender committee meeting scheduled May 8.",                   severity: "medium"   },
    ],
  },

  exchange: {
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Tokens Outstanding", value: 2,           delta: "KTRA-2847/5544", unit: "",   trend: "flat" },
      { label: "Total Tokenized",    value: 225_400_000, delta: "+$12.4M Q1",     unit: "$",  trend: "up"   },
      { label: "Active Investors",   value: 10_290,      delta: "+312 MTD",       unit: "",   trend: "up"   },
      { label: "Secondary Volume",   value: 4_820_000,   delta: "30-day",         unit: "$",  trend: "up"   },
      { label: "Avg Yield",          value: "7.4%",      delta: "+0.2%",          unit: "",   trend: "up"   },
      { label: "Transfer Compliance",value: "100%",      delta: "ERC-1400",       unit: "",   trend: "flat" },
    ],
    workflows: [
      { id: "WF-E01", name: "Token Distribution — KTRA-2847 May Yield",         status: "running",  agent: "distribution_agent", slaHours: 4,  elapsedMins: 80,  priority: "high",   token: "KTRA-2847" },
      { id: "WF-E02", name: "KYC/AML Check — 22 New Investor Applications",     status: "running",  agent: "kyc_agent",          slaHours: 24, elapsedMins: 360, priority: "normal", token: "KTRA-2847/5544" },
      { id: "WF-E03", name: "Secondary Market RFQ Settlement — 8 Trades",       status: "complete", agent: "settlement_agent",   slaHours: 2,  elapsedMins: 90,  priority: "normal", token: "KTRA-5544" },
      { id: "WF-E04", name: "Reg S Offshore Offering — KTRA-2847 Tranche 3",    status: "review",   agent: "compliance_agent",   slaHours: 48, elapsedMins: 960, priority: "high",   token: "KTRA-2847" },
      { id: "WF-E05", name: "ERC-1400 Partition Rebalance — Quarterly",         status: "pending",  agent: "onchain_agent",      slaHours: 8,  elapsedMins: 0,   priority: "normal", token: "Portfolio" },
    ],
    agentOutputs: [
      { id: "AE-1", agent: "distribution_agent", model: "gpt-4o",        action: "KTRA-2847 May yield distribution: $879,468 to 4,218 investors. Avg distribution $208.37/holder. Wire + on-chain dual settlement.", confidence: 0.99, ts: ago(5),  status: "running"  },
      { id: "AE-2", agent: "kyc_agent",          model: "gpt-3.5-turbo", action: "22 new investor applications received. 18 passed accreditation check. 4 pending income verification. 0 AML flags.", confidence: 0.97, ts: ago(14), status: "review"   },
      { id: "AE-3", agent: "settlement_agent",   model: "gpt-4o",        action: "8 secondary market trades settled: $1.24M total. KTRA-5544 bid/ask spread 42bps. ERC-1400 transfer restrictions enforced.", confidence: 0.99, ts: ago(28), status: "complete" },
    ],
    approvals: [
      { id: "AP-E1", type: "Reg S Offshore Tranche 3 Authorization — KTRA-2847", amount: 18_500_000, submittedAt: ago(90),  urgency: "high",   requestedBy: "Capital Markets" },
      { id: "AP-E2", type: "New Investor Onboarding Batch — 18 Accredited",      amount: 0,          submittedAt: ago(200), urgency: "normal", requestedBy: "KYC Agent"       },
    ],
    slaBreaches: [],
    exceptions: [
      { id: "EX-E1", code: "REG-S-REVIEW-001", description: "KTRA-2847 Reg S Tranche 3: $18.5M offshore offering requires legal sign-off. 40-day seasoning period begins on funding.", severity: "high"   },
      { id: "EX-E2", code: "INVESTOR-VERIFY-004", description: "4 investor applications pending income verification for accreditation. Deadline: May 10 per Reg D timeline.",          severity: "medium" },
    ],
  },

  admin: {
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: "Active Policies",    value: 247,     delta: "+8 this month",  unit: "",   trend: "up"   },
      { label: "Policy Violations",  value: 0,       delta: "✓ Clean",        unit: "",   trend: "flat" },
      { label: "API Uptime",         value: "99.97%",delta: "30-day SLA",     unit: "",   trend: "up"   },
      { label: "Active Users",       value: 142,     delta: "+19 MTD",        unit: "",   trend: "up"   },
      { label: "Audit Events",       value: 48_291,  delta: "Today",          unit: "",   trend: "up"   },
      { label: "SSO Sessions",       value: 38,      delta: "Right now",      unit: "",   trend: "flat" },
    ],
    workflows: [
      { id: "WF-A01", name: "Policy Enforcement — Data Residency EU",       status: "running",  agent: "policy_agent",  slaHours: 1, elapsedMins: 0,   priority: "normal",   scope: "All EU tenants" },
      { id: "WF-A02", name: "Role-Based Access Review — Q2 2026",           status: "running",  agent: "rbac_agent",    slaHours: 24, elapsedMins: 480, priority: "high",     scope: "142 users"      },
      { id: "WF-A03", name: "API Key Rotation — Production Credentials",    status: "complete", agent: "secrets_agent", slaHours: 4,  elapsedMins: 220, priority: "high",     scope: "Infra"          },
      { id: "WF-A04", name: "Audit Log Export — Monthly SOC 2 Package",     status: "complete", agent: "audit_agent",   slaHours: 8,  elapsedMins: 480, priority: "normal",   scope: "Compliance"     },
      { id: "WF-A05", name: "SSO Certificate Renewal — SAML 2.0",          status: "pending",  agent: "infra_agent",   slaHours: 48, elapsedMins: 60,  priority: "critical", scope: "Auth"           },
    ],
    agentOutputs: [
      { id: "AA-1", agent: "rbac_agent",    model: "gpt-4o",        action: "Q2 RBAC review complete: 142 users, 18 roles. 3 over-provisioned accounts flagged for least-privilege remediation. 0 orphaned accounts.", confidence: 0.97, ts: ago(6),  status: "review"   },
      { id: "AA-2", agent: "secrets_agent", model: "gpt-3.5-turbo", action: "API key rotation complete across 12 production services. Zero-downtime rotation confirmed. Old keys invalidated at 02:00 UTC.", confidence: 0.99, ts: ago(18), status: "complete" },
      { id: "AA-3", agent: "audit_agent",   model: "gpt-3.5-turbo", action: "SOC 2 audit package compiled: 48,291 events, 0 anomalies, 0 unauthorized access attempts. Export ready for auditor delivery.", confidence: 0.99, ts: ago(36), status: "complete" },
    ],
    approvals: [
      { id: "AP-A1", type: "SSO Certificate Renewal — SAML 2.0 Production",  amount: 0, submittedAt: ago(30),  urgency: "critical", requestedBy: "Infra Agent" },
      { id: "AP-A2", type: "RBAC Remediation — 3 Over-Provisioned Accounts",  amount: 0, submittedAt: ago(120), urgency: "high",     requestedBy: "RBAC Agent"  },
    ],
    slaBreaches: [],
    exceptions: [
      { id: "EX-A1", code: "SAML-CERT-EXPIRE-001",  description: "SAML 2.0 SSO certificate expires in 12 days. Renewal workflow initiated. Zero-downtime rotation required.", severity: "critical" },
      { id: "EX-A2", code: "RBAC-OVERPROV-003",     description: "3 user accounts have excessive permissions vs their role definition. Least-privilege remediation pending approval.", severity: "high" },
    ],
  },
};

function getDemoData(centerId: string): DashboardData {
  return DEMO_DATA[centerId] ?? DEMO_DATA.servicing;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return n.toLocaleString();
  return n.toString();
}

function fmtVal(kpi: KPI): string {
  if (kpi.unit === "$" && typeof kpi.value === "number") return fmt(kpi.value);
  if (typeof kpi.value === "number") return kpi.value.toLocaleString();
  return kpi.value as string;
}

function relTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function slaColor(status: string): string {
  const m: Record<string, string> = {
    running:   "#3b82f6",
    pending:   "#f59e0b",
    complete:  "#10b981",
    escalated: "#ef4444",
    breach:    "#dc2626",
    review:    "#8b5cf6",
    approved:  "#10b981",
    rejected:  "#ef4444",
    open:      "#f59e0b",
    flagged:   "#f59e0b",
  };
  return m[status] ?? "#6b7280";
}

function priorityBadge(p: string): React.ReactNode {
  const cfg: Record<string, { bg: string; label: string }> = {
    critical: { bg: "#dc2626", label: "CRITICAL" },
    high:     { bg: "#ef4444", label: "HIGH"     },
    normal:   { bg: "#3b82f6", label: "NORMAL"   },
    low:      { bg: "#6b7280", label: "LOW"       },
  };
  const c = cfg[p] ?? cfg.normal;
  return (
    <span style={{ background: c.bg }} className="text-white text-xs font-bold px-1.5 py-0.5 rounded">
      {c.label}
    </span>
  );
}

function pct(elapsed: number, slaHours: number): number {
  return Math.min(100, Math.round((elapsed / (slaHours * 60)) * 100));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({ kpi, hex }: { kpi: KPI; hex: string }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide truncate">{kpi.label}</p>
      <div className="flex items-end gap-2">
        <span className="text-white text-2xl font-bold">{fmtVal(kpi)}</span>
        <span
          className="text-xs font-semibold pb-0.5"
          style={{
            color: kpi.trend === "up"
              ? (kpi.label.toLowerCase().includes("breach") || kpi.label.toLowerCase().includes("violation") || kpi.label.toLowerCase().includes("delinq") || kpi.label.toLowerCase().includes("open") || kpi.label.toLowerCase().includes("expir") || kpi.label.toLowerCase().includes("risk")
                ? "#ef4444" : "#10b981")
              : kpi.trend === "down" ? "#10b981" : "#6b7280"
          }}
        >
          {kpi.delta}
        </span>
      </div>
    </div>
  );
}

function WorkflowRow({ wf }: { wf: Workflow }) {
  const p = pct(wf.elapsedMins, wf.slaHours);
  const elapsed = wf.elapsedMins >= 60 ? `${Math.floor(wf.elapsedMins / 60)}h ${wf.elapsedMins % 60}m` : `${wf.elapsedMins}m`;
  const context = (wf.loan || wf.wallet || wf.token || wf.property || wf.scope || "") as string;
  return (
    <div className="border-b border-gray-800 last:border-0 py-3 px-4 hover:bg-gray-800/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{wf.name}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {context && <span className="font-mono text-blue-300">{context}</span>}
            {context && " · "}
            <span className="text-blue-400">{wf.agent}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {priorityBadge(wf.priority)}
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${slaColor(wf.status)}22`, color: slaColor(wf.status), border: `1px solid ${slaColor(wf.status)}44` }}>
            {wf.status.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${p}%`, background: p >= 100 ? "#dc2626" : p >= 80 ? "#f59e0b" : "#10b981" }}
          />
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{elapsed} / {wf.slaHours}h SLA</span>
      </div>
    </div>
  );
}

function AgentOutputCard({ out }: { out: AgentOutput }) {
  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-900 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-blue-400">{out.agent}</span>
          <span className="text-xs text-gray-500">{out.model}</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${slaColor(out.status)}22`, color: slaColor(out.status) }}>
            {out.status.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{relTime(out.ts)}</span>
          <span className="text-xs font-semibold text-emerald-400">{(out.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-gray-300 text-xs leading-relaxed">{out.action}</p>
    </div>
  );
}

function ApprovalRow({ item, onAction, hex }: { item: Approval; onAction: (id: string, action: string) => void; hex: string }) {
  return (
    <div className="border-b border-gray-800 last:border-0 py-3 px-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{item.type}</p>
        <p className="text-gray-400 text-xs mt-0.5">
          {item.requestedBy && <span>{item.requestedBy} · </span>}
          {item.amount != null && item.amount > 0 && <span className="text-green-400 font-semibold">${(item.amount as number).toLocaleString()} · </span>}
          <span>{relTime(item.submittedAt)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: item.urgency === "critical" ? "#dc262622" : item.urgency === "high" ? "#f59e0b22" : "#3b82f622", color: item.urgency === "critical" ? "#dc2626" : item.urgency === "high" ? "#f59e0b" : "#3b82f6" }}>
          {item.urgency.toUpperCase()}
        </span>
        <button onClick={() => onAction(item.id, "approve")} className="text-xs px-2 py-1 rounded font-semibold text-white hover:opacity-80 transition-opacity" style={{ background: hex }}>
          Approve
        </button>
        <button onClick={() => onAction(item.id, "escalate")} className="text-xs px-2 py-1 rounded font-semibold bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors">
          Escalate
        </button>
      </div>
    </div>
  );
}

function SLABreachCard({ breach }: { breach: SLABreach }) {
  const context = (breach.loan || breach.property || breach.token || breach.scope || "") as string;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0 px-4">
      <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: breach.severity === "critical" ? "#dc2626" : "#f59e0b" }} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{breach.workflow}</p>
        <p className="text-gray-400 text-xs">{context && <span className="text-blue-300">{context} · </span>}Breached by <span className="text-red-400 font-semibold">{breach.breachedBy}</span></p>
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">@{breach.assignee}</span>
    </div>
  );
}

function ExceptionCard({ ex }: { ex: Exception }) {
  const color = ex.severity === "critical" ? "#dc2626" : ex.severity === "high" ? "#f59e0b" : "#3b82f6";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800 last:border-0 px-4">
      <span className="text-xs font-bold mt-0.5 px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${color}22`, color }}>
        {ex.severity.toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-amber-400 font-semibold">{ex.code}</p>
        <p className="text-gray-300 text-xs leading-relaxed mt-0.5">{ex.description}</p>
      </div>
    </div>
  );
}

// ── Main Shell ─────────────────────────────────────────────────────────────────

export default function CommandCenterShell({
  centerId, title, subtitle, accentHex, icon,
}: CommandCenterShellProps) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [toast, setToast]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/cc/${centerId}/dashboard`);
      if (!r.ok) throw new Error("no-api");
      const d = await r.json();
      setData(d);
    } catch {
      setData(getDemoData(centerId));
    } finally {
      setLastRefresh(new Date());
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const handleAction = async (actionId: string, action: string) => {
    try {
      await fetch(`${API_BASE}/api/cc/${centerId}/actions/${actionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    } catch { /* ignore — demo mode */ }
    const msg = action === "approve" ? "Approved successfully" : "Escalated to supervisor";
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
    if (data) {
      setData(prev => prev ? { ...prev, approvals: prev.approvals.filter(a => a.id !== actionId) } : prev);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-700 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: accentHex }} />
          <p className="text-gray-400">Loading {title}…</p>
        </div>
      </div>
    );
  }

  const runningCount  = data.workflows.filter(w => w.status === "running").length;
  const breachCount   = data.workflows.filter(w => w.status === "breach" || w.status === "escalated").length;
  const criticalCount = data.workflows.filter(w => w.priority === "critical").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm font-semibold shadow-xl" style={{ background: accentHex }}>
          {toast}
        </div>
      )}

      <div className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accentHex}22`, border: `1px solid ${accentHex}44` }}>
              <span style={{ color: accentHex }}>{icon}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              <p className="text-gray-400 text-xs">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 text-xs font-semibold">{runningCount} Running</span>
            </div>
            {breachCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-xs font-semibold">{breachCount} Escalated</span>
              </div>
            )}
            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1">
                <span className="text-orange-400 text-xs font-semibold">{criticalCount} Critical</span>
              </div>
            )}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-gray-500 text-xs">Refreshed {lastRefresh.toLocaleTimeString()}</span>
              <button
                onClick={() => setAutoRefresh(a => !a)}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{ borderColor: autoRefresh ? `${accentHex}66` : "#374151", color: autoRefresh ? accentHex : "#6b7280" }}
              >
                {autoRefresh ? "⟳ Live" : "⟳ Paused"}
              </button>
              <button onClick={fetchData} className="text-xs px-3 py-1 rounded text-white font-semibold transition-opacity hover:opacity-80" style={{ background: accentHex }}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {data.kpis.map((k, i) => <KPICard key={i} kpi={k} hex={accentHex} />)}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: accentHex }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Live Workflow Queue</h2>
                <p className="text-gray-400 text-xs">{data.workflows.length} workflows · SLA progress tracked</p>
              </div>
              <span className="text-xs text-gray-500">{data.workflows.filter(w => w.status === "complete").length} complete</span>
            </div>
            <div className="divide-y divide-gray-800">
              {data.workflows.map(wf => <WorkflowRow key={wf.id} wf={wf} />)}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Pending Approvals</h2>
                <p className="text-gray-400 text-xs">{data.approvals.length} require action</p>
              </div>
              {data.approvals.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{data.approvals.length}</span>
              )}
            </div>
            {data.approvals.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">No pending approvals</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.approvals.map(a => <ApprovalRow key={a.id} item={a} onAction={handleAction} hex={accentHex} />)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#3b82f6" }}>
            <h2 className="text-white font-semibold text-sm">Agent Outputs</h2>
            <p className="text-gray-400 text-xs">Real-time AI decisions, analyses, and recommendations</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.agentOutputs.map(o => <AgentOutputCard key={o.id} out={o} />)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#dc2626" }}>
              <div>
                <h2 className="text-white font-semibold text-sm">SLA Breaches</h2>
                <p className="text-gray-400 text-xs">Active breach alerts requiring escalation</p>
              </div>
              {data.slaBreaches.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center animate-pulse">{data.slaBreaches.length}</span>
              )}
            </div>
            {data.slaBreaches.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">✓ No active SLA breaches</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.slaBreaches.map(b => <SLABreachCard key={b.id} breach={b} />)}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700" style={{ borderLeftWidth: 3, borderLeftColor: "#8b5cf6" }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Exception Queue</h2>
                <p className="text-gray-400 text-xs">Flagged issues requiring manual resolution</p>
              </div>
              {data.exceptions.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">{data.exceptions.length}</span>
              )}
            </div>
            {data.exceptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">✓ No active exceptions</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.exceptions.map(e => <ExceptionCard key={e.id} ex={e} />)}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-gray-600 text-xs pb-4">
          {title} · Kontra Platform · Last updated {lastRefresh.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
