import { useState, useEffect, useCallback } from "react";
  import {
    PlusIcon,
    ArrowPathIcon,
    BuildingOfficeIcon,
    CurrencyDollarIcon,
    ClockIcon,
    ChartBarIcon,
    UsersIcon,
    XMarkIcon,
    CheckCircleIcon,
    FunnelIcon,
  } from "@heroicons/react/24/outline";
  import { resolveApiBase } from "../../lib/api";

  const API = resolveApiBase();

  interface Listing {
    id: string;
    title: string;
    property_type: string;
    location: string;
    offering_type: string;
    loan_amount: number;
    target_raise: number;
    min_investment: number;
    target_yield: number;
    ltv: number;
    term_months: number;
    description: string;
    status: string;
    raised_amount: number;
    fill_pct: number;
    sub_count: number;
    closes_at: string;
    created_at: string;
  }

  const TYPE_COLORS: Record<string, string> = {
    Multifamily: "bg-emerald-100 text-emerald-700",
    Office: "bg-blue-100 text-blue-700",
    Industrial: "bg-violet-100 text-violet-700",
    Retail: "bg-amber-100 text-amber-700",
    "Mixed-Use": "bg-rose-100 text-rose-700",
    Hotel: "bg-orange-100 text-orange-700",
  };

  function fmt$(n: number) {
    if (!n) return "–";
    return n >= 1_000_000 ? "$" + (n / 1_000_000).toFixed(1) + "M" : "$" + n.toLocaleString();
  }
  function daysLeft(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    const d = Math.ceil(diff / 86400000);
    return d <= 0 ? "Closed" : d + "d";
  }

  // ── Create Listing Modal ──────────────────────────────────────────────────────
  function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [form, setForm] = useState({
      title: "", property_type: "Multifamily", location: "",
      offering_type: "Participation", loan_amount: "", target_raise: "",
      min_investment: "100000", target_yield: "", ltv: "", term_months: "24",
      description: "", closes_days: "30",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async () => {
      if (!form.title || !form.loan_amount || !form.target_raise || !form.target_yield)
        return setError("Please fill in all required fields.");
      setLoading(true); setError("");
      try {
        const closes_at = new Date(Date.now() + Number(form.closes_days) * 86400000).toISOString();
        const res = await fetch(`${API}/market/listings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            loan_amount: Number(form.loan_amount),
            target_raise: Number(form.target_raise),
            min_investment: Number(form.min_investment),
            target_yield: Number(form.target_yield),
            ltv: form.ltv ? Number(form.ltv) : null,
            term_months: Number(form.term_months),
            closes_at,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create listing");
        setSuccess(true);
        setTimeout(() => { onCreated(); onClose(); }, 1000);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const Field = ({ label, name, type = "text", placeholder = "", required = false }: any) => (
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={(form as any)[name]}
          onChange={e => set(name, e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-slate-400 focus:outline-none"
        />
      </div>
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto">
        <div className="my-6 w-full max-w-lg rounded-2xl bg-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">List a Deal for Investment</h2>
            <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2"><Field label="Deal Title" name="title" placeholder="e.g. Skyline Multifamily — Denver CO" required /></div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Property Type</label>
              <select value={form.property_type} onChange={e => set("property_type", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none">
                {["Multifamily","Office","Industrial","Retail","Mixed-Use","Hotel"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Field label="Location" name="location" placeholder="City, State" />

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Offering Type</label>
              <select value={form.offering_type} onChange={e => set("offering_type", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none">
                {["Participation","Preferred Equity","Whole Loan Sale","Mezzanine"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Field label="Term (months)" name="term_months" type="number" />

            <Field label="Loan Amount ($)" name="loan_amount" type="number" placeholder="18500000" required />
            <Field label="Target Raise ($)" name="target_raise" type="number" placeholder="6000000" required />
            <Field label="Min Investment ($)" name="min_investment" type="number" />
            <Field label="Target Yield (%)" name="target_yield" type="number" placeholder="9.25" required />
            <Field label="LTV (%)" name="ltv" type="number" placeholder="68.5" />
            <Field label="Closes in (days)" name="closes_days" type="number" />

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
                placeholder="Loan overview, collateral, sponsor profile, highlights..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-300 focus:border-slate-400 focus:outline-none resize-none"
              />
            </div>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            {success && <p className="col-span-2 text-sm font-medium text-emerald-600">Listing created successfully!</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || success}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
              {loading ? "Creating…" : "List Deal"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Listing Card ───────────────────────────────────────────────────────────────
  function ListingCard({ listing, onViewSubs }: { listing: Listing; onViewSubs: () => void }) {
    const typeColor = TYPE_COLORS[listing.property_type] ?? "bg-slate-100 text-slate-600";
    const fillWidth = Math.min(100, listing.fill_pct);
    const fillColor = fillWidth >= 80 ? "bg-emerald-500" : fillWidth >= 40 ? "bg-blue-500" : "bg-slate-400";

    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4 hover:shadow-md transition">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-slate-900">{listing.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{listing.location}</p>
          </div>
          <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColor}`}>{listing.property_type}</span>
        </div>

        {listing.description && (
          <p className="text-xs text-slate-500 line-clamp-2">{listing.description}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-center">
          {[
            { label: "Target Raise", value: fmt$(listing.target_raise) },
            { label: "Target Yield", value: listing.target_yield ? listing.target_yield + "%" : "–" },
            { label: "LTV", value: listing.ltv ? listing.ltv + "%" : "–" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-slate-50 px-2 py-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{fmt$(listing.raised_amount)} raised</span>
            <span>{listing.fill_pct}% funded</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: fillWidth + "%" }} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" />{listing.sub_count} investor{listing.sub_count !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" />{listing.closes_at ? daysLeft(listing.closes_at) : "–"} left</span>
          </div>
          <button onClick={onViewSubs}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
            View Subscriptions
          </button>
        </div>
      </div>
    );
  }

  // ── Main Page ─────────────────────────────────────────────────────────────────
  export default function MarketplacePage() {
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [filter, setFilter] = useState("all");

    const fetchListings = useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/market/listings`);
        const json = await res.json();
        setListings(Array.isArray(json) ? json : []);
      } catch {
        setListings([]);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { fetchListings(); }, [fetchListings]);

    const types = ["all", ...Array.from(new Set(listings.map(l => l.property_type)))];
    const filtered = filter === "all" ? listings : listings.filter(l => l.property_type === filter);

    const totalRaise = listings.reduce((s, l) => s + (l.target_raise || 0), 0);
    const totalRaised = listings.reduce((s, l) => s + (l.raised_amount || 0), 0);
    const totalInvestors = listings.reduce((s, l) => s + (l.sub_count || 0), 0);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Investor Marketplace</h1>
            <p className="mt-1 text-sm text-slate-500">List loan participations and track investor subscriptions across all active deals.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchListings} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
              <ArrowPathIcon className="h-4 w-4" />Refresh
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700">
              <PlusIcon className="h-4 w-4" />List a Deal
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Deals", value: listings.length, color: "text-slate-900", icon: BuildingOfficeIcon },
            { label: "Total Capital Target", value: fmt$(totalRaise), color: "text-blue-600", icon: CurrencyDollarIcon },
            { label: "Capital Committed", value: fmt$(totalRaised), color: "text-emerald-600", icon: ChartBarIcon },
            { label: "Total Investors", value: totalInvestors, color: "text-violet-600", icon: UsersIcon },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition capitalize ${filter === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Listings grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />Loading deals…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <BuildingOfficeIcon className="h-12 w-12 text-slate-200" />
            <p className="font-medium text-slate-500">No active deals</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:underline">List your first deal →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} onViewSubs={() => window.open(`/api/market/listings/${l.id}/subscriptions`, "_blank")} />
            ))}
          </div>
        )}

        {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} onCreated={fetchListings} />}
      </div>
    );
  }
  