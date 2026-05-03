import { useState } from "react";
import { useServicingContext } from "./ServicingContext";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

type EscrowLine = { label: string; annual: number; monthly: number; nextDue: string; status: "funded" | "watch" | "short" };
type EscrowTx  = { date: string; type: string; amount: number; balance: number; note: string };

type LoanEscrow = {
  loan_ref: string;
  borrower: string;
  property: string;
  type: string;
  balance: number;
  current_escrow_balance: number;
  required_reserve: number;
  projected_shortage: number;
  shortage_date: string;
  reconciliation_status: "clean" | "shortage" | "watch";
  lines: EscrowLine[];
  transactions: EscrowTx[];
  monthly_contribution: number;
};

const LOANS: LoanEscrow[] = [
  {
    loan_ref: "LN-2847",
    borrower: "Cedar Grove Partners",
    property: "The Meridian Apartments",
    type: "Multifamily",
    balance: 4_112_500,
    current_escrow_balance: 89_400,
    required_reserve: 131_500,
    projected_shortage: 42_100,
    shortage_date: "2026-09-15",
    reconciliation_status: "shortage",
    monthly_contribution: 10_958,
    lines: [
      { label: "Real Estate Taxes",  annual: 48_200, monthly: 4_017, nextDue: "2026-06-15", status: "watch" },
      { label: "Property Insurance", annual: 18_400, monthly: 1_533, nextDue: "2026-07-01", status: "funded" },
      { label: "Replacement Reserves", annual: 7_200, monthly: 600, nextDue: "2026-05-01", status: "funded" },
      { label: "Flood Insurance",    annual: 8_300,  monthly: 692,  nextDue: "2026-08-15", status: "watch" },
      { label: "Ground Rent",        annual: 26_900, monthly: 2_242, nextDue: "2026-06-01", status: "short" },
    ],
    transactions: [
      { date: "2026-04-01", type: "Borrower deposit",      amount: +10_958, balance: 89_400, note: "Apr 2026 monthly escrow" },
      { date: "2026-03-15", type: "Insurance premium",     amount: -18_400, balance: 78_442, note: "Annual HO policy renewal" },
      { date: "2026-03-01", type: "Borrower deposit",      amount: +10_958, balance: 96_842, note: "Mar 2026 monthly escrow" },
      { date: "2026-02-01", type: "Borrower deposit",      amount: +10_958, balance: 85_884, note: "Feb 2026 monthly escrow" },
      { date: "2026-01-15", type: "Real estate tax",       amount: -32_000, balance: 74_926, note: "Q1 2026 tax installment" },
      { date: "2026-01-01", type: "Borrower deposit",      amount: +10_958, balance: 106_926, note: "Jan 2026 monthly escrow" },
    ],
  },
  {
    loan_ref: "LN-3201",
    borrower: "Metro Development LLC",
    property: "Westgate Industrial Park",
    type: "Industrial",
    balance: 5_520_000,
    current_escrow_balance: 218_400,
    required_reserve: 205_000,
    projected_shortage: 0,
    shortage_date: "",
    reconciliation_status: "clean",
    monthly_contribution: 14_342,
    lines: [
      { label: "Real Estate Taxes",   annual: 62_400, monthly: 5_200, nextDue: "2026-06-15", status: "funded" },
      { label: "Property Insurance",  annual: 14_200, monthly: 1_183, nextDue: "2026-09-01", status: "funded" },
      { label: "Replacement Reserves",annual: 9_600,  monthly: 800,   nextDue: "2026-05-01", status: "funded" },
      { label: "Environmental Reserves",annual: 86_400, monthly: 7_200, nextDue: "2026-12-31", status: "funded" },
    ],
    transactions: [
      { date: "2026-04-01", type: "Borrower deposit",   amount: +14_342, balance: 218_400, note: "Apr 2026 monthly escrow" },
      { date: "2026-03-01", type: "Borrower deposit",   amount: +14_342, balance: 204_058, note: "Mar 2026 monthly escrow" },
      { date: "2026-02-15", type: "Real estate tax",    amount: -62_400, balance: 189_716, note: "Q1 2026 tax installment" },
      { date: "2026-02-01", type: "Borrower deposit",   amount: +14_342, balance: 252_116, note: "Feb 2026 monthly escrow" },
      { date: "2026-01-01", type: "Borrower deposit",   amount: +14_342, balance: 237_774, note: "Jan 2026 monthly escrow" },
    ],
  },
  {
    loan_ref: "LN-5593",
    borrower: "Westridge Capital",
    property: "Summit Office Complex",
    type: "Office",
    balance: 6_800_000,
    current_escrow_balance: 312_800,
    required_reserve: 340_000,
    projected_shortage: 27_200,
    shortage_date: "2026-07-01",
    reconciliation_status: "watch",
    monthly_contribution: 22_917,
    lines: [
      { label: "Real Estate Taxes",   annual: 112_400, monthly: 9_367, nextDue: "2026-06-15", status: "watch" },
      { label: "Property Insurance",  annual: 28_800,  monthly: 2_400, nextDue: "2026-11-01", status: "funded" },
      { label: "TI Reserves",         annual: 96_000,  monthly: 8_000, nextDue: "2026-12-31", status: "watch" },
      { label: "Replacement Reserves",annual: 38_400,  monthly: 3_200, nextDue: "2026-05-01", status: "funded" },
    ],
    transactions: [
      { date: "2026-04-01", type: "Borrower deposit",    amount: +22_917, balance: 312_800, note: "Apr 2026 monthly escrow" },
      { date: "2026-03-01", type: "Borrower deposit",    amount: +22_917, balance: 289_883, note: "Mar 2026 monthly escrow" },
      { date: "2026-02-01", type: "Borrower deposit",    amount: +22_917, balance: 266_966, note: "Feb 2026 monthly escrow" },
      { date: "2026-01-15", type: "Real estate tax",     amount: -56_200, balance: 244_049, note: "Semi-annual tax installment" },
      { date: "2026-01-01", type: "Borrower deposit",    amount: +22_917, balance: 300_249, note: "Jan 2026 monthly escrow" },
    ],
  },
  {
    loan_ref: "LN-0728",
    borrower: "Crestwood Logistics",
    property: "Crestwood Distribution Center",
    type: "Industrial",
    balance: 7_100_000,
    current_escrow_balance: 445_200,
    required_reserve: 390_000,
    projected_shortage: 0,
    shortage_date: "",
    reconciliation_status: "clean",
    monthly_contribution: 29_167,
    lines: [
      { label: "Real Estate Taxes",   annual: 148_800, monthly: 12_400, nextDue: "2026-06-15", status: "funded" },
      { label: "Property Insurance",  annual: 38_400,  monthly: 3_200,  nextDue: "2026-08-01", status: "funded" },
      { label: "Replacement Reserves",annual: 24_000,  monthly: 2_000,  nextDue: "2026-05-01", status: "funded" },
      { label: "CapEx Reserves",      annual: 140_000, monthly: 11_667, nextDue: "2026-12-31", status: "funded" },
    ],
    transactions: [
      { date: "2026-04-01", type: "Borrower deposit",  amount: +29_167, balance: 445_200, note: "Apr 2026 monthly escrow" },
      { date: "2026-03-01", type: "Borrower deposit",  amount: +29_167, balance: 416_033, note: "Mar 2026 monthly escrow" },
      { date: "2026-02-15", type: "Insurance premium", amount: -38_400, balance: 386_866, note: "Annual landlord policy" },
      { date: "2026-02-01", type: "Borrower deposit",  amount: +29_167, balance: 425_266, note: "Feb 2026 monthly escrow" },
      { date: "2026-01-01", type: "Borrower deposit",  amount: +29_167, balance: 396_099, note: "Jan 2026 monthly escrow" },
    ],
  },
  {
    loan_ref: "LN-4108",
    borrower: "Oakfield Group",
    property: "Oakfield Retail Plaza",
    type: "Retail",
    balance: 2_800_000,
    current_escrow_balance: 54_600,
    required_reserve: 62_000,
    projected_shortage: 7_400,
    shortage_date: "2026-06-01",
    reconciliation_status: "watch",
    monthly_contribution: 6_167,
    lines: [
      { label: "Real Estate Taxes",   annual: 38_400, monthly: 3_200, nextDue: "2026-06-01", status: "watch" },
      { label: "Property Insurance",  annual: 14_400, monthly: 1_200, nextDue: "2026-10-01", status: "funded" },
      { label: "Replacement Reserves",annual: 21_600, monthly: 1_800, nextDue: "2026-05-01", status: "short" },
    ],
    transactions: [
      { date: "2026-04-01", type: "Borrower deposit",   amount: +6_167, balance: 54_600, note: "Apr 2026 monthly escrow" },
      { date: "2026-03-01", type: "Borrower deposit",   amount: +6_167, balance: 48_433, note: "Mar 2026 monthly escrow" },
      { date: "2026-02-01", type: "Borrower deposit",   amount: +6_167, balance: 42_266, note: "Feb 2026 monthly escrow" },
      { date: "2026-01-15", type: "Real estate tax",    amount: -19_200, balance: 36_099, note: "Q4 2025 tax installment" },
      { date: "2026-01-01", type: "Borrower deposit",   amount: +6_167, balance: 55_299, note: "Jan 2026 monthly escrow" },
    ],
  },
  {
    loan_ref: "LN-1120",
    borrower: "Sunrise Holdings",
    property: "Sunrise Business Park",
    type: "Mixed-Use",
    balance: 3_200_000,
    current_escrow_balance: 108_900,
    required_reserve: 98_000,
    projected_shortage: 0,
    shortage_date: "",
    reconciliation_status: "clean",
    monthly_contribution: 8_250,
    lines: [
      { label: "Real Estate Taxes",   annual: 44_400, monthly: 3_700, nextDue: "2026-06-15", status: "funded" },
      { label: "Property Insurance",  annual: 19_200, monthly: 1_600, nextDue: "2026-07-01", status: "funded" },
      { label: "Replacement Reserves",annual: 18_600, monthly: 1_550, nextDue: "2026-05-01", status: "funded" },
      { label: "Flood Reserve",       annual: 16_800, monthly: 1_400, nextDue: "2026-08-15", status: "funded" },
    ],
    transactions: [
      { date: "2026-04-01", type: "Borrower deposit",  amount: +8_250, balance: 108_900, note: "Apr 2026 monthly escrow" },
      { date: "2026-03-01", type: "Borrower deposit",  amount: +8_250, balance: 100_650, note: "Mar 2026 monthly escrow" },
      { date: "2026-02-01", type: "Borrower deposit",  amount: +8_250, balance: 92_400, note: "Feb 2026 monthly escrow" },
      { date: "2026-01-15", type: "Insurance premium", amount: -19_200, balance: 84_150, note: "Annual policy renewal" },
      { date: "2026-01-01", type: "Borrower deposit",  amount: +8_250, balance: 103_350, note: "Jan 2026 monthly escrow" },
    ],
  },
];

const statusConfig = {
  clean:    { label: "Clean",    icon: <CheckCircleIcon className="h-4 w-4 text-emerald-600" />, bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  watch:    { label: "Watch",    icon: <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />, bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  shortage: { label: "Shortage", icon: <XCircleIcon className="h-4 w-4 text-red-600" />, bg: "bg-red-50 border-red-200", text: "text-red-700" },
};

const lineStatus = {
  funded: { dot: "bg-emerald-500", label: "Funded" },
  watch:  { dot: "bg-amber-500",   label: "Watch"  },
  short:  { dot: "bg-red-500",     label: "Short"  },
};

const fmt = (n: number) =>
  Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function ServicingEscrowPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [selectedRef, setSelectedRef] = useState(LOANS[0].loan_ref);
  const [reconciled, setReconciled] = useState<Record<string, boolean>>({});
  const [cureNotice, setCureNotice] = useState<Record<string, boolean>>({});

  const loan = LOANS.find(l => l.loan_ref === selectedRef) ?? LOANS[0];
  const sc = statusConfig[loan.reconciliation_status];
  const isReconciled = reconciled[loan.loan_ref];
  const cureGenerated = cureNotice[loan.loan_ref];

  const surplusOrShort = loan.current_escrow_balance - loan.required_reserve;

  const handleReconcile = () => {
    setReconciled(prev => ({ ...prev, [loan.loan_ref]: true }));
    logAudit({
      id: `audit-escrow-recon-${loan.loan_ref}-${Date.now()}`,
      action: `Escrow reconciliation — ${loan.loan_ref}`,
      detail: `Balance: ${fmt(loan.current_escrow_balance)} vs required ${fmt(loan.required_reserve)}. ${loan.projected_shortage > 0 ? `Shortage of ${fmt(loan.projected_shortage)} projected ${loan.shortage_date}.` : "No shortage detected."}`,
      timestamp: new Date().toISOString(),
      status: "logged",
    });
    if (loan.projected_shortage > 0) {
      addAlert({
        id: `alert-escrow-${loan.loan_ref}`,
        title: `Escrow shortage — ${loan.loan_ref}`,
        detail: `${fmt(loan.projected_shortage)} projected shortfall by ${loan.shortage_date}. Cure notice ready.`,
        severity: "high",
        category: "Escrow",
      });
      addTask({
        id: `task-escrow-${loan.loan_ref}`,
        title: `Resolve escrow shortage — ${loan.loan_ref}`,
        detail: `${loan.borrower}: ${fmt(loan.projected_shortage)} cure required before ${loan.shortage_date}.`,
        status: "open",
        category: "Escrow",
      });
    }
  };

  const handleCureNotice = () => {
    setCureNotice(prev => ({ ...prev, [loan.loan_ref]: true }));
    requestApproval(
      `Send escrow cure notice — ${loan.loan_ref}`,
      `${loan.borrower}: ${fmt(loan.projected_shortage)} shortage by ${loan.shortage_date}. Cure notice ready for lender approval before delivery.`
    );
  };

  const handleDisbursement = () => {
    requestApproval(
      `Approve escrow disbursement — ${loan.loan_ref}`,
      `${loan.borrower}: scheduled disbursement from escrow balance of ${fmt(loan.current_escrow_balance)}.`
    );
  };

  const totalPortfolioBalance = LOANS.reduce((s, l) => s + l.current_escrow_balance, 0);
  const loansWithShortages = LOANS.filter(l => l.projected_shortage > 0).length;

  return (
    <div className="space-y-5">
      {/* Portfolio KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Portfolio Escrow", value: fmt(totalPortfolioBalance), color: "text-slate-900" },
          { label: "Loans with Shortages",   value: loansWithShortages, color: loansWithShortages > 0 ? "text-red-700" : "text-emerald-700" },
          { label: "Loans Clean",            value: LOANS.filter(l => l.reconciliation_status === "clean").length, color: "text-emerald-700" },
          { label: "Watch / Action",         value: LOANS.filter(l => l.reconciliation_status !== "clean").length, color: "text-amber-700" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Loan selector */}
      <div className="flex flex-wrap gap-2">
        {LOANS.map(l => {
          const s = statusConfig[l.reconciliation_status];
          return (
            <button
              key={l.loan_ref}
              onClick={() => setSelectedRef(l.loan_ref)}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                selectedRef === l.loan_ref
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              {l.loan_ref}
              <span className={`h-2 w-2 rounded-full ${
                l.reconciliation_status === "clean" ? "bg-emerald-500" :
                l.reconciliation_status === "watch" ? "bg-amber-500" : "bg-red-500"
              }`} />
            </button>
          );
        })}
      </div>

      {/* Loan header */}
      <div className={`rounded-xl border p-5 shadow-sm ${sc.bg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {sc.icon}
              <h2 className={`text-lg font-bold ${sc.text}`}>{loan.loan_ref} — {loan.borrower}</h2>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">{loan.property} · {loan.type}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReconcile}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition"
            >
              {isReconciled ? "Re-run Reconciliation" : "Run Reconciliation"}
            </button>
            {loan.projected_shortage > 0 && (
              <button
                onClick={handleCureNotice}
                disabled={cureGenerated}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60 transition"
              >
                <DocumentTextIcon className="h-4 w-4" />
                {cureGenerated ? "Notice Queued" : "Generate Cure Notice"}
              </button>
            )}
            <button
              onClick={handleDisbursement}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Request Disbursement
            </button>
          </div>
        </div>

        {/* Escrow balance summary */}
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Current Balance",     value: fmt(loan.current_escrow_balance),   color: "text-slate-900" },
            { label: "Required Reserve",    value: fmt(loan.required_reserve),          color: "text-slate-700" },
            { label: surplusOrShort >= 0 ? "Surplus" : "Shortfall",
              value: fmt(Math.abs(surplusOrShort)),
              color: surplusOrShort >= 0 ? "text-emerald-700" : "text-red-700" },
            { label: "Monthly Contribution",value: fmt(loan.monthly_contribution),      color: "text-slate-900" },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-white/70 border border-white px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className={`mt-1 text-xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {loan.projected_shortage > 0 && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-800">
            <strong>Shortage Alert:</strong> {fmt(loan.projected_shortage)} projected shortage by {loan.shortage_date}. Cure notice requires lender approval before delivery.
          </div>
        )}
        {isReconciled && loan.reconciliation_status === "clean" && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4" />
            Reconciliation complete — all escrow lines funded through next disbursement date.
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Escrow lines table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Escrow Line Items</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Component</th>
                <th className="px-4 py-3 text-right">Annual</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                <th className="px-4 py-3 text-right">Next Due</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loan.lines.map((line, i) => {
                const ls = lineStatus[line.status];
                return (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{line.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmt(line.annual)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmt(line.monthly)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{line.nextDue}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${ls.dot}`} />
                        <span className="text-xs font-semibold text-slate-600">{ls.label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">Total</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                  {fmt(loan.lines.reduce((s, l) => s + l.annual, 0))}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                  {fmt(loan.lines.reduce((s, l) => s + l.monthly, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Transaction ledger */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Transaction Ledger</p>
          </div>
          <div className="divide-y divide-slate-100">
            {loan.transactions.map((tx, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{tx.type}</p>
                    <p className="text-xs text-slate-400">{tx.note}</p>
                    <p className="text-xs text-slate-400">{tx.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${tx.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {tx.amount < 0 ? "-" : "+"}{fmt(Math.abs(tx.amount))}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">Bal: {fmt(tx.balance)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
