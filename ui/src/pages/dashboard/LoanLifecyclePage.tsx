import { useState, useEffect, useCallback } from "react";
  import {
    ArrowRightIcon,
    ChevronRightIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    FunnelIcon,
    CurrencyDollarIcon,
    BuildingOfficeIcon,
    XMarkIcon,
  } from "@heroicons/react/24/outline";
  import { resolveApiBase } from "../../lib/api";

  const API = resolveApiBase();

  // ── Stage config (mirrors backend) ────────────────────────────────────────────
  const STAGES = [
    { id: "origination", label: "Origination",  color: "#6366f1", bg: "bg-indigo-50",   border: "border-indigo-200",  badge: "bg-indigo-100 text-indigo-700"  },
    { id: "approved",    label: "Approved",      color: "#0ea5e9", bg: "bg-sky-50",      border: "border-sky-200",     badge: "bg-sky-100 text-sky-700"        },
    { id: "closing",     label: "Closing",       color: "#8b5cf6", bg: "bg-violet-50",   border: "border-violet-200",  badge: "bg-violet-100 text-violet-700"  },
    { id: "active",      label: "Active",        color: "#22c55e", bg: "bg-emerald-50",  border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700"},
    { id: "watch_list",  label: "Watch List",    color: "#f59e0b", bg: "bg-amber-50",    border: "border-amber-200",   badge: "bg-amber-100 text-amber-700"    },
    { id: "default",     label: "Default",       color: "#ef4444", bg: "bg-red-50",      border: "border-red-200",     badge: "bg-red-100 text-red-700"        },
    { id: "workout",     label: "Workout",       color: "#f97316", bg: "bg-orange-50",   border: "border-orange-200",  badge: "bg-orange-100 text-orange-700"  },
    { id: "reo",         label: "REO",           color: "#dc2626", bg: "bg-rose-50",     border: "border-rose-200",    badge: "bg-rose-100 text-rose-700"      },
    { id: "paid_off",    label: "Paid Off",      color: "#64748b", bg: "bg-slate-50",    border: "border-slate-200",   badge: "bg-slate-100 text-slate-600"    },
  ];

  const STAGE_MAP: Record<string, typeof STAGES[0]> = Object.fromEntries(STAGES.map(s => [s.id, s]));

  const VALID_TRANSITIONS: Record<string, string[]> = {
    origination: ["approved", "paid_off"],
    approved:    ["closing", "origination", "paid_off"],
    closing:     ["active", "approved"],
    active:      ["watch_list", "paid_off"],
    watch_list:  ["active", "default", "workout"],
    default:     ["workout", "reo", "paid_off"],
    workout:     ["active", "reo", "paid_off"],
    reo:         ["paid_off"],
    paid_off:    [],
  };

  interface LoanCard {
    id: string;
    borrower: string;
    amount: number;
    rate: number;
    stage: string;
    risk_score?: number;
    created_at?: string;
  }
  interface Board { [stage: string]: LoanCard[] }

  function fmt$(n: number) {
    if (!n) return "–";
    return n >= 1_000_000 ? "$" + (n/1_000_000).toFixed(1) + "M" : "$" + n.toLocaleString();
  }

  function RiskBadge({ score }: { score?: number }) {
    if (!score) return null;
    const color = score >= 70 ? "bg-emerald-100 text-emerald-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${color}`}>{score}</span>;
  }

  // ── Transition Modal ───────────────────────────────────────────────────────────
  function TransitionModal({
    loan, currentStage, onClose, onDone
  }: {
    loan: LoanCard; currentStage: string;
    onClose: () => void; onDone: (toStage: string) => void;
  }) {
    const valid = VALID_TRANSITIONS[currentStage] ?? [];
    const [toStage, setToStage] = useState(valid[0] ?? "");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
      if (!toStage) return;
      setLoading(true); setError("");
      try {
        const res = await fetch(`${API}/lifecycle/${loan.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_stage: toStage, reason, triggered_by: "manual" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Transition failed");
        onDone(toStage);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Move Loan Stage</h2>
            <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{loan.borrower}</p>
              <p className="text-xs text-slate-500">{fmt$(loan.amount)} · {loan.rate}%</p>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <span className={`rounded-full px-3 py-1 text-xs ${STAGE_MAP[currentStage]?.badge}`}>
                {STAGE_MAP[currentStage]?.label ?? currentStage}
              </span>
              <ArrowRightIcon className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400">new stage below</span>
            </div>

            {valid.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No valid transitions from this stage.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {valid.map(s => (
                  <button
                    key={s}
                    onClick={() => setToStage(s)}
                    className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
                      toStage === s
                        ? `${STAGE_MAP[s]?.border} ${STAGE_MAP[s]?.bg} ${STAGE_MAP[s]?.badge}`
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >{STAGE_MAP[s]?.label ?? s}</button>
                ))}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason / Notes</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. DSCR dropped below 1.0, borrower requesting extension…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-slate-400 focus:outline-none resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!toStage || loading || valid.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Moving…" : "Confirm Transition"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loan Card ──────────────────────────────────────────────────────────────────
  function LoanCardItem({ loan, onTransition }: { loan: LoanCard; onTransition: () => void }) {
    const stage = STAGE_MAP[loan.stage];
    return (
      <div className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition cursor-pointer" onClick={onTransition}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800" title={loan.borrower}>{loan.borrower || "Unknown Borrower"}</p>
            <p className="mt-0.5 text-xs text-slate-500">{fmt$(loan.amount)}{loan.rate ? ` · ${loan.rate}%` : ""}</p>
          </div>
          <RiskBadge score={loan.risk_score} />
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <ChevronRightIcon className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition" />
          <span className="text-xs text-slate-400">Move →</span>
        </div>
      </div>
    );
  }

  // ── Pipeline Column ────────────────────────────────────────────────────────────
  function PipelineColumn({ stage, loans, onTransition }: {
    stage: typeof STAGES[0];
    loans: LoanCard[];
    onTransition: (loan: LoanCard, stage: string) => void;
  }) {
    return (
      <div className="flex w-52 flex-shrink-0 flex-col">
        <div className={`mb-3 rounded-xl border ${stage.border} ${stage.bg} px-3 py-2`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: stage.color }}>{stage.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stage.badge}`}>{loans.length}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "520px" }}>
          {loans.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-400">No loans</p>
            </div>
          ) : (
            loans.map(loan => (
              <LoanCardItem key={loan.id} loan={loan} onTransition={() => onTransition(loan, loan.stage)} />
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Summary Stats ──────────────────────────────────────────────────────────────
  function SummaryBar({ board }: { board: Board }) {
    const allLoans = Object.values(board).flat();
    const total = allLoans.length;
    const totalAum = allLoans.reduce((s, l) => s + (l.amount || 0), 0);
    const atRisk = (board.watch_list?.length || 0) + (board.default?.length || 0) + (board.workout?.length || 0);
    const active = board.active?.length || 0;

    const cards = [
      { label: "Total Loans", value: total, icon: BuildingOfficeIcon, color: "text-slate-800" },
      { label: "Active", value: active, icon: CheckCircleIcon, color: "text-emerald-600" },
      { label: "At-Risk", value: atRisk, icon: ExclamationTriangleIcon, color: "text-amber-600" },
      { label: "Total AUM", value: fmt$(totalAum), icon: CurrencyDollarIcon, color: "text-violet-600" },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            </div>
            <p className={`mt-1 text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
    );
  }

  // ── Main Page ──────────────────────────────────────────────────────────────────
  export default function LoanLifecyclePage() {
    const [board, setBoard] = useState<Board>({});
    const [loading, setLoading] = useState(true);
    const [isFallback, setIsFallback] = useState(false);
    const [transitioning, setTransitioning] = useState<{ loan: LoanCard; stage: string } | null>(null);

    const fetchBoard = useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/lifecycle/board`);
        const json = await res.json();
        setBoard(json.board ?? {});
        setIsFallback(json.fallback === true);
      } catch {
        setBoard({});
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { fetchBoard(); }, [fetchBoard]);

    const handleTransitionDone = (toStage: string) => {
      if (!transitioning) return;
      const { loan, stage: fromStage } = transitioning;
      // Optimistically update board
      setBoard(prev => {
        const next = { ...prev };
        // Remove from old stage
        next[fromStage] = (next[fromStage] ?? []).filter(l => l.id !== loan.id);
        // Add to new stage
        next[toStage] = [{ ...loan, stage: toStage }, ...(next[toStage] ?? [])];
        return next;
      });
      setTransitioning(null);
    };

    return (
      <div>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loan Lifecycle</h1>
            <p className="mt-1 text-sm text-slate-500">
              Visual pipeline for all loans across their servicing lifecycle stages.
              {isFallback && <span className="ml-2 text-amber-600 font-medium">· Showing demo data (connect Supabase to see live loans)</span>}
            </p>
          </div>
          <button onClick={fetchBoard} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm">
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Summary */}
        {!loading && <SummaryBar board={board} />}

        {/* Pipeline Kanban */}
        {loading ? (
          <div className="flex items-center justify-center py-32 text-slate-400 text-sm">
            <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
            Loading loan pipeline…
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {STAGES.map(stage => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  loans={board[stage.id] ?? []}
                  onTransition={(loan, stageId) => setTransitioning({ loan, stage: stageId })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Transition Modal */}
        {transitioning && (
          <TransitionModal
            loan={transitioning.loan}
            currentStage={transitioning.stage}
            onClose={() => setTransitioning(null)}
            onDone={handleTransitionDone}
          />
        )}
      </div>
    );
  }
  