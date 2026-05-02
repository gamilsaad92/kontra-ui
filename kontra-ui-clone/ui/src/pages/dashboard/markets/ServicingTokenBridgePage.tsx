/**
 * Servicing → Token Bridge
 * Shows how servicing events (payment received, covenant breach, cure, watchlist)
 * flow through to token-layer impacts (NAV change, distribution hold, governance trigger)
 */
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type EventType = "payment" | "watchlist" | "cure" | "inspection" | "covenant" | "draw";
type ImpactLevel = "positive" | "negative" | "neutral" | "critical";

interface ServicingEvent {
  id: string;
  date: string;
  loanRef: string;
  loanName: string;
  type: EventType;
  title: string;
  detail: string;
  tokenImpact: {
    level: ImpactLevel;
    headline: string;
    navDelta?: number;
    actions: string[];
  };
}

// ── Demo events ───────────────────────────────────────────────────────────────
const EVENTS: ServicingEvent[] = [
  {
    id: "e1",
    date: "2026-05-01",
    loanRef: "LN-2847",
    loanName: "Meridian Apartments",
    type: "payment",
    title: "May payment received — $153,083",
    detail: "Full PITIA received on time. Interest $112,850 · Tax escrow $22,400 · Insurance $5,800 · Reserve $12,033.",
    tokenImpact: {
      level: "positive",
      headline: "Distribution confirmed for KTRA-2847 holders",
      navDelta: +0.08,
      actions: [
        "NAV updated: $102.73 → $102.81",
        "Distribution of $264,500 queued for May 1 settlement",
        "10,290 token holders notified via HMAC webhook",
        "Governance snapshot updated — DSCR 1.42× maintained",
      ],
    },
  },
  {
    id: "e2",
    date: "2026-04-06",
    loanRef: "LN-3011",
    loanName: "Harbor Point Mixed-Use",
    type: "watchlist",
    title: "Loan placed on Freddie Mac Watchlist — 45d delinquent",
    detail: "Loan failed to make March and April payments. DSCR declined to 0.94×. Freddie Mac §28.3 watchlist notice filed. Asset manager notified.",
    tokenImpact: {
      level: "critical",
      headline: "KTRA-3011 distribution suspended — token NAV revised",
      navDelta: -22.75,
      actions: [
        "NAV revised: $102.00 → $79.25 (−22.3% distressed pricing)",
        "All distributions BLOCKED — cash trap §7.4(b) activated",
        "Governance proposal GV-050 triggered: collateral disposition vote",
        "6,860 KTRA-3011 token holders notified of special servicing status",
        "Transfer restrictions tightened: no new transfers until cure or resolution",
      ],
    },
  },
  {
    id: "e3",
    date: "2026-04-02",
    loanRef: "LN-3204",
    loanName: "Riverview Office Tower",
    type: "covenant",
    title: "DSCR covenant breach — occupancy declined to 81%",
    detail: "Q1 2026 borrower financials show NOI declined 14%. DSCR now 1.18× (floor 1.25×). Occupancy 81% (floor 85%). Servicer initiated cure workflow.",
    tokenImpact: {
      level: "negative",
      headline: "KTRA-3204 distribution put on hold",
      navDelta: -2.18,
      actions: [
        "NAV revised: $102.00 → $99.82 (covenant-breach discount applied)",
        "Distribution HELD — pending DSCR recovery above 1.25× floor",
        "Borrower has 60 days to cure per loan agreement §8.2",
        "8,575 KTRA-3204 token holders notified of hold",
        "Governance proposal GV-049 triggered: reserve threshold adjustment",
      ],
    },
  },
  {
    id: "e4",
    date: "2026-04-01",
    loanRef: "LN-2847",
    loanName: "Meridian Apartments",
    type: "draw",
    title: "Construction draw #4 funded — $340,000",
    detail: "Inspector approved draw request. Funds disbursed to contractor. Project 71% complete, on schedule for Q3 2026 completion.",
    tokenImpact: {
      level: "neutral",
      headline: "KTRA-2847 — draw funded, NAV stable",
      navDelta: 0,
      actions: [
        "Draw recorded against construction escrow — no impact on distributable cash",
        "Project completion % updated in token metadata: 71%",
        "Next scheduled draw: Q2 2026 (estimated $280,000)",
      ],
    },
  },
  {
    id: "e5",
    date: "2026-03-15",
    loanRef: "LN-2741",
    loanName: "Westgate Industrial Park",
    type: "inspection",
    title: "Annual property inspection — no deficiencies",
    detail: "Inspection completed March 14. No deferred maintenance or deficiencies found. Roof replacement reserve adequately funded.",
    tokenImpact: {
      level: "positive",
      headline: "KTRA-2741 — inspection clear, NAV confirmed",
      navDelta: +0.12,
      actions: [
        "Collateral quality score updated: 94/100 (up from 91)",
        "NAV updated: $101.23 → $101.35 (inspection premium applied)",
        "No escrow holdback required — reserve balance adequate",
        "14,945 KTRA-2741 token holders notified of inspection clearance",
      ],
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const EVENT_COLORS: Record<EventType, string> = {
  payment: "bg-emerald-100 text-emerald-700 border-emerald-200",
  watchlist: "bg-red-100 text-red-700 border-red-200",
  cure: "bg-amber-100 text-amber-700 border-amber-200",
  inspection: "bg-blue-100 text-blue-700 border-blue-200",
  covenant: "bg-orange-100 text-orange-700 border-orange-200",
  draw: "bg-slate-100 text-slate-700 border-slate-200",
};
const EVENT_LABELS: Record<EventType, string> = {
  payment: "Payment", watchlist: "Watchlist", cure: "Cure",
  inspection: "Inspection", covenant: "Covenant", draw: "Draw",
};
const IMPACT_STYLES: Record<ImpactLevel, { border: string; bg: string; badge: string; icon: string }> = {
  positive: { border: "border-emerald-200", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", icon: "↑" },
  negative: { border: "border-amber-200", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700", icon: "↓" },
  critical: { border: "border-red-300", bg: "bg-red-50", badge: "bg-red-100 text-red-700", icon: "⛔" },
  neutral: { border: "border-slate-200", bg: "bg-slate-50", badge: "bg-slate-100 text-slate-600", icon: "→" },
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, expanded, onToggle }: { event: ServicingEvent; expanded: boolean; onToggle: () => void }) {
  const impact = IMPACT_STYLES[event.tokenImpact.level];

  return (
    <div className={`rounded-xl border ${impact.border} overflow-hidden shadow-sm`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-5 py-4 ${impact.bg} flex items-start justify-between gap-4`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${impact.badge}`}>
              {impact.icon}
            </div>
            <span className="text-xs text-slate-400">{fmtDate(event.date)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-black font-mono text-slate-500">{event.loanRef}</span>
              <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${EVENT_COLORS[event.type]}`}>
                {EVENT_LABELS[event.type]}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{event.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{event.loanName}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400 mb-0.5">Token impact</p>
          {event.tokenImpact.navDelta !== undefined && event.tokenImpact.navDelta !== 0 ? (
            <span className={`text-sm font-black tabular-nums ${event.tokenImpact.navDelta > 0 ? "text-emerald-600" : "text-red-600"}`}>
              {event.tokenImpact.navDelta > 0 ? "+" : ""}{event.tokenImpact.navDelta.toFixed(2)} NAV
            </span>
          ) : (
            <span className="text-sm text-slate-400 font-medium">NAV neutral</span>
          )}
          <p className="text-xs text-slate-400 mt-1">{expanded ? "▲ collapse" : "▼ details"}</p>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600">{event.detail}</p>

          <div className={`rounded-lg border ${impact.border} ${impact.bg} p-4`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Token-Layer Response</p>
            <p className="text-sm font-bold text-slate-800 mb-3">{event.tokenImpact.headline}</p>
            <ul className="space-y-1.5">
              {event.tokenImpact.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 font-bold text-slate-400">·</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ServicingTokenBridgePage() {
  const [expanded, setExpanded] = useState<string | null>("e1");
  const [filterLoan, setFilterLoan] = useState("all");

  const loans = Array.from(new Set(EVENTS.map(e => e.loanRef)));
  const filtered = filterLoan === "all" ? EVENTS : EVENTS.filter(e => e.loanRef === filterLoan);

  const stats = {
    positive: EVENTS.filter(e => e.tokenImpact.level === "positive").length,
    negative: EVENTS.filter(e => ["negative", "critical"].includes(e.tokenImpact.level)).length,
    loansAffected: new Set(EVENTS.map(e => e.loanRef)).size,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Live Event Feed</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Servicing → Token Bridge</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every servicing event — payment received, covenant breach, inspection, draw — is automatically 
          evaluated for token-layer impact. NAV is updated, distributions are held or released, and token holders 
          are notified via HMAC-signed webhooks. No manual bridge step required.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Positive Events</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{stats.positive}</p>
          <p className="text-xs text-emerald-600 mt-0.5">NAV increase · distribution confirmed</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Negative Events</p>
          <p className="mt-1 text-2xl font-black text-red-700">{stats.negative}</p>
          <p className="text-xs text-red-600 mt-0.5">NAV revised · distribution held</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loans with Events</p>
          <p className="mt-1 text-2xl font-black text-slate-700">{stats.loansAffected}</p>
          <p className="text-xs text-slate-500 mt-0.5">This month</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterLoan("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filterLoan === "all" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          All Loans
        </button>
        {loans.map(ref => (
          <button
            key={ref}
            onClick={() => setFilterLoan(ref)}
            className={`rounded-full px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${filterLoan === ref ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {ref}
          </button>
        ))}
      </div>

      {/* Events */}
      <div className="space-y-3">
        {filtered.map(event => (
          <EventCard
            key={event.id}
            event={event}
            expanded={expanded === event.id}
            onToggle={() => setExpanded(expanded === event.id ? null : event.id)}
          />
        ))}
      </div>

      {/* Architecture note */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
        <p className="text-xs font-semibold text-slate-700 mb-2">How the bridge works</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          When the servicer records a payment, inspection, or covenant event in Kontra, the Tokenization Readiness Agent re-evaluates the loan's token eligibility and NAV. If conditions change (DSCR breach, delinquency, cure), the bridge automatically: (1) updates NAV per ERC-1400 metadata, (2) holds or releases the distribution queue, (3) triggers governance proposals where required by the PSA, and (4) dispatches HMAC-signed webhooks to all token holder wallets. The servicer never manually bridges events — it all flows from the servicing ledger.
        </p>
      </div>
    </div>
  );
}
