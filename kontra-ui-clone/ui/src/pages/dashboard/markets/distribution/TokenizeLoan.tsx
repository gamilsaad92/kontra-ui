import { useState, useEffect, useRef } from "react";
import { api } from "../../../../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface EligibilityCheck {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

interface EligibilityResult {
  loan_ref: string;
  name: string;
  type?: string;
  upb?: number;
  dscr?: number;
  occupancy?: number;
  found: boolean;
  eligible: boolean;
  status: "eligible" | "eligible_with_warnings" | "blocked";
  checks: EligibilityCheck[];
  blocks: string[];
  warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function CheckRow({ check }: { check: EligibilityCheck }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${check.pass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
        {check.pass ? "✓" : "✕"}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${check.pass ? "text-slate-800" : "text-red-700"}`}>{check.label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>
      </div>
    </div>
  );
}

function EligibilityPanel({ result, loading }: { result: EligibilityResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
        <div className="h-3 bg-slate-100 rounded w-full mb-2" />
        <div className="h-3 bg-slate-100 rounded w-5/6 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-4/6" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Eligibility Gate</h3>
        <p className="mt-2 text-sm text-slate-600">
          Enter a loan reference (e.g. <span className="font-mono font-semibold text-indigo-700">LN-3011</span>) above. Kontra will check DSCR, occupancy, delinquency, watchlist status, escrow, and compliance holds in real time before allowing tokenization.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-500">
          <li className="flex gap-2"><span>•</span>DSCR vs covenant floor</li>
          <li className="flex gap-2"><span>•</span>Occupancy vs floor</li>
          <li className="flex gap-2"><span>•</span>Payment current</li>
          <li className="flex gap-2"><span>•</span>Not on watchlist</li>
          <li className="flex gap-2"><span>•</span>Escrow & insurance</li>
          <li className="flex gap-2"><span>•</span>No compliance holds</li>
        </ul>
      </div>
    );
  }

  const isBlocked = result.status === "blocked";
  const hasWarnings = result.status === "eligible_with_warnings";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className={`rounded-xl border p-5 ${isBlocked ? "bg-red-50 border-red-200" : hasWarnings ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{result.loan_ref}</p>
            <h3 className={`mt-0.5 text-base font-bold ${isBlocked ? "text-red-800" : hasWarnings ? "text-amber-800" : "text-emerald-800"}`}>
              {result.found ? result.name : "Loan not in servicing record"}
            </h3>
            {result.found && (
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                {result.type && <span>{result.type}</span>}
                {result.upb && <span>UPB {fmt(result.upb)}</span>}
                {result.dscr && <span>DSCR {result.dscr}×</span>}
                {result.occupancy && <span>Occ. {result.occupancy}%</span>}
              </div>
            )}
          </div>
          <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${isBlocked ? "bg-red-200 text-red-800" : hasWarnings ? "bg-amber-200 text-amber-800" : "bg-emerald-200 text-emerald-800"}`}>
            {isBlocked ? "Blocked" : hasWarnings ? "Eligible ⚠" : "Eligible ✓"}
          </span>
        </div>

        {/* Blocks */}
        {result.blocks.length > 0 && (
          <div className="mt-4 rounded-lg bg-red-100 border border-red-200 p-3 space-y-1">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Tokenization blocked — resolve first:</p>
            {result.blocks.map((b, i) => (
              <p key={i} className="text-xs text-red-700 flex gap-1.5"><span>⛔</span>{b}</p>
            ))}
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-100 border border-amber-200 p-3 space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-800 flex gap-1.5"><span>⚠</span>{w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Checks */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Servicing gate checks</h4>
        <div className="divide-y divide-slate-100">
          {result.checks.map(c => <CheckRow key={c.key} check={c} />)}
        </div>
      </div>

      {/* Freddie Mac note */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Per <span className="font-semibold">Freddie Mac Multifamily Servicing Guide §9.2</span>, tokenization of servicing interests requires all covenant thresholds to be met and no active watchlist or compliance holds at time of mint.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TokenizeLoan() {
  const [loanRef, setLoanRef] = useState("");
  const [assetType, setAssetType] = useState("loan");
  const [tokenSymbol, setTokenSymbol] = useState("CRDT");
  const [tokenName, setTokenName] = useState("Credit Token");
  const [chain, setChain] = useState("testnet");
  const [totalSupply, setTotalSupply] = useState(1000000);

  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch eligibility whenever loanRef changes (debounced 600ms)
  useEffect(() => {
    const ref = loanRef.trim().toUpperCase();
    if (!ref.match(/^LN-?\d+$/i) && ref.length < 4) {
      setEligibility(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setEligibilityLoading(true);
      setEligibility(null);
      setSubmitStatus(null);
      try {
        const res = await api.get(`/copilot/tokenization-eligibility?loan_ref=${encodeURIComponent(ref)}`);
        setEligibility(res.data);
      } catch {
        setEligibility(null);
      } finally {
        setEligibilityLoading(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loanRef]);

  const canSubmit = eligibility?.eligible === true && !submitLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitLoading(true);
    setSubmitStatus(null);
    try {
      const metadata = {
        collateral_summary: { type: eligibility?.type || "Multifamily", occupancy: `${eligibility?.occupancy ?? "N/A"}%` },
        servicing_status: { status: "Current", servicer: "Kontra Servicing" },
        dscr_noi_history: eligibility?.dscr ? [{ period: "Q1 2025", dscr: eligibility.dscr }] : [],
        escrow: { taxes: "current", insurance: "current" },
        inspections: [],
        hazard_loss: [],
        covenant_exceptions: [],
      };
      const response = await api.post("/market/tokenize", {
        loan_id: Number(loanRef.replace(/\D/g, "")),
        asset_type: assetType,
        token_symbol: tokenSymbol,
        token_name: tokenName,
        chain,
        total_supply: totalSupply,
        metadata,
      });
      setSubmitStatus(`✓ Draft token created: ${response.data.tokenized_asset?.id ?? "pending"} — awaiting compliance approval before mint`);
    } catch (err: any) {
      setSubmitStatus(err?.response?.data?.message || "Unable to create tokenized asset");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* Left column — form */}
      <div className="space-y-6">
        {/* Step A */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step A · Select loan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the servicing loan reference. Kontra checks all covenant thresholds in real time before allowing tokenization.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={loanRef}
              onChange={e => setLoanRef(e.target.value)}
              placeholder="e.g. LN-3011"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
            {eligibilityLoading && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 px-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Checking…
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">Try: LN-3011 (blocked) · LN-3204 (blocked) · LN-2847 (eligible)</p>
        </div>

        {/* Step B */}
        <div className={`rounded-xl border bg-white p-6 shadow-sm transition-opacity ${!eligibility?.eligible ? "opacity-40 pointer-events-none" : ""}`}>
          <h2 className="text-lg font-semibold text-slate-900">Step B · Token terms</h2>
          {!eligibility?.eligible && eligibility !== null && (
            <p className="mt-1 text-xs text-red-600 font-medium">Resolve servicing issues above before configuring token terms.</p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Asset type
              <select value={assetType} onChange={e => setAssetType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="loan">Whole loan</option>
                <option value="tranche">Tranche</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Chain
              <select value={chain} onChange={e => setChain(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
                <option value="solana">Solana</option>
                <option value="testnet">Testnet</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Token symbol
              <input type="text" value={tokenSymbol} onChange={e => setTokenSymbol(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="text-sm text-slate-600">
              Token name
              <input type="text" value={tokenName} onChange={e => setTokenName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="text-sm text-slate-600">
              Total supply
              <input type="number" value={totalSupply} onChange={e => setTotalSupply(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
            </label>
          </div>
        </div>

        {/* Step C */}
        <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-opacity ${!eligibility?.eligible ? "opacity-40 pointer-events-none" : ""}`}>
          <h2 className="text-lg font-semibold text-slate-900">Step C · Create draft</h2>
          <p className="mt-1 text-sm text-slate-600">
            Drafts stay off-chain until compliance approval and final mint. No offering can list without approvals, disclosures, and whitelist assignment.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${canSubmit ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-300 cursor-not-allowed"}`}
          >
            {submitLoading ? "Creating…" : eligibility?.eligible ? "Create tokenized asset" : "Tokenization blocked"}
          </button>
          {submitStatus && (
            <p className={`mt-3 text-sm ${submitStatus.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>{submitStatus}</p>
          )}
        </div>
      </div>

      {/* Right column — live eligibility panel */}
      <div className="space-y-4">
        <EligibilityPanel result={eligibility} loading={eligibilityLoading} />
      </div>
    </div>
  );
}
