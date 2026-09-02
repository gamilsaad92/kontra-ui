/**
 * CRE Loan Marketplace — Secondary market listings and capital matching
 * Route: /marketplace (Lender portal)
 *
 * Displays available loan pools, whole loan sales, and participation
 * opportunities from the Kontra network. Lenders can list loans for
 * sale and bid on opportunities.
 */

import { useState } from "react";
import {
  BuildingOffice2Icon,
  BanknotesIcon,
  MapPinIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

interface Listing {
  id: string;
  type: "whole_loan" | "participation" | "pool";
  title: string;
  property_type: string;
  location: string;
  loan_amount: number;
  available_amount: number;
  rate: number;
  ltv: number;
  dscr: number;
  maturity: string;
  status: "available" | "under_offer" | "closed";
  listed_at: string;
  seller: string;
}

const LISTINGS: Listing[] = [
  { id: "ML-1001", type: "whole_loan",    title: "Multifamily — 48 Units Austin TX",     property_type: "Multifamily",  location: "Austin, TX",      loan_amount: 7200000,  available_amount: 7200000,  rate: 7.50, ltv: 65.2, dscr: 1.38, maturity: "2027-06-01", status: "available",    listed_at: "2026-04-18", seller: "First Capital Bank" },
  { id: "ML-1002", type: "participation", title: "Retail Strip — 28,000 SF Miami FL",    property_type: "Retail",       location: "Miami, FL",       loan_amount: 12400000, available_amount: 4000000,  rate: 7.75, ltv: 58.0, dscr: 1.52, maturity: "2028-02-01", status: "available",    listed_at: "2026-04-15", seller: "Metro Commercial Lenders" },
  { id: "ML-1003", type: "whole_loan",    title: "Industrial Portfolio — 3 Assets NJ",   property_type: "Industrial",   location: "New Jersey",      loan_amount: 18500000, available_amount: 18500000, rate: 7.25, ltv: 62.5, dscr: 1.61, maturity: "2028-09-01", status: "under_offer",  listed_at: "2026-04-10", seller: "Granite Bridge Capital" },
  { id: "ML-1004", type: "pool",          title: "Mixed CRE Pool — 6 Assets SE Region",  property_type: "Mixed",        location: "Southeast US",    loan_amount: 42000000, available_amount: 42000000, rate: 7.85, ltv: 67.0, dscr: 1.29, maturity: "2027-12-01", status: "available",    listed_at: "2026-04-12", seller: "Pinnacle Asset Mgmt" },
  { id: "ML-1005", type: "whole_loan",    title: "Office — 15,000 SF Denver CO",         property_type: "Office",       location: "Denver, CO",      loan_amount: 5600000,  available_amount: 5600000,  rate: 8.25, ltv: 55.0, dscr: 1.44, maturity: "2027-03-01", status: "available",    listed_at: "2026-04-16", seller: "Western Debt Capital" },
  { id: "ML-1006", type: "participation", title: "Hotel — 120 Keys Nashville TN",        property_type: "Hotel",        location: "Nashville, TN",   loan_amount: 22000000, available_amount: 8000000,  rate: 8.50, ltv: 60.5, dscr: 1.31, maturity: "2028-07-01", status: "available",    listed_at: "2026-04-08", seller: "Summit Bridge Lending" },
  { id: "ML-1007", type: "whole_loan",    title: "Multifamily — 32 Units Charlotte NC",  property_type: "Multifamily",  location: "Charlotte, NC",   loan_amount: 6100000,  available_amount: 6100000,  rate: 7.60, ltv: 63.8, dscr: 1.47, maturity: "2027-09-01", status: "closed",       listed_at: "2026-03-22", seller: "Carolina Capital Group" },
];

const TYPE_CONFIG: Record<string, string> = {
  whole_loan:    "bg-brand-50 text-brand-700 border border-brand-200",
  participation: "bg-violet-50 text-violet-700 border border-violet-200",
  pool:          "bg-amber-50 text-amber-700 border border-amber-200",
};

const TYPE_LABEL: Record<string, string> = {
  whole_loan:    "Whole Loan",
  participation: "Participation",
  pool:          "Pool",
};

const STATUS_CONFIG: Record<string, string> = {
  available:    "text-emerald-600 bg-emerald-50 border border-emerald-200",
  under_offer:  "text-amber-600 bg-amber-50 border border-amber-200",
  closed:       "text-slate-500 bg-slate-100 border border-slate-200",
};

const STATUS_LABEL: Record<string, string> = {
  available:    "Available",
  under_offer:  "Under Offer",
  closed:       "Closed",
};

const fmt = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
  : `$${(n / 1e3).toFixed(0)}K`;

export default function MarketplacePage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("available");

  const filtered = LISTINGS.filter(l => {
    const matchesType   = typeFilter === "all"       || l.type   === typeFilter;
    const matchesStatus = statusFilter === "all"     || l.status === statusFilter;
    return matchesType && matchesStatus;
  });

  const totalAvailable = LISTINGS.filter(l => l.status === "available").reduce((s, l) => s + l.available_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Active Listings",    value: LISTINGS.filter(l => l.status === "available").length },
          { label: "Capital Available",  value: fmt(totalAvailable),       isString: true },
          { label: "Under Offer",        value: LISTINGS.filter(l => l.status === "under_offer").length },
          { label: "Closed (30d)",       value: LISTINGS.filter(l => l.status === "closed").length },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <FunnelIcon className="h-3.5 w-3.5" />
          Filter:
        </div>
        {["all", "available", "under_offer", "closed"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
        <div className="h-4 w-px bg-slate-200 mx-1" />
        {["all", "whole_loan", "participation", "pool"].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${typeFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t === "all" ? "All Types" : TYPE_LABEL[t]}
          </button>
        ))}

        <div className="ml-auto">
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            + List a Loan
          </button>
        </div>
      </div>

      {/* Listings */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
          <BanknotesIcon className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No listings match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(listing => (
            <div key={listing.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TYPE_CONFIG[listing.type]}`}>
                      {TYPE_LABEL[listing.type]}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[listing.status]}`}>
                      {STATUS_LABEL[listing.status]}
                    </span>
                    <span className="text-xs text-slate-400">{listing.id}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{listing.title}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {listing.location}
                    <span className="mx-1">·</span>
                    <BuildingOffice2Icon className="h-3.5 w-3.5" />
                    {listing.property_type}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {listing.status === "available" && (
                    <button className="flex items-center gap-1.5 rounded-lg border border-brand-700 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition">
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      View Details
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 border-t border-slate-100 pt-4">
                {[
                  { label: "Loan Amount",      value: fmt(listing.loan_amount) },
                  { label: "Available",         value: fmt(listing.available_amount) },
                  { label: "Rate",              value: `${listing.rate}%` },
                  { label: "LTV",               value: `${listing.ltv}%` },
                  { label: "DSCR",              value: `${listing.dscr}x` },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-xs text-slate-400">{m.label}</p>
                    <p className="text-sm font-semibold text-slate-800">{m.value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Listed by {listing.seller} · {new Date(listing.listed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {listing.maturity && ` · Matures ${new Date(listing.maturity).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
