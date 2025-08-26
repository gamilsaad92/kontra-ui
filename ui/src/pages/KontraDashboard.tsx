import React, { useEffect, useState } from "react";
import { NavLink, useInRouterContext } from "react-router-dom";

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
    { label: "Draws", path: "/dashboard/draws" },
    { label: "Reports", path: "/dashboard/reports" },
  ];
  const secondary = ["General", "Details", "Analytics", "Users"];

  // API base (uses your VITE_API_URL if present)
  const API_BASE: string = (import.meta as any).env?.VITE_API_URL || "";

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
                <span className="text-red-200">Overview</span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-sm text-white">New</button>
                <button className="px-3 py-1.5 rounded-lg border border-red-700 hover:bg-red-900 text-sm text-red-200">Filter</button>
                <button className="px-3 py-1.5 rounded-lg border border-red-700 hover:bg-red-900 text-sm text-red-200">Search</button>
              </div>
            </div>
            {/* Page title */}
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-red-100">Overview</h1>

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

        {/* Content grid */}
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
            <RecentActivityPanel apiBase={API_BASE} />
          </section>
        </div>
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
  return (
    <Panel title="Map">
      {!locs ? (
        <Loader />
      ) : (
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
