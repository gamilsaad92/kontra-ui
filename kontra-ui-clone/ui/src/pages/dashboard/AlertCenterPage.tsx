/**
 * Portfolio Alert Center — Stage 6
 * Route: /alerts
 *
 * The real-time notification hub for all loan events across the platform.
 * Kontra generates alerts from the servicing engine, covenant monitor, payment
 * processor, secondary market, and document vault — surfacing them here and
 * routing them to the right stakeholder via in-app, email, SMS, or webhook.
 *
 * Alert categories:
 *   Payment     — received, missed, grace period, NSF
 *   Covenant    — breach detected, cure approved, waiver expiry, escalation
 *   Distribution— processed, pending, failed
 *   Market      — new bid, position cleared, new listing
 *   Document    — signature required, expiry approaching, review needed
 *   Inspection  — due, completed, deficiency noted
 *   Regulatory  — filing due, HMDA data, compliance flag
 *   Insurance   — expiry approaching, policy lapsed, renewal received
 */

import { useState } from "react";
import {
  BellIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  BanknotesIcon,
  ShieldExclamationIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  HomeIcon,
  ChartBarIcon,
  CogIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  CheckIcon,
  EyeIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

// ── Types ──────────────────────────────────────────────────────────────────────
type AlertCategory = "payment" | "covenant" | "distribution" | "market" | "document" | "inspection" | "regulatory" | "insurance";
type AlertSeverity = "critical" | "warning" | "info";

interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  loan_ref: string;
  borrower: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  action_label?: string;
  action_route?: string;
}

// ── Demo alerts ───────────────────────────────────────────────────────────────
const INITIAL_ALERTS: Alert[] = [
  {
    id:"AL-048", category:"covenant",     severity:"critical", loan_ref:"LN-4108", borrower:"Oakfield Group",
    title:"Critical: Occupancy Covenant Breach",
    description:"Occupancy dropped to 78% following anchor tenant departure. Cash trap activated per §7.4(b). Cure plan required by May 30, 2026.",
    timestamp:"2026-04-15T14:10:00Z", read:false, action_label:"View Cure Workflow", action_route:"/governance/cure-workflows",
  },
  {
    id:"AL-047", category:"payment",      severity:"info",     loan_ref:"LN-2847", borrower:"Cedar Grove Partners",
    title:"Payment Received — $29,987",
    description:"Monthly interest payment received and applied. Distribution to Senior A, Senior B, and Mezzanine tranches processed automatically.",
    timestamp:"2026-04-01T09:05:00Z", read:false, action_label:"View Servicer Report", action_route:"/reports/engine",
  },
  {
    id:"AL-046", category:"payment",      severity:"info",     loan_ref:"LN-3201", borrower:"Metro Development LLC",
    title:"Payment Received — $41,270",
    description:"Monthly interest payment received and applied. Distribution to Senior A, Senior B, and Mezzanine tranches processed.",
    timestamp:"2026-04-01T09:03:00Z", read:false, action_label:"View Servicer Report", action_route:"/reports/engine",
  },
  {
    id:"AL-045", category:"market",       severity:"info",     loan_ref:"LN-2847", borrower:"Cedar Grove Partners",
    title:"New Bid on Secondary Market — POS-001",
    description:"Summit Yield Partners submitted a bid of 97.00 / par (implied yield: 8.76%) for $484,500 Senior B position on LN-2847.",
    timestamp:"2026-04-19T14:22:00Z", read:false, action_label:"View Position", action_route:"/markets/secondary",
  },
  {
    id:"AL-044", category:"distribution", severity:"info",     loan_ref:"LN-2847", borrower:"Cedar Grove Partners",
    title:"Investor Distributions Processed — $29,987",
    description:"April 2026 distributions processed via USDC. Apex Institutional Fund: $7,250 · Meridian Life: $5,176 · Cornerstone: $5,313 · Harbor Bridge: $3,431 · Redwood Mezz: $5,656.",
    timestamp:"2026-04-01T09:10:00Z", read:true, action_label:"View Statement", action_route:"/reports/engine",
  },
  {
    id:"AL-043", category:"covenant",     severity:"warning",  loan_ref:"LN-3201", borrower:"Metro Development LLC",
    title:"Cure Plan Under Review — CW-002",
    description:"Metro Development's NOI Improvement Plan is under lender review. Primary tenant lease renewal term sheet requested. Response due April 30.",
    timestamp:"2026-04-10T11:30:00Z", read:true, action_label:"Review Cure Plan", action_route:"/governance/cure-workflows",
  },
  {
    id:"AL-042", category:"covenant",     severity:"warning",  loan_ref:"LN-2847", borrower:"Cedar Grove Partners",
    title:"Covenant Waiver — 73 Days Remaining",
    description:"DSCR waiver (Amendment #1) expires June 30, 2026. DSCR must recover to ≥ 1.25x or borrower must request extension by June 15.",
    timestamp:"2026-04-18T08:00:00Z", read:true, action_label:"View Waiver", action_route:"/governance/cure-workflows",
  },
  {
    id:"AL-041", category:"covenant",     severity:"critical", loan_ref:"LN-1120", borrower:"Sunrise Holdings",
    title:"Escalated to Special Servicing — LN-1120",
    description:"Loan escalated after equity injection deadline missed. Special Servicer engaged. Loan modification or note sale analysis in progress.",
    timestamp:"2026-04-10T15:00:00Z", read:true, action_label:"View Escalation", action_route:"/governance/cure-workflows",
  },
  {
    id:"AL-040", category:"document",     severity:"warning",  loan_ref:"LN-3201", borrower:"Metro Development LLC",
    title:"Insurance Renewal — 28 Days to Expiry",
    description:"Property insurance policy (Farmer's Commercial Bldg Policy #FC-2847-A) expires May 18, 2026. Renewal certificate required in Document Vault.",
    timestamp:"2026-04-20T07:00:00Z", read:false, action_label:"Upload Renewal", action_route:"/document-vault",
  },
  {
    id:"AL-039", category:"regulatory",   severity:"info",     loan_ref:"ALL",     borrower:"Portfolio-Wide",
    title:"Q1 2026 Regulatory Package Ready",
    description:"Q1 2026 HMDA-compatible loan activity register generated. 4 loans, $19.6M total volume. Ready for regulatory submission.",
    timestamp:"2026-04-01T06:10:00Z", read:true, action_label:"View Package", action_route:"/reports/engine",
  },
  {
    id:"AL-038", category:"inspection",   severity:"warning",  loan_ref:"LN-2847", borrower:"Cedar Grove Partners",
    title:"Annual Property Inspection Due — May 15",
    description:"Annual physical inspection due May 15, 2026. Inspector: Apex Property Inspections. Coordinate access with borrower at least 7 days prior.",
    timestamp:"2026-04-12T09:00:00Z", read:true, action_label:"Schedule Inspection", action_route:"/portfolio/loans",
  },
  {
    id:"AL-037", category:"market",       severity:"info",     loan_ref:"LN-3201", borrower:"Metro Development LLC",
    title:"Transaction Cleared — POS-004",
    description:"Senior A position on LN-5593 cleared at 98.25 / par (7.63% yield). $2.05M settled via USDC. Token registry updated.",
    timestamp:"2026-04-17T16:05:00Z", read:true, action_label:"View Transaction", action_route:"/markets/secondary",
  },
  {
    id:"AL-036", category:"distribution", severity:"info",     loan_ref:"LN-3201", borrower:"Metro Development LLC",
    title:"Investor Distributions Processed — $41,270",
    description:"April 2026 distributions processed via USDC. National Bank: $17,500 · Titan Credit: $7,292 · Summit Yield: $5,250 · Bluestone Mezz: $5,208.",
    timestamp:"2026-04-01T09:12:00Z", read:true, action_label:"View Statement", action_route:"/reports/engine",
  },
];

// ── Notification settings ─────────────────────────────────────────────────────
interface DeliveryPref { email: boolean; sms: boolean; webhook: boolean; }
const INITIAL_SETTINGS: Record<AlertCategory, DeliveryPref> = {
  payment:      { email:true,  sms:true,  webhook:true  },
  covenant:     { email:true,  sms:true,  webhook:true  },
  distribution: { email:true,  sms:false, webhook:true  },
  market:       { email:true,  sms:false, webhook:false },
  document:     { email:true,  sms:false, webhook:false },
  inspection:   { email:true,  sms:false, webhook:false },
  regulatory:   { email:true,  sms:false, webhook:false },
  insurance:    { email:true,  sms:true,  webhook:false },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0)  return `${hrs}h ago`;
  return `${mins}m ago`;
}

const CATEGORY_CONFIG: Record<AlertCategory, { label: string; icon: typeof BanknotesIcon; color: string; bg: string }> = {
  payment:      { label:"Payment",      icon:BanknotesIcon,         color:"text-emerald-700", bg:"bg-emerald-100" },
  covenant:     { label:"Covenant",     icon:ShieldExclamationIcon, color:"text-red-700",     bg:"bg-red-100"     },
  distribution: { label:"Distribution", icon:ArrowsRightLeftIcon,   color:"text-violet-700",  bg:"bg-violet-100"  },
  market:       { label:"Market",       icon:ChartBarIcon,          color:"text-blue-700",    bg:"bg-blue-100"    },
  document:     { label:"Document",     icon:DocumentTextIcon,      color:"text-amber-700",   bg:"bg-amber-100"   },
  inspection:   { label:"Inspection",   icon:HomeIcon,              color:"text-slate-700",   bg:"bg-slate-100"   },
  regulatory:   { label:"Regulatory",   icon:ChartBarIcon,          color:"text-indigo-700",  bg:"bg-indigo-100"  },
  insurance:    { label:"Insurance",    icon:ShieldExclamationIcon, color:"text-orange-700",  bg:"bg-orange-100"  },
};

const SEVERITY_CONFIG: Record<AlertSeverity, { dot: string; badge: string }> = {
  critical: { dot:"bg-red-500",     badge:"bg-red-100 text-red-700"     },
  warning:  { dot:"bg-amber-500",   badge:"bg-amber-100 text-amber-700" },
  info:     { dot:"bg-slate-400",   badge:"bg-slate-100 text-slate-600" },
};

export default function AlertCenterPage() {
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [filterCat, setFilterCat] = useState<AlertCategory | "all">("all");
  const [filterSev, setFilterSev] = useState<AlertSeverity | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const unread = alerts.filter(a => !a.read).length;

  const filtered = alerts.filter(a => {
    if (filterCat !== "all" && a.category !== filterCat) return false;
    if (filterSev !== "all" && a.severity !== filterSev) return false;
    if (showUnreadOnly && a.read) return false;
    return true;
  });

  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  const markRead = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));

  const toggleSetting = (cat: AlertCategory, ch: keyof DeliveryPref) => {
    setSettings(s => ({ ...s, [cat]: { ...s[cat], [ch]: !s[cat][ch] } }));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BellAlertIcon className="h-6 w-6 text-slate-700" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                {unread}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Alert Center</h2>
            <p className="text-xs text-slate-500">
              {unread > 0 ? `${unread} unread alert${unread > 1?"s":""} · ` : ""}
              {alerts.length} total events across all loans
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <CheckIcon className="h-4 w-4" />
              Mark all read
            </button>
          )}
          <button onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${showSettings ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            <CogIcon className="h-4 w-4" />
            Delivery Settings
          </button>
        </div>
      </div>

      {/* Delivery settings panel */}
      {showSettings && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-900 mb-4">Alert Delivery Preferences</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="pb-3 text-left w-36">Alert Type</th>
                  <th className="pb-3 text-center w-20">
                    <div className="flex items-center justify-center gap-1"><EnvelopeIcon className="h-3.5 w-3.5" /> Email</div>
                  </th>
                  <th className="pb-3 text-center w-20">
                    <div className="flex items-center justify-center gap-1"><DevicePhoneMobileIcon className="h-3.5 w-3.5" /> SMS</div>
                  </th>
                  <th className="pb-3 text-center w-24">
                    <div className="flex items-center justify-center gap-1"><GlobeAltIcon className="h-3.5 w-3.5" /> Webhook</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Object.keys(settings) as AlertCategory[]).map(cat => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const Icon = cfg.icon;
                  return (
                    <tr key={cat}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`rounded-lg p-1 ${cfg.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                          </div>
                          <span className="text-xs font-semibold text-slate-900">{cfg.label}</span>
                        </div>
                      </td>
                      {(["email","sms","webhook"] as const).map(ch => (
                        <td key={ch} className="py-2.5 text-center">
                          <button onClick={() => toggleSetting(cat, ch)}
                            className={`h-5 w-9 rounded-full transition-colors ${settings[cat][ch] ? "bg-slate-900" : "bg-slate-200"} relative`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${settings[cat][ch] ? "left-4" : "left-0.5"}`} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition">Save Preferences</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">Test Webhook</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FunnelIcon className="h-3.5 w-3.5" />
          <span className="font-semibold">Filter:</span>
        </div>

        {/* Severity filter */}
        <div className="flex gap-1">
          {(["all","critical","warning","info"] as const).map(s => (
            <button key={s} onClick={() => setFilterSev(s)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${filterSev===s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {s !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_CONFIG[s as AlertSeverity].dot}`} />}
              {s === "all" ? "All Severity" : s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-200" />

        {/* Category filter */}
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
          {(["all","payment","covenant","distribution","market","document","inspection","regulatory","insurance"] as const).map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${filterCat===c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {c === "all" ? "All Types" : CATEGORY_CONFIG[c].label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-200" />

        <button onClick={() => setShowUnreadOnly(u => !u)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${showUnreadOnly ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          <EyeIcon className="h-3.5 w-3.5" />
          Unread only {unread > 0 && `(${unread})`}
        </button>
      </div>

      {/* Alert feed */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <BellIcon className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No alerts match your filters</p>
          </div>
        )}

        {filtered.map(alert => {
          const cat = CATEGORY_CONFIG[alert.category];
          const sev = SEVERITY_CONFIG[alert.severity];
          const CatIcon = cat.icon;
          const SevIcon = alert.severity === "critical" ? XCircleIcon : alert.severity === "warning" ? ExclamationTriangleIcon : CheckCircleIcon;

          return (
            <div key={alert.id}
              className={`group relative rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${!alert.read ? "border-l-4 border-l-slate-900 border-r border-t border-b border-slate-200" : "border-slate-200"}`}>
              {/* Unread dot */}
              {!alert.read && (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-slate-900" />
              )}

              <div className="flex items-start gap-3">
                {/* Category icon */}
                <div className={`shrink-0 rounded-xl p-2.5 ${cat.bg}`}>
                  <CatIcon className={`h-4 w-4 ${cat.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${sev.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                      {alert.severity.charAt(0).toUpperCase()+alert.severity.slice(1)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.bg} ${cat.color}`}>
                      {cat.label}
                    </span>
                    {alert.loan_ref !== "ALL" && (
                      <span className="text-[10px] text-slate-400 font-mono">{alert.loan_ref}</span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(alert.timestamp)}</span>
                  </div>

                  <p className={`text-sm font-bold text-slate-900 ${!alert.read ? "" : "opacity-80"}`}>{alert.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{alert.description}</p>

                  <div className="mt-2.5 flex items-center gap-2">
                    {alert.action_label && (
                      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition">
                        {alert.action_label}
                      </button>
                    )}
                    {!alert.read && (
                      <button onClick={() => markRead(alert.id)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition">
                        <CheckIcon className="h-3 w-3" />
                        Mark read
                      </button>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">{alert.id}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {(Object.keys(CATEGORY_CONFIG) as AlertCategory[]).map(cat => {
            const count = alerts.filter(a => a.category === cat).length;
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span>{cfg.label}</span>
                <span className="font-bold text-slate-700">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
