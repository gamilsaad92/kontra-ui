import React, { useEffect, useState, useRef } from "react";
import { NavLink, useInRouterContext, useLocation } from "react-router-dom";
import AmortizationTable from "../components/AmortizationTable";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import AssetForm from "../components/AssetForm";
import AssetsTable from "../components/AssetsTable";
import CollectionForm from "../components/CollectionForm";
import CollectionsTable from "../components/CollectionsTable";
import DelinquencyChart from "../components/DelinquencyChart";
import DrawRequestForm from "../components/DrawRequestForm";
import InspectionForm from "../components/InspectionForm";
import InspectionList from "../components/InspectionList";
import LienWaiverList from "../components/LienWaiverList";
import OlbCouponPage from "./OlbCouponPage";

/**
 * KontraDashboard.tsx — Dark branded layout, wired to backend endpoints (graceful fallbacks)
 * - Uses fetch to your API routes where available (VITE_API_URL respected)
 * - Inline visualizations to avoid extra deps
 * - If an endpoint is missing, panels show placeholders (no crashes)
 */

// Debug helper: logs if rendered outside a <Router>
function RouterTripwire({ name }: { name: string }) {
  const inside = useInRouterContext();
  if (!inside) console.error(`[RouterTripwire] ${name} is rendering outside <Router>`);
  return null;
}

export default function KontraDashboard() {
  const primary = [
    { label: "Overview", path: "/dashboard" },
    { label: "Loans", path: "/dashboard/loans" },
    { label: "Servicing", path: "/dashboard/servicing" },
    { label: "Draws", path: "/dashboard/servicing/draws" },
    { label: "Reports", path: "/dashboard/reports" },
    { label: "OLB Coupon", path: "/dashboard/olb-coupon" },
  ];
  const secondary = ["General", "Details", "Analytics", "Users"];

   // Catalog of backend function file paths surfaced in the dashboard
  const FUNCTION_FILES: Record<string, string[]> = {
    root: [
      "analytics.js",
      "analyze-financials.js",
      "auditLogger.js",
      "billPrediction.js",
      "cache.js",
      "chatServer.js",
      "collabServer.js",
      "communications.js",
      "compliance.js",
      "construction.js",
      "db.js",
      "documentService.js",
      "featureFlags.js",
      "feedback.js",
      "hyperautomation.js",
      "index.js",
      "inspect-review.js",
      "jest.config.js",
      "jobQueue.js",
      "matchingEngine.js",
      "personalization.js",
      "predictiveAnalytics.js",
      "review-property-change.js",
      "setupDb.js",
      "validate-draw.js",
      "voiceBot.js",
      "webhooks.js",
      "worker.js",
      "workerCollections.js",
      "workerReminders.js",
      "workflowStore.js",
    ],
    edge: [
      "fetchTaxBills.js",
      "predictAssetRisk.js",
      "predictLoanRisk.js",
      "predictTroubledRisk.js",
      "summarizeInspection.js",
      "updateAssetValues.js",
    ],
    jobs: ["scoreAssets.js", "scoreLoans.js", "scoreTroubled.js", "sendScheduledReports.js"],
    middlewares: [
      "auditLogger.js",
      "authenticate.js",
      "middleware.js",
      "rateLimit.js",
      "requireOrg.js",
      "requireRole.js",
    ],
    routers: [
      "analytics.js",
      "analyticsShared.js",
      "applications.js",
      "assets.js",
      "compliance.js",
      "dashboard.js",
      "documentReview.js",
      "draws.js",
      "exchange.js",
      "inspections.js",
      "integrations.js",
      "invites.js",
      "loans.js",
      "menu.js",
      "orders.js",
      "organizations.js",
      "otp.js",
      "payments.js",
      "paymentsStripe.js",
      "projects.js",
      "reports.js",
      "restaurant.js",
      "restaurants.js",
      "risk.js",
      "savedSearches.js",
      "servicing.js",
      "siteAnalysis.js",
      "sso.js",
      "subscriptions.js",
      "trades.js",
      "webhookRoutes.js",
    ],
  };

  // API base (uses your VITE_API_URL if present)
  const API_BASE: string = (import.meta as any).env?.VITE_API_URL || "";
  const isServicing = location.pathname.startsWith("/dashboard/servicing");
  const isCoupon = location.pathname === "/dashboard/olb-coupon";
  const currentLabel = isServicing ? "Servicing" : isCoupon ? "OLB Coupon" : "Overview";
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex">
      <RouterTripwire name="KontraDashboard" />

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-red-950 border-r border-red-900">
        <div className="px-4 py-4 border-b border-red-900">
          <div className="text-xl font-bold tracking-tight text-red-200">Kontra</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {primary.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === "/dashboard"}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm transition ${
                  isActive ? "bg-red-800 text-white" : "hover:bg-red-900/70 text-red-200"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-red-900 text-xs text-red-300">Role: Lender</div>
      </aside>

      {/* Main area */}
      <main className="flex-1">
        {/* Top header */}
        <div className="sticky top-0 z-10 backdrop-blur bg-slate-950/70 border-b border-red-900">
          <div className="mx-auto max-w-[1440px] px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Breadcrumbs (simple) */}
              <div className="text-xs text-red-300 flex items-center gap-2">
                <NavLink to="/dashboard" end className="hover:text-red-100">
                  Dashboard
                </NavLink>
                <span>/</span>
               <span className="text-red-200">{currentLabel}</span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-sm text-white">New</button>
                <button className="px-3 py-1.5 rounded-lg border border-red-700 hover:bg-red-900 text-sm text-red-200">Filter</button>
                <button className="px-3 py-1.5 rounded-lg border border-red-700 hover:bg-red-900 text-sm text-red-200">Search</button>
              </div>
            </div>
            {/* Page title */}
           <h1 className="mt-2 text-2xl font-semibold tracking-tight text-red-100">{currentLabel}</h1>
            
            {/* Secondary tabs */}
            <div className="mt-3 flex items-center gap-1 text-sm">
              {secondary.map((s, i) => (
                <button
                  key={s}
                  className={`px-3 py-1.5 rounded-lg border ${
                    i === 0
                      ? "border-red-600 bg-red-800 text-white"
                      : "border-transparent text-red-300 hover:text-red-100 hover:bg-red-900"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {isServicing ? (
          <ServicingTab apiBase={API_BASE} />
              ) : isCoupon ? (
          <OlbCouponPage />
        ) : (
          <div className="mx-auto max-w-[1440px] px-6 py-6 grid grid-cols-12 gap-6">
            {/* Left column */}
            <section className="col-span-12 xl:col-span-7 space-y-6">
              <FilteredDataPanel apiBase={API_BASE} />
              <TimelinePanel apiBase={API_BASE} />
              <ChartPanel apiBase={API_BASE} />
            </section>

            {/* Right column */}
            <section className="col-span-12 xl:col-span-5 space-y-6">
              <BoardPanel apiBase={API_BASE} />
              <MapPanel apiBase={API_BASE} />
              <OlbCouponPanel apiBase={API_BASE} />       
              <RecentActivityPanel apiBase={API_BASE} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// --------------------
// Shared UI Panel
// --------------------
function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-red-900 bg-slate-900/40">
      <div className="px-4 py-3 border-b border-red-900 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-red-200">{title}</h2>
        {right || (
          <button className="text-xs px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900">
            •••
          </button>
        )}
      </div>
      <div className="p-4 text-sm text-red-200">{children}</div>
    </section>
  );
}

function Loader() {
  return <div className="text-xs text-red-300">Loading…</div>;
}

async function tryEndpoints<T = any>(
  base: string,
  paths: string[],
  init?: RequestInit
): Promise<{ data?: T; error?: string }> {
  for (const p of paths) {
    try {
      const res = await fetch(`${base}${p}`, init);
      if (!res.ok) continue;
      const data = (await res.json()) as T;
      return { data };
    } catch {
      // ignore and try next
    }
  }
  return { error: `No data from: ${paths.join(", ")}` };
}

// --------------------
// Panels (wired with fallbacks)
// --------------------
function FilteredDataPanel({ apiBase }: { apiBase: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await tryEndpoints<any[]>(apiBase, [
        "/api/loans", // preferred if available
        "/api/applications",
        "/api/portfolio/overview", // may return array of objects
      ]);
      if (error) setErr(error);
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setRows(arr.slice(0, 10));
    })();
  }, [apiBase]);

  return (
    <Panel title="Filtered Data" right={<span className="text-xs text-red-300">10 rows</span>}>
      {!rows && !err && <Loader />}
      {err && <div className="text-xs text-red-400">{err}</div>}
      {rows && rows.length > 0 ? (
        <TinyTable
          rows={rows}
          cols={guessColumns(rows, ["id", "borrower_name", "status", "amount", "created_at"])}
        />
      ) : (
        !err && <div className="text-xs text-red-300">No rows.</div>
      )}
    </Panel>
  );
}

function TimelinePanel({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await tryEndpoints<any[]>(apiBase, ["/api/activity", "/api/events", "/api/draw-requests"]);
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setItems(arr.slice(0, 8));
    })();
  }, [apiBase]);
  return (
    <Panel title="Timeline">
      {!items ? (
        <Loader />
      ) : (
        <ul className="text-sm space-y-2">
          {items.map((x, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="truncate max-w-[70%]">{prettyLabel(x)}</span>
              <span className="text-xs text-red-300">{prettyTime(x)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ChartPanel({ apiBase }: { apiBase: string }) {
  const [series, setSeries] = useState<number[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await tryEndpoints<any>(apiBase, ["/api/analytics/loan-status", "/api/portfolio/overview"]);
      const s = toSeries(data);
      setSeries(s);
    })();
  }, [apiBase]);
  return (
    <Panel title="Chart">
      {!series ? (
        <Loader />
      ) : (
        <div className="h-40 flex items-end gap-1">
          {series.map((v, i) => (
            <div key={i} className="w-4 bg-red-900 rounded" style={{ height: `${Math.max(5, Math.min(100, v))}%` }} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function BoardPanel({ apiBase }: { apiBase: string }) {
  const [cols, setCols] = useState<Record<string, any[]> | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await tryEndpoints<any[]>(apiBase, ["/api/tasks", "/api/inspections", "/api/draw-requests"]);
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      const grouped: Record<string, any[]> = { Backlog: [], "In Progress": [], Completed: [] };
      for (const r of arr.slice(0, 24)) {
        const st = (r.status || r.state || "Backlog") as string;
        if (/done|complete/i.test(st)) grouped["Completed"].push(r);
        else if (/prog|work|active/i.test(st)) grouped["In Progress"].push(r);
        else grouped["Backlog"].push(r);
      }
      setCols(grouped);
    })();
  }, [apiBase]);
  return (
    <Panel title="Board">
      {!cols ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(cols).map(([col, items]) => (
            <div key={col} className="rounded-lg border border-red-900 bg-slate-900/40">
              <div className="px-3 py-2 border-b border-red-900 text-sm font-medium text-red-200">{col}</div>
              <div className="p-3 space-y-2">
                {items.length === 0 && <div className="text-xs text-red-300">No items</div>}
                {items.slice(0, 6).map((x, i) => (
                  <div key={i} className="rounded-md border border-red-900 bg-slate-900 p-2 text-xs text-red-200 truncate">
                    {prettyLabel(x)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MapPanel({ apiBase }: { apiBase: string }) {
  const [locs, setLocs] = useState<any[] | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (async () => {
      const { data } = await tryEndpoints<any[]>(apiBase, ["/api/properties", "/api/projects", "/api/loans"]);
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setLocs(arr.slice(0, 8));
    })();
  }, [apiBase]);
    const project = (lat: number, lng: number) => {
    const node = mapRef.current;
    const w = node?.clientWidth || 1;
    const h = node?.clientHeight || 1;
    return {
      left: ((lng + 180) / 360) * w,
      top: ((90 - lat) / 180) * h,
    };
  };
  return (
    <Panel title="Map">
      {!locs ? (
        <Loader />
      ) : (
          <>
          <div ref={mapRef} className="relative w-full h-48 mb-2 overflow-hidden rounded">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_-_low_resolution.svg/1024px-World_map_-_low_resolution.svg.png"
              alt="World map"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {locs.map((p, i) => {
              const lat = Number(p?.lat || p?.latitude);
              const lng = Number(p?.lng || p?.longitude);
              if (!isFinite(lat) || !isFinite(lng)) return null;
              const pos = project(lat, lng);
              return (
                <span
                  key={i}
                  className="absolute w-2 h-2 bg-red-500 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{ left: pos.left, top: pos.top }}
                  title={p.address || p.property_address || p.name || prettyLabel(p)}
                />
              );
            })}
          </div>
          <ul className="text-sm space-y-1">
            {locs.map((p, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="truncate max-w-[70%]">
                  {p.address || p.property_address || p.name || prettyLabel(p)}
                </span>
                <span className="text-xs text-red-300">{fmtCoord(p)}</span>
              </li>
            ))}
          </ul>
        </>    
      )}
    </Panel>
  );
}

function OlbCouponPanel({ apiBase }: { apiBase: string }) {
  const [coupon, setCoupon] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/olb-coupon`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (typeof data.coupon === "number") setCoupon(data.coupon);
        else setErr("Invalid response");
      } catch (e) {
        setErr((e as any)?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  return (
    <Panel
      title="OLB Coupon"
      right={
        <NavLink
          to="/dashboard/olb-coupon"
          className="text-xs text-red-300 hover:text-red-100"
        >
          View
        </NavLink>
      }
    >
      {loading ? (
        <Loader />
      ) : coupon !== null ? (
        <div className="text-2xl">{coupon.toFixed(2)}%</div>
      ) : (
        <div className="text-xs text-red-400">{err || "No data"}</div>
      )}
    </Panel>
  );
}

function RecentActivityPanel({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await tryEndpoints<any[]>(apiBase, ["/api/activity", "/api/events", "/api/servicing/activity"]);
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setItems(arr.slice(0, 8));
    })();
  }, [apiBase]);
  return (
    <Panel title="Recent Activity">
      {!items ? (
        <Loader />
      ) : (
        <ul className="text-sm space-y-2">
          {items.map((x, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="truncate max-w-[70%]">{prettyLabel(x)}</span>
              <span className="text-xs text-red-300">{prettyTime(x)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ServicingTab({ apiBase }: { apiBase: string }) {
  const [loanId, setLoanId] = useState("1");
  const [upcoming, setUpcoming] = useState<any[] | null>(null);
  const [projection, setProjection] = useState<any[] | null>(null);
  const [type, setType] = useState("tax");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [assetRefresh, setAssetRefresh] = useState(0);
  const [collectionRefresh, setCollectionRefresh] = useState(0);
  
  useEffect(() => {
    (async () => {
      if (!loanId) return;
      try {
        const u = await fetch(`${apiBase}/api/loans/${loanId}/escrow/upcoming`);
        if (u.ok) {
          const data = await u.json();
          setUpcoming(data.upcoming || []);
        } else setUpcoming([]);
        const p = await fetch(`${apiBase}/api/loans/${loanId}/escrow/projection`);
        if (p.ok) {
          const data = await p.json();
          setProjection(data.projection || []);
        } else setProjection([]);
      } catch {
        setUpcoming([]);
        setProjection([]);
      }
    })();
  }, [loanId, apiBase]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch(`${apiBase}/api/loans/${loanId}/escrow/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: parseFloat(amount) })
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
    } catch {
      setMessage("Payment failed");
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
      <Panel title="Escrow Overview">
        <div className="space-y-3">
          <input
            className="w-full rounded border border-red-900 bg-slate-900/40 px-3 py-2 text-sm"
            placeholder="Loan ID"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
          />
          {upcoming && (
            <ul className="text-sm space-y-1">
              {upcoming.map((u, i) => (
                <li key={i} className="flex justify-between">
                  <span>{u.type}</span>
                  <span>${u.amount}</span>
                  <span className="text-xs text-red-300">{u.due_date}</span>
                </li>
              ))}
            </ul>
          )}
          {projection && projection.length > 0 && (
            <div className="text-xs text-red-300">
              Projection: {projection.length} months loaded
            </div>
          )}
          <form onSubmit={pay} className="flex gap-2 items-center">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded border border-red-900 bg-slate-900/40 px-2 py-1 text-sm"
            >
              <option value="tax">Tax</option>
              <option value="insurance">Insurance</option>
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 rounded border border-red-900 bg-slate-900/40 px-2 py-1 text-sm"
              placeholder="Amount"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-red-800 text-white text-sm"
            >
              Pay
            </button>
          </form>
          {message && <div className="text-xs text-red-300">{message}</div>}
        </div>
      </Panel>
            <Panel title="Amortization">
        <AmortizationTable loanId={loanId} />
      </Panel>
      <Panel title="Analytics">
        <AnalyticsDashboard />
      </Panel>
      <Panel title="Assets">
        <AssetForm onCreated={() => setAssetRefresh((r) => r + 1)} />
        <AssetsTable refresh={assetRefresh} />
      </Panel>
      <Panel title="Collections">
        <CollectionForm onCreated={() => setCollectionRefresh((r) => r + 1)} />
        <CollectionsTable refresh={collectionRefresh} />
      </Panel>
      <Panel title="Delinquency">
        <DelinquencyChart />
      </Panel>
      <Panel title="Draw Request">
        <DrawRequestForm />
      </Panel>
      <Panel title="Inspections">
        <InspectionForm drawId={loanId} />
        <InspectionList projectId={loanId} />
      </Panel>
      <Panel title="Lien Waivers">
        <LienWaiverList filter={{ draw_id: loanId }} />
      </Panel>
    </div>
  );
}

// --------------------
// Tiny table & helpers
// --------------------
function TinyTable({ rows, cols }: { rows: any[]; cols: string[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-red-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/60">
          <tr>
            {cols.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-red-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-slate-900/30">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 text-red-100/90 whitespace-nowrap truncate max-w-[240px]">
                  {toCell((r as any)[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function guessColumns(rows: any[], preferred: string[]): string[] {
  if (!rows || rows.length === 0) return preferred;
  const keys = Object.keys(rows[0]);
  const cols: string[] = [];
  for (const k of preferred) if (keys.includes(k)) cols.push(k);
  for (const k of keys) if (!cols.includes(k)) cols.push(k);
  return cols.slice(0, 6);
}

function toCell(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (v?.toString) return v.toString();
  try {
    return JSON.stringify(v);
  } catch {
    return "—";
  }
}

function prettyLabel(x: any): string {
  return x?.title || x?.name || x?.borrower_name || x?.id || x?.status || "—";
}

function prettyTime(x: any): string {
  const t = x?.created_at || x?.updated_at || x?.timestamp || x?.ts;
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function fmtCoord(p: any): string {
  const lat = p?.lat || p?.latitude;
  const lng = p?.lng || p?.longitude;
  if (lat && lng) return `${lat}, ${lng}`;
  return "";
}

function toSeries(data: any): number[] {
  // very forgiving conversion to a [0..100] series
  if (!data) return [20, 40, 60, 40, 20, 30];
  if (Array.isArray(data) && data.length && typeof data[0] === "number") return data.slice(0, 24);
  const items = Array.isArray((data as any)?.items) ? (data as any).items : Array.isArray(data) ? data : [];
  const nums: number[] = [];
  for (const it of items.slice(0, 24)) {
    const v = Number((it.value ?? it.count ?? it.total ?? it.amount ?? 0) as any);
    nums.push(isFinite(v) ? v : 0);
  }
  if (nums.length === 0) return [25, 35, 45, 55, 65, 50, 40];
  const max = Math.max(...nums, 1);
  return nums.map((n) => Math.round((n / max) * 100));
}
