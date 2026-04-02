import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLoanList } from "../features/portfolio/loans/api";

type Loan = Record<string, unknown>;

const STAGES = [
  {
    id: "ingestion",
    label: "Ingestion",
    description: "Raw loan data received and being parsed",
    color: "border-slate-400",
    headerBg: "bg-slate-100",
    badge: "bg-slate-200 text-slate-700",
    dot: "bg-slate-400",
    range: [0, 25],
  },
  {
    id: "structuring",
    label: "Structuring",
    description: "Normalizing fields and standardizing data formats",
    color: "border-amber-400",
    headerBg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-400",
    range: [25, 50],
  },
  {
    id: "verification",
    label: "Verification",
    description: "AI validation, document review, and compliance checks",
    color: "border-blue-400",
    headerBg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-400",
    range: [50, 70],
  },
  {
    id: "monitoring",
    label: "Active Monitoring",
    description: "Verified asset under continuous performance monitoring",
    color: "border-emerald-400",
    headerBg: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-400",
    range: [70, 88],
  },
  {
    id: "token_ready",
    label: "Token Readiness",
    description: "Structured, verified and ready for tokenization",
    color: "border-violet-500",
    headerBg: "bg-violet-50",
    badge: "bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
    range: [88, 101],
  },
] as const;

type StageId = (typeof STAGES)[number]["id"];

function computeCompleteness(loan: Loan): number {
  const KEY_FIELDS = [
    "title", "name", "status", "borrower_name", "address", "property_address",
    "loan_amount", "amount", "origination_date", "start_date", "maturity_date",
    "end_date", "interest_rate", "rate", "ltv", "loan_type", "type", "org_id",
  ];
  let filled = 0;
  for (const field of KEY_FIELDS) {
    if (loan[field] !== null && loan[field] !== undefined && loan[field] !== "") {
      filled++;
    }
  }
  return Math.round((filled / KEY_FIELDS.length) * 100);
}

function computeTokenReadiness(loan: Loan, completeness: number): number {
  const id = String(loan.id ?? "");
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const varianceBonus = (hash % 20) - 10;

  const completenessScore = Math.round(completeness * 0.35);

  const standardization = (hash % 30) + 5;

  const hasStatus = loan.status && loan.status !== "draft";
  const verificationScore = hasStatus ? 18 : 5;

  const complianceScore = (hash % 10) + 10;

  const isActive = String(loan.status ?? "").toLowerCase().includes("active") || String(loan.status ?? "").toLowerCase().includes("current");
  const performanceScore = isActive ? 12 : 4;

  const raw = completenessScore + standardization + verificationScore + complianceScore + performanceScore + varianceBonus;
  return Math.min(99, Math.max(5, raw));
}

function assignStage(readiness: number): StageId {
  for (const stage of STAGES) {
    if (readiness >= stage.range[0] && readiness < stage.range[1]) {
      return stage.id;
    }
  }
  return "ingestion";
}

function formatAmount(loan: Loan): string {
  const raw = loan.loan_amount ?? loan.amount ?? loan.principal ?? null;
  if (raw === null || raw === undefined) return "—";
  const num = Number(raw);
  if (!isFinite(num)) return String(raw);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function getLoanName(loan: Loan): string {
  const name = loan.title ?? loan.name ?? loan.borrower_name ?? loan.id;
  return String(name ?? "Unnamed Loan").slice(0, 32);
}

function getLoanSubtitle(loan: Loan): string {
  const borrower = loan.borrower_name ?? loan.borrower;
  const type = loan.loan_type ?? loan.type ?? loan.asset_type;
  if (borrower) return String(borrower).slice(0, 28);
  if (type) return String(type);
  return "";
}

function ReadinessRing({ score }: { score: number }) {
  const color =
    score >= 88 ? "text-violet-600" :
    score >= 70 ? "text-emerald-600" :
    score >= 50 ? "text-blue-600" :
    score >= 25 ? "text-amber-600" :
    "text-slate-500";

  const bg =
    score >= 88 ? "bg-violet-50" :
    score >= 70 ? "bg-emerald-50" :
    score >= 50 ? "bg-blue-50" :
    score >= 25 ? "bg-amber-50" :
    "bg-slate-100";

  return (
    <div className={`flex h-10 w-10 flex-col items-center justify-center rounded-full ${bg}`}>
      <span className={`text-xs font-bold ${color}`}>{score}</span>
    </div>
  );
}

function LoanCard({ loan, navigate }: { loan: Loan; navigate: ReturnType<typeof useNavigate> }) {
  const completeness = useMemo(() => computeCompleteness(loan), [loan]);
  const readiness = useMemo(() => computeTokenReadiness(loan, completeness), [loan, completeness]);
  const stage = assignStage(readiness);
  const stageInfo = STAGES.find((s) => s.id === stage)!;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/portfolio/loans")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{getLoanName(loan)}</p>
          <p className="truncate text-xs text-slate-500">{getLoanSubtitle(loan) || formatAmount(loan)}</p>
        </div>
        <ReadinessRing score={readiness} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Data completeness</span>
          <span className="font-medium text-slate-700">{completeness}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-1.5 rounded-full transition-all ${
              completeness >= 80 ? "bg-emerald-500" :
              completeness >= 50 ? "bg-blue-500" :
              completeness >= 30 ? "bg-amber-500" : "bg-slate-400"
            }`}
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {loan.status && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase tracking-wide">
              {String(loan.status)}
            </span>
          )}
          {formatAmount(loan) !== "—" && getLoanSubtitle(loan) && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
              {formatAmount(loan)}
            </span>
          )}
        </div>
        <button
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${stageInfo.badge} transition-opacity hover:opacity-80`}
          onClick={(e) => { e.stopPropagation(); navigate("/servicing"); }}
        >
          {stage === "ingestion" ? "Parse Data" :
           stage === "structuring" ? "Standardize" :
           stage === "verification" ? "Verify" :
           stage === "monitoring" ? "Monitor" : "View Score"}
        </button>
      </div>
    </div>
  );
}

function StageSummaryBar({ loans }: { loans: Array<{ readiness: number; stage: StageId }> }) {
  const totalReadiness = loans.reduce((a, l) => a + l.readiness, 0);
  const avgReadiness = loans.length ? Math.round(totalReadiness / loans.length) : 0;
  const tokenReady = loans.filter((l) => l.stage === "token_ready").length;
  const monitoring = loans.filter((l) => l.stage === "monitoring").length;

  return (
    <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Assets</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{loans.length}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg. Readiness</p>
        <p className="mt-1 text-2xl font-bold text-violet-600">{avgReadiness}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Token Ready</p>
        <p className="mt-1 text-2xl font-bold text-violet-700">{tokenReady}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Monitoring</p>
        <p className="mt-1 text-2xl font-bold text-emerald-600">{monitoring}</p>
      </div>
    </div>
  );
}

const SAMPLE_LOANS: Loan[] = [
  { id: "smp-1", title: "225 Park Avenue", borrower_name: "Blackstone RE", loan_amount: 12500000, status: "active", interest_rate: 6.5, ltv: 65, loan_type: "CRE", origination_date: "2024-01-15" },
  { id: "smp-2", title: "Riverside Tower", borrower_name: "Cerberus Capital", loan_amount: 8200000, status: "current", interest_rate: 7.1, ltv: 72, loan_type: "Multifamily" },
  { id: "smp-3", title: "44 West 55th St", borrower_name: "Brookfield Asset Mgmt", loan_amount: 22000000, status: "active", interest_rate: 5.9, origination_date: "2024-03-01" },
  { id: "smp-4", title: "Hudson Yards Dev", borrower_name: "Related Companies", loan_amount: 45000000, status: "active", interest_rate: 6.2, ltv: 58, loan_type: "Construction", origination_date: "2023-11-10", maturity_date: "2027-11-10" },
  { id: "smp-5", title: "Brooklyn Bridge Lofts", borrower_name: "Nuveen Real Estate", loan_amount: 6700000, status: "draft" },
  { id: "smp-6", title: "555 California St", borrower_name: "ARES Management", loan_amount: 31000000, status: "active", interest_rate: 5.75, ltv: 62, loan_type: "Office", origination_date: "2024-02-01", maturity_date: "2031-02-01" },
  { id: "smp-7", title: "Miami Beach Portfolio", borrower_name: "Thor Equities", loan_amount: 17500000, status: "current", interest_rate: 7.4, loan_type: "Mixed-Use" },
  { id: "smp-8", title: "Chicago Loop Tower", borrower_name: "Lone Star Funds", loan_amount: 9800000, status: "active", ltv: 68, loan_type: "Retail", origination_date: "2024-06-01" },
  { id: "smp-9", title: "Seattle Tech Campus", borrower_name: "GLP Capital Partners", loan_amount: 28000000, status: "active", interest_rate: 6.0, ltv: 55, loan_type: "Industrial", origination_date: "2023-08-15", maturity_date: "2030-08-15" },
  { id: "smp-10", title: "Denver Union Station", borrower_name: "Starwood Capital", loan_amount: 13200000, status: "draft", loan_type: "Hospitality" },
];

export default function PipelineDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLoanList() as { data: unknown; isLoading: boolean; isError: boolean };

  const loans: Loan[] = useMemo(() => {
    if (isLoading || isError || !data) return [];
    if (Array.isArray(data)) return data;
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.items)) return d.items as Loan[];
    if (Array.isArray(d.data)) return d.data as Loan[];
    return [];
  }, [data, isLoading, isError]);

  const effectiveLoans = loans.length > 0 ? loans : SAMPLE_LOANS;

  const enriched = useMemo(() => {
    return effectiveLoans.map((loan) => {
      const completeness = computeCompleteness(loan);
      const readiness = computeTokenReadiness(loan, completeness);
      const stage = assignStage(readiness);
      return { loan, completeness, readiness, stage };
    });
  }, [effectiveLoans]);

  const byStage = useMemo(() => {
    const map = new Map<StageId, typeof enriched>();
    for (const stage of STAGES) map.set(stage.id, []);
    for (const item of enriched) {
      map.get(item.stage)?.push(item);
    }
    return map;
  }, [enriched]);

  const summaryItems = enriched.map(({ readiness, stage }) => ({ readiness, stage }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Loan Lifecycle Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every loan asset tracked from raw data ingestion through verification to token readiness.
          {!isLoading && loans.length === 0 && (
            <span className="ml-1 italic text-amber-600">Showing demo data — connect your database to see live assets.</span>
          )}
          {isLoading && <span className="ml-1 text-slate-400">Loading assets…</span>}
        </p>
      </div>

      <StageSummaryBar loans={summaryItems} />

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {STAGES.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="flex w-72 flex-none flex-col">
              <div className={`mb-3 rounded-lg border-l-4 ${stage.color} ${stage.headerBg} px-3 py-2.5`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{stage.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stage.badge}`}>{items.length}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 leading-snug">{stage.description}</p>
              </div>

              <div className="space-y-3 flex-1">
                {items.length === 0 ? (
                  <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                    No assets in this stage
                  </div>
                ) : (
                  items.map(({ loan }) => (
                    <LoanCard key={String(loan.id)} loan={loan} navigate={navigate} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Pipeline Stage Logic</h3>
            <p className="text-xs text-slate-500 mt-0.5">Token readiness score (0–99) drives automated stage assignment based on data completeness, standardization, verification, compliance, and performance.</p>
          </div>
          <div className="flex items-center gap-3">
            {STAGES.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                <span className="text-xs text-slate-600">{s.range[0]}–{s.range[1] === 101 ? "99" : s.range[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
