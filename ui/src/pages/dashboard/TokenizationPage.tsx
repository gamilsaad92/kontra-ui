import React, { useState, useEffect, useCallback } from "react";
import {
  CubeTransparentIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  ChartBarIcon,
  UsersIcon,
  ScaleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  FireIcon,
  LockClosedIcon,
  EllipsisHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "";

  const DEMO_STATS = {
    totalTokenPackages:  34,
    activePackages:       5,
    totalTvlUsd:  142_000_000,
    totalInvestors:      28,
    approvedInvestors:   22,
    unreconciledPayments: 0,
  };

  const PIPELINE_STAGES = [
    { label: "Draft",           count: 3,  color: "bg-slate-200",   text: "text-slate-600",   dot: "bg-slate-400"   },
    { label: "Readiness Check", count: 12, color: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-400"    },
    { label: "Token Ready",     count: 8,  color: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
    { label: "In Offering",     count: 4,  color: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500"  },
    { label: "Active",          count: 5,  color: "bg-[#800020]/10",text: "text-[#800020]",   dot: "bg-[#800020]"   },
    { label: "Matured",         count: 2,  color: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400"    },
  ];

const ORG_H = { "X-Org-Id": "demo-org", "Content-Type": "application/json" };

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api/tokenization${path}`, {
    credentials: "include",
    headers: { ...ORG_H, ...(opts.headers as any) },
    ...opts,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(t); }
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  token_ready:  { label: "Token Ready",  color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
  conditional:  { label: "Conditional",  color: "bg-amber-100 text-amber-700",    dot: "bg-amber-400"   },
  not_ready:    { label: "Not Ready",    color: "bg-red-100 text-red-700",        dot: "bg-red-400"     },
  draft:        { label: "Draft",        color: "bg-gray-100 text-gray-600",      dot: "bg-gray-400"    },
  offering:     { label: "Offering",     color: "bg-blue-100 text-blue-700",      dot: "bg-blue-400"    },
  active:       { label: "Active",       color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-400" },
  matured:      { label: "Matured",      color: "bg-indigo-100 text-indigo-700",  dot: "bg-indigo-400"  },
  redeemed:     { label: "Redeemed",     color: "bg-gray-100 text-gray-500",      dot: "bg-gray-300"    },
  pending:      { label: "Pending",      color: "bg-amber-100 text-amber-700",    dot: "bg-amber-400"   },
  approved:     { label: "Approved",     color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-400" },
  cleared:      { label: "Cleared",      color: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-400" },
  flagged:      { label: "Flagged",      color: "bg-red-100 text-red-700",        dot: "bg-red-400"     },
  rejected:     { label: "Rejected",     color: "bg-red-100 text-red-700",        dot: "bg-red-400"     },
  expired:      { label: "Expired",      color: "bg-gray-100 text-gray-500",      dot: "bg-gray-300"    },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ScoreGauge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 85 ? "#10b981" : score >= 65 ? "#f59e0b" : "#ef4444";
  const r = size === "lg" ? 52 : size === "md" ? 38 : 28;
  const stroke = size === "lg" ? 8 : 6;
  const circ = 2 * Math.PI * r;
  const pct  = score / 100;
  const dim  = (r + stroke) * 2;
  const textSize = size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-xs";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <span className={`absolute font-bold ${textSize}`} style={{ color }}>{score}</span>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "blocking")    return <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />;
  if (severity === "conditional") return <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />;
  return <InformationCircleIcon className="w-4 h-4 text-blue-400 shrink-0" />;
}

function formatUsd(n: number | null | undefined, compact = false) {
  if (n == null) return "—";
  if (compact && n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (compact && n >= 1_000) return `$${(n/1_000).toFixed(0)}K`;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return `${Math.floor(d/1000)}s ago`;
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Panel 1: Readiness Assessment ─────────────────────────────────────────────

function ReadinessPanel() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDemo = async () => {
    setLoading(true);
    try { setResult(await apiFetch("/assess/demo")); } catch (err: any) { alert(err.message); }
    setLoading(false);
  };

  useEffect(() => { runDemo(); }, []);

  const DIM_ICONS: Record<string, React.ComponentType<any>> = {
    "Data Completeness": DocumentTextIcon,
    "Servicing History Integrity": ChartBarIcon,
    "Compliance Readiness": ShieldCheckIcon,
    "Covenant Status": ScaleIcon,
    "Legal Document Sufficiency": ClipboardDocumentCheckIcon,
  };
  const DIM_WEIGHTS: Record<string, string> = {
    "Data Completeness": "20%",
    "Servicing History Integrity": "25%",
    "Compliance Readiness": "25%",
    "Covenant Status": "15%",
    "Legal Document Sufficiency": "15%",
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Tokenization Readiness Agent</p>
            <p className="text-sm text-gray-600">5-dimension AI evaluation — validates every CRE loan before token eligibility is granted</p>
          </div>
          <button onClick={runDemo} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40 transition-colors">
            {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
            {loading ? "Assessing..." : "Re-assess LN-0094"}
          </button>
        </div>

        {result && (
          <div className="space-y-5">
            {/* Overall score */}
            <div className="flex items-center gap-6 p-5 rounded-xl bg-gray-50 border border-gray-100">
              <ScoreGauge score={result.score} size="lg" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={result.status} />
                  <span className="text-xs text-gray-500">Overall Score: {result.score}/100</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{result.loanId} — Harbor View Partners LLC</p>
                <p className="text-xs text-gray-500 mt-0.5">Assessed by {result.assessedBy} · {timeAgo(result.assessedAt)}</p>
                <div className="mt-2 space-y-1">
                  {result.recommendations?.map((r: string, i: number) => (
                    <p key={i} className="text-xs text-gray-700"><span className="font-semibold">→</span> {r}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Dimension breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {result.dimensions?.map((dim: any) => {
                const Icon = DIM_ICONS[dim.name] || CubeTransparentIcon;
                const hasBlocking = dim.issues?.some((i: any) => i.severity === "blocking");
                return (
                  <div key={dim.name} className={`p-4 rounded-xl border ${hasBlocking ? "border-red-200 bg-red-50" : dim.score >= 80 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${hasBlocking ? "text-red-500" : dim.score >= 80 ? "text-emerald-500" : "text-amber-500"}`} />
                      <ScoreGauge score={dim.score} size="sm" />
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-tight mb-0.5">{dim.name}</p>
                    <p className="text-xs text-gray-500">Weight: {DIM_WEIGHTS[dim.name]}</p>
                    {dim.issues?.length > 0 && (
                      <p className={`text-xs mt-1 font-semibold ${hasBlocking ? "text-red-600" : "text-amber-600"}`}>
                        {dim.issues.filter((i: any) => i.severity === "blocking").length} blocking · {dim.issues.filter((i: any) => i.severity === "conditional").length} conditional
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Issues */}
            {result.blockingIssues?.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm font-bold text-red-700 mb-2">🚫 {result.blockingIssues.length} Blocking Issues</p>
                <div className="space-y-1.5">
                  {result.blockingIssues.map((issue: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                      <SeverityIcon severity="blocking" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.conditionalIssues?.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm font-bold text-amber-700 mb-2">⚠️ {result.conditionalIssues.length} Conditional Issues</p>
                <div className="space-y-1.5">
                  {result.conditionalIssues.map((issue: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <SeverityIcon severity="conditional" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.status === "token_ready" && (
              <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircleIcon className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">This loan is token-eligible</p>
                  <p className="text-xs text-emerald-700 mt-0.5">All 5 dimensions passed. You can proceed to ERC-1400 package creation and investor onboarding.</p>
                </div>
                <button className="ml-auto px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 shrink-0">Package Asset →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ERC-1400 checklist */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">ERC-1400 Compliance Requirements</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            ["Issuance Controller Set", "Controller has authority for forced transfers"],
            ["Transfer Restrictions Encoded", "canTransfer() checks whitelist before every transfer"],
            ["Offering Document Hash On-Chain", "getDocument() returns IPFS hash of legal offering docs"],
            ["Partition (Tranche) Support", "Senior / mezzanine / equity tranche splits supported"],
            ["transferWithData() Implemented", "AML/KYC calldata passed with every transfer"],
            ["Operator Authorization", "Servicer can act on behalf of token holders"],
            ["Controlled Issuance (Minting)", "Only controller can mint tokens after initial offering"],
            ["Redemption / Burn Support", "Tokens redeemable on payoff or maturity"],
          ].map(([label, desc]) => (
            <div key={label as string} className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Panel 2: Token Registry ───────────────────────────────────────────────────

function TokenRegistry() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch("/packages").then(setTokens).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const PARTITION_COLORS: Record<string, string> = {
    whole_loan: "bg-blue-100 text-blue-700", senior: "bg-emerald-100 text-emerald-700",
    mezzanine: "bg-violet-100 text-violet-700", equity: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Token list */}
        <div className="space-y-3">
          {loading && <div className="text-center py-8 text-gray-400 text-sm"><ArrowPathIcon className="w-6 h-6 animate-spin mx-auto" /></div>}
          {tokens.map((t) => (
            <button key={t.tokenId} onClick={() => setSelected(t === selected ? null : t)}
              className={`w-full text-left p-4 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${selected?.tokenId === t.tokenId ? "border-[#800020]" : "border-gray-200"}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{t.loanNumber}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PARTITION_COLORS[t.partitionType] || "bg-gray-100"}`}>{t.partitionType.replace("_"," ")}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{t.propertyAddress}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-gray-400">Total Value</p><p className="font-bold text-gray-800">{formatUsd(t.totalValueUsd, true)}</p></div>
                <div><p className="text-gray-400">Token Price</p><p className="font-bold text-gray-800">{formatUsd(t.tokenPriceUsd)}</p></div>
                <div><p className="text-gray-400">Tokens Issued</p><p className="font-bold text-gray-800">{t.tokensIssued}/{t.totalTokens}</p></div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Issuance</span><span>{Math.round(t.tokensIssued / t.totalTokens * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#800020] rounded-full" style={{ width: `${Math.round(t.tokensIssued / t.totalTokens * 100)}%` }} />
                </div>
              </div>
            </button>
          ))}
          <button className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors flex items-center justify-center gap-2">
            <PlusIcon className="w-4 h-4" /> Package New Asset
          </button>
        </div>

        {/* Token detail */}
        {selected ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Token Package Detail</p>
              <StatusBadge status={selected.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ["Standard", selected.standard], ["Blockchain", `Ethereum (Chain ${selected.chainId})`],
                ["Contract", `${selected.contractAddress?.slice(0,10)}...${selected.contractAddress?.slice(-6)}`],
                ["Partition", selected.partitionType?.replace("_"," ")],
                ["Total Tokens", selected.totalTokens?.toLocaleString()], ["Token Price", formatUsd(selected.tokenPriceUsd)],
                ["Issued", selected.tokensIssued?.toLocaleString()], ["Outstanding", selected.tokensOutstanding?.toLocaleString()],
                ["LTV", `${((selected.ltv || 0) * 100).toFixed(1)}%`], ["DSCR", selected.dscr?.toFixed(2)],
                ["Interest Rate", `${((selected.interestRate || 0) * 100).toFixed(2)}%`], ["Maturity", selected.maturityDate],
                ["Min Investment", formatUsd(selected.offering?.minInvestment)], ["Hold Period", `${selected.offering?.holdPeriodDays}d`],
                ["Investors", selected.investorCount], ["Transfers", selected.transferCount],
              ].map(([k, v]) => (
                <div key={k as string} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-gray-400 mb-0.5">{k}</p>
                  <p className="font-semibold text-gray-800 truncate">{String(v || "—")}</p>
                </div>
              ))}
            </div>
            <div className="p-3 bg-[#800020]/5 border border-[#800020]/15 rounded-lg">
              <p className="text-xs font-semibold text-[#800020] mb-1">IPFS Document Hash</p>
              <code className="text-xs font-mono text-gray-600 break-all">{selected.ipfsDocumentHash}</code>
            </div>
            <div className="flex gap-2">
              {selected.offering?.allowedJurisdictions?.map((j: string) => (
                <span key={j} className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded text-xs font-semibold text-blue-700">{j}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex items-center justify-center text-center">
            <div>
              <CubeTransparentIcon className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Select a token package to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel 3: Investor Whitelisting ────────────────────────────────────────────

function InvestorWhitelist() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [form, setForm] = useState({ address: "", investorName: "", investorType: "institutional", jurisdiction: "US", accredited: true, maxPositionUsd: "" });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => apiFetch("/whitelist").then(setWallets).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const addWallet = async () => {
    if (!form.address || !form.investorName) return;
    try {
      await apiFetch("/whitelist", { method: "POST", body: JSON.stringify({ ...form, maxPositionUsd: form.maxPositionUsd ? Number(form.maxPositionUsd) : null }) });
      setShowForm(false);
      setForm({ address: "", investorName: "", investorType: "institutional", jurisdiction: "US", accredited: true, maxPositionUsd: "" });
      load();
    } catch (err: any) { alert(err.message); }
  };

  const updateKyc = async (address: string, kycStatus: string, amlStatus: string) => {
    try { await apiFetch(`/whitelist/${address}/kyc`, { method: "PATCH", body: JSON.stringify({ kycStatus, amlStatus }) }); load(); } catch (err: any) { alert(err.message); }
  };

  const TYPE_COLORS: Record<string, string> = {
    institutional: "bg-indigo-100 text-indigo-700", accredited_individual: "bg-blue-100 text-blue-700",
    qualified_purchaser: "bg-violet-100 text-violet-700", family_office: "bg-amber-100 text-amber-700",
    reit: "bg-emerald-100 text-emerald-700", pension_fund: "bg-teal-100 text-teal-700",
  };

  const stats = {
    total: wallets.length,
    approved: wallets.filter(w => w.kycStatus === "approved").length,
    pending: wallets.filter(w => w.kycStatus === "pending").length,
    totalCapacity: wallets.reduce((s, w) => s + (w.maxPositionUsd || 0), 0),
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Total Investors", stats.total], ["KYC Approved", stats.approved], ["Pending KYC", stats.pending], ["Total Capacity", formatUsd(stats.totalCapacity, true)]].map(([l, v]) => (
          <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{l}</p>
            <p className="text-xl font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">{wallets.length} Whitelisted Wallets</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a]">
          <PlusIcon className="w-4 h-4" /> Add Investor
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-[#800020]/20 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-900 mb-3">Whitelist New Investor Wallet</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="0x... wallet address" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30 font-mono" />
            <input value={form.investorName} onChange={e => setForm(f => ({ ...f, investorName: e.target.value }))} placeholder="Investor / Entity Name" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
            <select value={form.investorType} onChange={e => setForm(f => ({ ...f, investorType: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/30">
              {["institutional","accredited_individual","qualified_purchaser","family_office","reit","pension_fund"].map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
            </select>
            <select value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/30">
              {["US","CA","GB","EU","SG","JP","AU","CH","DE","FR"].map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <input value={form.maxPositionUsd} onChange={e => setForm(f => ({ ...f, maxPositionUsd: e.target.value }))} placeholder="Max position (USD, optional)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
            <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer">
              <input type="checkbox" checked={form.accredited} onChange={e => setForm(f => ({ ...f, accredited: e.target.checked }))} className="rounded" />
              <span>Accredited Investor</span>
            </label>
          </div>
          <p className="text-xs text-amber-600 mb-3 flex items-center gap-1"><ExclamationTriangleIcon className="w-4 h-4" />KYC/AML screening starts in pending status. Approve after review.</p>
          <div className="flex gap-2">
            <button onClick={addWallet} className="px-5 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a]">Whitelist Wallet</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Investor","Address","Type","Jurisdiction","KYC","AML","Max Position","Holding","Actions"].map(h => (
                <th key={h} className="text-left font-semibold text-gray-500 px-3 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wallets.map((w, i) => (
              <tr key={w.address} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 0 ? "" : "bg-gray-50/20"}`}>
                <td className="px-3 py-3">
                  <p className="font-semibold text-gray-800 max-w-[120px] truncate">{w.investorName}</p>
                  {w.accredited && <span className="text-xs text-emerald-600 font-semibold">✓ Accredited</span>}
                </td>
                <td className="px-3 py-3 font-mono text-gray-500">{w.address.slice(0,8)}...{w.address.slice(-4)}</td>
                <td className="px-3 py-3"><span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[w.investorType] || "bg-gray-100"}`}>{w.investorType?.replace(/_/g," ")}</span></td>
                <td className="px-3 py-3 font-semibold text-gray-700">{w.jurisdiction}</td>
                <td className="px-3 py-3"><StatusBadge status={w.kycStatus} /></td>
                <td className="px-3 py-3"><StatusBadge status={w.amlStatus} /></td>
                <td className="px-3 py-3 font-semibold text-gray-700">{w.maxPositionUsd ? formatUsd(w.maxPositionUsd, true) : "—"}</td>
                <td className="px-3 py-3 font-semibold text-gray-700">{formatUsd(w.holdingValue, true)}</td>
                <td className="px-3 py-3">
                  {w.kycStatus === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => updateKyc(w.address, "approved", "cleared")} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700">Approve</button>
                      <button onClick={() => updateKyc(w.address, "rejected", "flagged")} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200">Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Panel 4: Transfer Eligibility ────────────────────────────────────────────

function TransferEligibility() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [form, setForm] = useState({ tokenId: "", fromAddress: "", toAddress: "", amount: "10" });
  const [result, setResult] = useState<any>(null);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    Promise.allSettled([apiFetch("/packages"), apiFetch("/whitelist"), apiFetch("/transfers")]).then(([p, w, t]) => {
      if (p.status === "fulfilled") { setTokens(p.value); setForm(f => ({ ...f, tokenId: p.value[0]?.tokenId || "" })); }
      if (w.status === "fulfilled") { setWallets(w.value); }
      if (t.status === "fulfilled") setTransfers(t.value);
    });
  }, []);

  const check = async () => {
    if (!form.tokenId || !form.toAddress) return;
    setChecking(true);
    try { setResult(await apiFetch("/transfer-check", { method: "POST", body: JSON.stringify(form) })); } catch (e: any) { alert(e.message); }
    setChecking(false);
  };

  const ERC_STATUS: Record<number, string> = { 81: "0x51 — Transfer Allowed", 80: "0x50 — Not Authorized", 82: "0x52 — Insufficient Balance" };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-900 mb-4">Transfer Eligibility Check</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Token Package</label>
              <select value={form.tokenId} onChange={e => setForm(f => ({ ...f, tokenId: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/30">
                {tokens.map(t => <option key={t.tokenId} value={t.tokenId}>{t.loanNumber} — {t.partitionType?.replace("_"," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From Address (optional)</label>
              <select value={form.fromAddress} onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/30">
                <option value="">— Minting / no sender —</option>
                {wallets.filter(w => w.kycStatus === "approved").map(w => <option key={w.address} value={w.address}>{w.investorName} ({w.address.slice(0,8)}...)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To Address (recipient)</label>
              <select value={form.toAddress} onChange={e => setForm(f => ({ ...f, toAddress: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#800020]/30">
                <option value="">— Select recipient —</option>
                {wallets.map(w => <option key={w.address} value={w.address}>{w.investorName} ({w.kycStatus}) ({w.address.slice(0,8)}...)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Token Amount</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
            </div>
          </div>
          <button onClick={check} disabled={!form.tokenId || !form.toAddress || checking} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40">
            {checking ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ShieldCheckIcon className="w-4 h-4" />}
            Check Transfer Eligibility
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-xl border ${result.eligible ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.eligible ? <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> : <XCircleIcon className="w-5 h-5 text-red-500" />}
                <p className="text-sm font-bold">{result.eligible ? "Transfer Eligible" : "Transfer Blocked"}</p>
                <code className="text-xs text-gray-500 font-mono ml-auto">{ERC_STATUS[result.statusCode] || `0x${result.statusCode?.toString(16)}`}</code>
              </div>
              {result.reasons?.map((r: string, i: number) => <p key={i} className="text-xs text-red-700 flex items-start gap-1 mb-1"><XCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />{r}</p>)}
              {result.warnings?.map((w: string, i: number) => <p key={i} className="text-xs text-emerald-700 flex items-start gap-1 mb-1"><CheckCircleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}</p>)}
              {result.recipient && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 space-y-0.5">
                  <p>Recipient: <span className="font-semibold">{result.recipient.kycStatus}</span> KYC · <span className="font-semibold">{result.recipient.amlStatus}</span> AML · <span className="font-semibold">{result.recipient.jurisdiction}</span></p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer history */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-700">Transfer History ({transfers.length})</p>
        </div>
        {transfers.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">No transfers yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transfers.slice(0, 15).map((t) => (
              <div key={t.transferId} className="px-4 py-3 flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${t.type === "purchase" ? "bg-blue-100" : t.type === "secondary" ? "bg-violet-100" : "bg-gray-100"}`}>
                  <ArrowRightIcon className={`w-3 h-3 ${t.type === "purchase" ? "text-blue-600" : t.type === "secondary" ? "text-violet-600" : "text-gray-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-xs mb-0.5">
                    <span className="font-mono text-gray-500">{(t.fromAddress || "0x000...0000").slice(0,8)}...</span>
                    <ArrowRightIcon className="w-3 h-3 text-gray-300" />
                    <span className="font-mono text-gray-700 font-semibold">{t.toAddress?.slice(0,8)}...</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span><span className="font-semibold text-gray-700">{t.amount}</span> tokens</span>
                    {t.priceUsd && <span>@ {formatUsd(t.priceUsd)}</span>}
                    {t.stablecoin && <span className="text-emerald-600 font-semibold">{t.stablecoin}</span>}
                    <span className="capitalize">{t.type}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(t.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel 5: Payment Reconciliation ──────────────────────────────────────────

function PaymentReconciliation() {
  const [payments, setPayments] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => { apiFetch("/payments").then(setPayments).catch(() => {}); }, []);

  const reconcile = async (id: string) => {
    try {
      await apiFetch(`/payments/${id}/reconcile`, { method: "PATCH" });
      setPayments(p => p.map(pay => pay.paymentId === id ? { ...pay, reconciled: true, reconciledAt: new Date().toISOString() } : pay));
    } catch (e: any) { alert(e.message); }
  };

  const filtered = filter === "all" ? payments : filter === "reconciled" ? payments.filter(p => p.reconciled) : payments.filter(p => !p.reconciled);
  const totalVolume = payments.reduce((s, p) => s + p.amount, 0);
  const unreconciled = payments.filter(p => !p.reconciled).length;

  const SC_COLORS: Record<string, string> = { USDC: "bg-blue-100 text-blue-700", USDT: "bg-teal-100 text-teal-700", DAI: "bg-amber-100 text-amber-700", PYUSD: "bg-indigo-100 text-indigo-700", EURC: "bg-violet-100 text-violet-700" };
  const TYPE_COLORS: Record<string, string> = { interest: "bg-gray-100 text-gray-600", principal: "bg-blue-100 text-blue-700", payoff: "bg-emerald-100 text-emerald-700", prepayment: "bg-violet-100 text-violet-700", late_fee: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Total Payments", payments.length], ["Total Volume", formatUsd(totalVolume, true)], ["Reconciled", payments.filter(p => p.reconciled).length], ["Unreconciled", unreconciled]].map(([l, v]) => (
          <div key={l as string} className={`bg-white rounded-xl border ${l === "Unreconciled" && Number(v) > 0 ? "border-amber-200" : "border-gray-200"} p-4 shadow-sm`}>
            <p className="text-xs text-gray-500 mb-1">{l}</p>
            <p className={`text-xl font-bold ${l === "Unreconciled" && Number(v) > 0 ? "text-amber-600" : "text-gray-900"}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-2">
        {["all","reconciled","unreconciled"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${filter === f ? "bg-[#800020] text-white" : "bg-white border border-gray-200 text-gray-500 hover:text-gray-700"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Payment ID","Amount","Stablecoin","Type","Period","Tx Hash","Status","Action"].map(h => <th key={h} className="text-left font-semibold text-gray-500 px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.paymentId} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i%2===0?"":"bg-gray-50/20"}`}>
                <td className="px-4 py-3 font-mono text-gray-500">{p.paymentId.slice(0,8)}...</td>
                <td className="px-4 py-3 font-bold text-gray-800">{formatUsd(p.amount)}</td>
                <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded font-semibold ${SC_COLORS[p.stablecoin] || "bg-gray-100"}`}>{p.stablecoin}</span></td>
                <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[p.paymentType] || "bg-gray-100"}`}>{p.paymentType}</span></td>
                <td className="px-4 py-3 text-gray-500">{p.periodStart ? `${p.periodStart} → ${p.periodEnd}` : "—"}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{p.txHash?.slice(0,10)}...</td>
                <td className="px-4 py-3">
                  {p.reconciled ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircleIcon className="w-3.5 h-3.5" />Reconciled</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold"><ClockIcon className="w-3.5 h-3.5" />Pending</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!p.reconciled && (
                    <button onClick={() => reconcile(p.paymentId)} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold hover:bg-emerald-200">Reconcile</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Panel 6: Secondary Market ─────────────────────────────────────────────────

function SecondaryMarket() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [orderBook, setOrderBook] = useState<any>(null);

  useEffect(() => {
    apiFetch("/packages").then(tks => {
      setTokens(tks);
      if (tks[0]) { setSelectedTokenId(tks[0].tokenId); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTokenId) return;
    apiFetch(`/secondary-market/${selectedTokenId}`).then(setOrderBook).catch(() => {});
  }, [selectedTokenId]);

  const midPrice = orderBook?.midPrice;
  const bestBid  = orderBook?.bids?.[0]?.priceUsd;
  const bestAsk  = orderBook?.asks?.[0]?.priceUsd;
  const spread   = bestBid && bestAsk ? ((bestAsk - bestBid) / bestAsk * 100).toFixed(2) : null;

  return (
    <div className="space-y-5">
      {tokens.length > 1 && (
        <div className="flex gap-2">
          {tokens.map(t => (
            <button key={t.tokenId} onClick={() => setSelectedTokenId(t.tokenId)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTokenId === t.tokenId ? "bg-[#800020] text-white" : "bg-white border border-gray-200 text-gray-500"}`}>
              {t.loanNumber}
            </button>
          ))}
        </div>
      )}

      {orderBook && (
        <>
          {/* Market metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[["Mid Price", midPrice ? formatUsd(midPrice) : "—"], ["Best Bid", bestBid ? formatUsd(bestBid) : "—"], ["Best Ask", bestAsk ? formatUsd(bestAsk) : "—"], ["Spread", spread ? `${spread}%` : "—"]].map(([l, v]) => (
              <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{l}</p>
                <p className="text-xl font-bold text-gray-900">{v}</p>
              </div>
            ))}
          </div>

          {/* Order book */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-red-50">
                <ArrowUpIcon className="w-4 h-4 text-red-500" />
                <p className="text-xs font-bold text-red-700">Ask Orders (Sell)</p>
                <span className="ml-auto text-xs text-gray-400">{orderBook.asks?.length} orders</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">{["Price (USD)","Amount","Value","Expires"].map(h => <th key={h} className="text-left font-semibold text-gray-500 px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {orderBook.asks?.map((o: any) => (
                    <tr key={o.orderId} className="border-b border-gray-50 hover:bg-red-50/30">
                      <td className="px-3 py-2 font-bold text-red-600">{formatUsd(o.priceUsd)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-700">{o.amount}</td>
                      <td className="px-3 py-2 text-gray-600">{formatUsd(o.totalValueUsd, true)}</td>
                      <td className="px-3 py-2 text-gray-400">{new Date(o.expiry).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!orderBook.asks?.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No sell orders</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-emerald-50">
                <ArrowDownIcon className="w-4 h-4 text-emerald-500" />
                <p className="text-xs font-bold text-emerald-700">Bid Orders (Buy)</p>
                <span className="ml-auto text-xs text-gray-400">{orderBook.bids?.length} orders</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100 bg-gray-50">{["Price (USD)","Amount","Value","Expires"].map(h => <th key={h} className="text-left font-semibold text-gray-500 px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {orderBook.bids?.map((o: any) => (
                    <tr key={o.orderId} className="border-b border-gray-50 hover:bg-emerald-50/30">
                      <td className="px-3 py-2 font-bold text-emerald-600">{formatUsd(o.priceUsd)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-700">{o.amount}</td>
                      <td className="px-3 py-2 text-gray-600">{formatUsd(o.totalValueUsd, true)}</td>
                      <td className="px-3 py-2 text-gray-400">{new Date(o.expiry).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!orderBook.bids?.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No buy orders</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent trades */}
          {orderBook.trades?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-gray-700">Recent Trades</p>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-100">{["From","To","Tokens","Price","Value","Stablecoin","Time"].map(h => <th key={h} className="text-left font-semibold text-gray-500 px-4 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {orderBook.trades.map((t: any) => (
                    <tr key={t.transferId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-mono text-gray-500">{t.fromAddress?.slice(0,8)}...</td>
                      <td className="px-4 py-2 font-mono text-gray-700">{t.toAddress?.slice(0,8)}...</td>
                      <td className="px-4 py-2 font-semibold text-gray-800">{t.amount}</td>
                      <td className="px-4 py-2 font-semibold text-gray-700">{formatUsd(t.priceUsd)}</td>
                      <td className="px-4 py-2 text-gray-600">{formatUsd(t.totalValueUsd, true)}</td>
                      <td className="px-4 py-2"><span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">{t.stablecoin || "—"}</span></td>
                      <td className="px-4 py-2 text-gray-400">{timeAgo(t.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Panel 7: Investor Governance ──────────────────────────────────────────────

function InvestorGovernance() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [votingAs, setVotingAs] = useState("");
  const [voting, setVoting] = useState<Record<string, number | null>>({});

  const load = useCallback(() => {
    Promise.allSettled([apiFetch("/governance/proposals"), apiFetch("/packages"), apiFetch("/whitelist")]).then(([p, t, w]) => {
      if (p.status === "fulfilled") setProposals(p.value);
      if (t.status === "fulfilled") setTokens(t.value);
      if (w.status === "fulfilled") { setWallets(w.value); if (w.value[0]) setVotingAs(w.value[0].address); }
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const castVote = async (proposalId: string, optionId: number) => {
    if (!votingAs) return;
    setVoting(v => ({ ...v, [proposalId]: optionId }));
    try {
      await apiFetch("/governance/vote", { method: "POST", body: JSON.stringify({ proposalId, voterAddress: votingAs, optionId, votingPower: 100 }) });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const PROPOSAL_TYPE_COLORS: Record<string, string> = {
    maturity_extension: "bg-blue-100 text-blue-700", rate_modification: "bg-violet-100 text-violet-700",
    property_disposition: "bg-red-100 text-red-700", servicer_replacement: "bg-amber-100 text-amber-700",
    covenant_waiver: "bg-orange-100 text-orange-700", special_distribution: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <UsersIcon className="w-5 h-5 text-[#800020]" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500">Voting as</p>
          <select value={votingAs} onChange={e => setVotingAs(e.target.value)} className="text-sm font-semibold text-gray-800 bg-transparent border-none focus:outline-none cursor-pointer">
            {wallets.map(w => <option key={w.address} value={w.address}>{w.investorName} ({w.address.slice(0,8)}...)</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-400">{proposals.filter(p => p.status === "active").length} active proposals</p>
      </div>

      {proposals.map((proposal) => {
        const totalVP = proposal.totalVotingPower || 0;
        const token = tokens.find(t => t.tokenId === proposal.tokenId);
        const deadlineDate = new Date(proposal.votingDeadline);
        const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 3600 * 24)));

        return (
          <div key={proposal.proposalId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PROPOSAL_TYPE_COLORS[proposal.type] || "bg-gray-100 text-gray-600"}`}>{proposal.type?.replace(/_/g," ")}</span>
                  <StatusBadge status={proposal.status} />
                  {daysLeft > 0 && <span className="text-xs text-amber-600 font-semibold">{daysLeft}d left</span>}
                </div>
                <p className="text-sm font-bold text-gray-900">{proposal.title}</p>
                {token && <p className="text-xs text-gray-500 mt-0.5">{token.loanNumber} · {token.propertyAddress}</p>}
              </div>
              <div className="text-right text-xs text-gray-500">
                <p className="font-semibold text-gray-700">{totalVP.toLocaleString()} voting power cast</p>
                <p>Quorum: {(proposal.quorumPct * 100).toFixed(0)}%</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">{proposal.description}</p>

            {/* Voting options */}
            <div className="space-y-2 mb-4">
              {proposal.options?.map((opt: any) => {
                const pct = totalVP > 0 ? (opt.votingPower / totalVP) * 100 : 0;
                return (
                  <div key={opt.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700">{opt.label}</span>
                      <span className="text-gray-500">{pct.toFixed(1)}% · {opt.votes} votes</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${opt.id === 0 ? "bg-emerald-400" : opt.id === 1 ? "bg-red-400" : "bg-blue-400"}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {proposal.status === "active" && (
              <div className="flex flex-wrap gap-2">
                {proposal.options?.map((opt: any) => (
                  <button key={opt.id}
                    onClick={() => castVote(proposal.proposalId, opt.id)}
                    disabled={voting[proposal.proposalId] !== undefined}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-40 ${
                      opt.id === 0 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : opt.id === 1 ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    }`}>
                    Vote: {opt.label}
                  </button>
                ))}
                {voting[proposal.proposalId] !== undefined && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600 font-semibold">
                    <CheckCircleIcon className="w-4 h-4" />Vote cast
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {proposals.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <ScaleIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No governance proposals yet</p>
        </div>
      )}
    </div>
  );
}

// ── Dummy import for ClockIcon ────────────────────────────────────────────────

function ClockIcon({ className }: { className: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="1.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6l4 2"/></svg>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TokenizationPage() {
  const [activeTab, setActiveTab] = useState<"readiness"|"registry"|"whitelist"|"transfers"|"payments"|"market"|"governance">("readiness");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { apiFetch("/stats").then(setStats).catch(() => {}); }, []);

  const TABS = [
    { id: "readiness",   label: "Readiness Agent",     icon: CpuChipIcon              },
    { id: "registry",    label: "Token Registry",       icon: CubeTransparentIcon      },
    { id: "whitelist",   label: "Investor Whitelist",   icon: UsersIcon                },
    { id: "transfers",   label: "Transfer Eligibility", icon: ShieldCheckIcon          },
    { id: "payments",    label: "Payment Reconciliation",icon: BanknotesIcon           },
    { id: "market",      label: "Secondary Market",     icon: ChartBarIcon             },
    { id: "governance",  label: "Investor Governance",  icon: ScaleIcon                },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f9f8f6] p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tokenization Platform</h1>
            <p className="text-sm text-gray-500 mt-1">
              Kontra evolves from servicing platform to financial infrastructure.
              Every CRE loan validated, packaged as ERC-1400 security tokens, and governed on-chain by investors.
            </p>
          </div>
        </div>

        {/* Pipeline funnel */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Loan Pipeline</p>
          <div className="flex items-stretch overflow-x-auto pb-1 rounded-xl border border-gray-200 bg-white divide-x divide-gray-100">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.label} className={`flex-1 min-w-[100px] flex flex-col items-center justify-center gap-1.5 px-4 py-4 ${stage.color} ${i === 0 ? "rounded-l-xl" : ""} ${i === PIPELINE_STAGES.length - 1 ? "rounded-r-xl" : ""}`}>
                <div className={`h-2 w-2 rounded-full ${stage.dot}`} />
                <p className={`text-2xl font-bold ${stage.text}`}>{stage.count}</p>
                <p className={`text-xs font-medium ${stage.text} text-center leading-tight`}>{stage.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        {(() => {
          const s = stats || DEMO_STATS;
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Token Packages",    value: s.totalTokenPackages },
                { label: "Active Packages",   value: s.activePackages },
                { label: "Total TVL",         value: formatUsd(s.totalTvlUsd, true) },
                { label: "Total Investors",   value: s.totalInvestors },
                { label: "KYC Approved",      value: s.approvedInvestors },
                { label: "Unreconciled Pmts", value: s.unreconciledPayments, warn: s.unreconciledPayments > 0 },
              ].map((item) => (
                <div key={item.label} className={`bg-white rounded-xl border ${(item as any).warn ? "border-amber-200" : "border-gray-200"} p-4 shadow-sm`}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`text-xl font-bold ${(item as any).warn ? "text-amber-600" : "text-gray-900"}`}>{item.value}</p>
                </div>
              ))}
            </div>
          );
        })()}

      </div>
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === id ? "bg-[#800020] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {activeTab === "readiness"   && <ReadinessPanel />}
        {activeTab === "registry"    && <TokenRegistry />}
        {activeTab === "whitelist"   && <InvestorWhitelist />}
        {activeTab === "transfers"   && <TransferEligibility />}
        {activeTab === "payments"    && <PaymentReconciliation />}
        {activeTab === "market"      && <SecondaryMarket />}
        {activeTab === "governance"  && <InvestorGovernance />}
      </div>
    </div>
  );
}
