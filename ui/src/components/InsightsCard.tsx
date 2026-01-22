import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/apiBase";

const PURPOSE_OPTIONS = [
  { value: "missing_docs", label: "Missing docs" },
  { value: "draw_followup", label: "Draw follow-up" },
  { value: "covenant_breach", label: "Covenant breach" },
  { value: "maturity", label: "Maturity" },
];

type InsightException = {
  code: string;
  severity: string;
  message: string;
  recommended_next_step: string;
};

type LoanInsightsResponse = {
  summary: string;
  key_metrics: Record<string, unknown>;
  exceptions: InsightException[];
  recommended_actions: string[];
  confidence: number;
};

type DraftEmail = {
  subject: string;
  body: string;
  checklist: string[];
};

type DraftWatchlist = {
  watchlist_comment: string;
  evidence_references: string[];
};

type InsightsCardProps = {
  loanId?: string | number | null;
  title?: string;
};

export default function InsightsCard({ loanId, title = "AI Insights" }: InsightsCardProps) {
  const [insights, setInsights] = useState<LoanInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draftEmail, setDraftEmail] = useState<DraftEmail | null>(null);
  const [draftWatchlist, setDraftWatchlist] = useState<DraftWatchlist | null>(null);
  const [purpose, setPurpose] = useState(PURPOSE_OPTIONS[0].value);

  const normalizedLoanId = useMemo(() => {
    if (!loanId) return "";
    return String(loanId).trim();
  }, [loanId]);

  useEffect(() => {
    let active = true;
    if (!normalizedLoanId) {
      setInsights(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/loans/${normalizedLoanId}/insights`);
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setInsights(data);
        } else {
          setInsights(null);
          setError(data?.message || "Unable to load insights.");
        }
      } catch (err) {
        if (!active) return;
        setInsights(null);
        setError("Unable to load insights.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [normalizedLoanId]);

  const handleDraftEmail = async () => {
    if (!normalizedLoanId) return;
    setDraftEmail(null);
    try {
      const res = await fetch(`${API_BASE}/api/loans/${normalizedLoanId}/insights/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraftEmail(data);
      }
    } catch {
      setDraftEmail(null);
    }
  };

  const handleDraftWatchlist = async () => {
    if (!normalizedLoanId) return;
    setDraftWatchlist(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/loans/${normalizedLoanId}/insights/draft-watchlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setDraftWatchlist(data);
      }
    } catch {
      setDraftWatchlist(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {normalizedLoanId ? `Loan ${normalizedLoanId}` : "Enter a loan ID to load insights."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-slate-200 px-2 py-1 text-xs"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          >
            {PURPOSE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDraftEmail}
            className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
            disabled={!normalizedLoanId}
          >
            Draft borrower email
          </button>
          <button
            type="button"
            onClick={handleDraftWatchlist}
            className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
            disabled={!normalizedLoanId}
          >
            Draft watchlist comment
          </button>
        </div>
      </div>

      {loading && <p className="mt-3 text-sm text-slate-500">Loading insights…</p>}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {insights && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Summary</p>
            <div className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {insights.summary}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Exceptions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {insights.exceptions.length === 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  No exceptions
                </span>
              )}
              {insights.exceptions.map((exception) => (
                <span
                  key={exception.code}
                  className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700"
                >
                  {exception.code.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Recommended actions</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {insights.recommended_actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              Confidence: {(insights.confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {draftEmail && (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase text-slate-500">Draft email</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{draftEmail.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{draftEmail.body}</pre>
        </div>
      )}

      {draftWatchlist && (
        <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="text-xs font-semibold uppercase text-slate-500">Draft watchlist note</p>
          <p className="mt-2 text-sm text-slate-700">{draftWatchlist.watchlist_comment}</p>
          {draftWatchlist.evidence_references?.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Evidence: {draftWatchlist.evidence_references.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
