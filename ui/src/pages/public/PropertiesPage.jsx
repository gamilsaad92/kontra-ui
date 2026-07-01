import React, { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PROPERTIES = [
  { id: "westside-commons",   name: "Westside Commons",       type: "Multifamily", city: "Los Angeles", state: "CA", units: 234,  sf: null,    occupancy: 94,  risk: "Low",    riskColor: "#16a34a", score: 87, inspection: "Passed",   market: "SoCal",     yearBuilt: 2018, digitalStatus: "Verified",         image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=70" },
  { id: "meridian-tower",     name: "The Meridian",           type: "Office",      city: "Dallas",      state: "TX", units: null, sf: 182000, occupancy: 78,  risk: "Medium", riskColor: "#d97706", score: 62, inspection: "Due Soon", market: "DFW",       yearBuilt: 2005, digitalStatus: "Unclaimed",        image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=70" },
  { id: "summit-industrial",  name: "Summit Industrial Park", type: "Industrial",  city: "Atlanta",     state: "GA", units: null, sf: 145000, occupancy: 100, risk: "Low",    riskColor: "#16a34a", score: 91, inspection: "Passed",   market: "Atlanta",   yearBuilt: 2015, digitalStatus: "Investment-Ready", image: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=600&q=70" },
  { id: "harbor-view",        name: "Harbor View Apartments", type: "Multifamily", city: "Miami",       state: "FL", units: 312,  sf: null,    occupancy: 97,  risk: "Low",    riskColor: "#16a34a", score: 93, inspection: "Passed",   market: "South FL",  yearBuilt: 2020, digitalStatus: "Investment-Ready", image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=70" },
  { id: "oakwood-plaza",      name: "Oakwood Business Plaza", type: "Office",      city: "Phoenix",     state: "AZ", units: null, sf: 82000,  occupancy: 68,  risk: "High",   riskColor: "#dc2626", score: 44, inspection: "Failed",   market: "Phoenix",   yearBuilt: 1998, digitalStatus: "Unclaimed",        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70" },
  { id: "northgate-retail",   name: "Northgate Retail Center",type: "Retail",      city: "Chicago",     state: "IL", units: null, sf: 94000,  occupancy: 81,  risk: "Medium", riskColor: "#d97706", score: 71, inspection: "Pending",  market: "Chicago",   yearBuilt: 2001, digitalStatus: "Claimed",          image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=70" },
  { id: "riverside-mixed",    name: "Riverside Mixed-Use",    type: "Mixed-Use",   city: "Denver",      state: "CO", units: 88,   sf: 42000,  occupancy: 91,  risk: "Low",    riskColor: "#16a34a", score: 85, inspection: "Passed",   market: "Denver",    yearBuilt: 2019, digitalStatus: "Verified",         image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=70" },
  { id: "pinecrest-garden",   name: "Pinecrest Garden Apts",  type: "Multifamily", city: "Austin",      state: "TX", units: 156,  sf: null,    occupancy: 89,  risk: "Low",    riskColor: "#16a34a", score: 79, inspection: "Passed",   market: "Austin",    yearBuilt: 2014, digitalStatus: "Claimed",          image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=70" },
  { id: "lakeshore-logistics",name: "Lakeshore Logistics Hub",type: "Industrial",  city: "Columbus",    state: "OH", units: null, sf: 290000, occupancy: 98,  risk: "Low",    riskColor: "#16a34a", score: 95, inspection: "Passed",   market: "Columbus",  yearBuilt: 2021, digitalStatus: "Investment-Ready", image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&q=70" },
  { id: "central-square",     name: "Central Square Tower",   type: "Office",      city: "Seattle",     state: "WA", units: null, sf: 220000, occupancy: 72,  risk: "Medium", riskColor: "#d97706", score: 58, inspection: "Due Soon", market: "Seattle",   yearBuilt: 2009, digitalStatus: "Unclaimed",        image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=600&q=70" },
  { id: "palm-garden",        name: "Palm Garden Villas",     type: "Multifamily", city: "Las Vegas",   state: "NV", units: 420,  sf: null,    occupancy: 95,  risk: "Low",    riskColor: "#16a34a", score: 90, inspection: "Passed",   market: "Las Vegas", yearBuilt: 2017, digitalStatus: "Verified",         image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=70" },
  { id: "tech-corridor",      name: "Tech Corridor Campus",   type: "Office",      city: "San Jose",    state: "CA", units: null, sf: 310000, occupancy: 85,  risk: "Low",    riskColor: "#16a34a", score: 82, inspection: "Passed",   market: "Bay Area",  yearBuilt: 2016, digitalStatus: "Verified",         image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600&q=70" },
];

const TYPES = ["All", "Multifamily", "Office", "Industrial", "Retail", "Mixed-Use"];
const RISK_LEVELS = ["All", "Low", "Medium", "High"];

const TYPE_ICONS = { Multifamily: "🏠", Office: "🏢", Industrial: "🏭", Retail: "🏬", "Mixed-Use": "🏙️" };

const DIGITAL_STATUS = {
  "Investment-Ready": { label: "Investment-Ready", color: "#92400e", bg: "#fffbeb", dot: "#f59e0b" },
  "Verified":          { label: "Verified",          color: "#065f46", bg: "#f0fdf4", dot: "#16a34a" },
  "Claimed":           { label: "Claimed",           color: "#1e3a8a", bg: "#eff6ff", dot: "#3b82f6" },
  "Unclaimed":         { label: "Unclaimed",         color: "#6b7280", bg: "#f9fafb", dot: "#d1d5db" },
};

function DigitalStatusBadge({ status }) {
  const cfg = DIGITAL_STATUS[status] || DIGITAL_STATUS["Unclaimed"];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

export default function PropertiesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ? searchParams.get("type").charAt(0).toUpperCase() + searchParams.get("type").slice(1) : "All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [minOccupancy, setMinOccupancy] = useState(0);
  const [sortBy, setSortBy] = useState("score");

  const filtered = useMemo(() => {
    return PROPERTIES.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.city.toLowerCase().includes(search.toLowerCase()) ||
        p.state.toLowerCase().includes(search.toLowerCase()) ||
        p.market.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "All" || p.type === typeFilter;
      const matchRisk = riskFilter === "All" || p.risk === riskFilter;
      const matchOcc = p.occupancy >= minOccupancy;
      return matchSearch && matchType && matchRisk && matchOcc;
    }).sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "occupancy") return b.occupancy - a.occupancy;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [search, typeFilter, riskFilter, minOccupancy, sortBy]);

  return (
    <PublicLayout>
      {/* Page header */}
      <div className="bg-gray-50 border-b border-gray-200 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">CRE Properties</h1>
          <p className="text-sm text-gray-500">Discover, track, and analyze commercial real estate assets across the US.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filters */}
          <aside className="lg:w-56 shrink-0 space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">Property Type</label>
              <div className="space-y-1">
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${typeFilter === t ? "font-semibold text-red-900 bg-red-50" : "text-gray-600 hover:bg-gray-50"}`}>
                    {t !== "All" && <span>{TYPE_ICONS[t]}</span>}
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">Risk Level</label>
              <div className="space-y-1">
                {RISK_LEVELS.map((r) => (
                  <button key={r} onClick={() => setRiskFilter(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${riskFilter === r ? "font-semibold text-red-900 bg-red-50" : "text-gray-600 hover:bg-gray-50"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">
                Min Occupancy: {minOccupancy}%
              </label>
              <input type="range" min={0} max={100} value={minOccupancy}
                onChange={(e) => setMinOccupancy(Number(e.target.value))}
                className="w-full accent-red-800" />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search + sort bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search properties, cities, markets..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800/40" />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none">
                <option value="score">Sort: Risk Score</option>
                <option value="occupancy">Sort: Occupancy</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            <p className="text-xs text-gray-400 mb-4">{filtered.length} properties found</p>

            {/* Property grid */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <Link key={p.id} to={`/properties/${p.id}`}
                  className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all overflow-hidden">
                  <div className="h-32 relative overflow-hidden">
                    <img src={p.image} alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => { e.target.style.display = "none"; e.target.parentElement.classList.add("bg-gradient-to-br", "from-gray-100", "to-gray-200"); }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded bg-white/90 text-xs font-medium text-gray-700">{p.type}</span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color: p.riskColor, backdropFilter: "blur(4px)", background: "rgba(255,255,255,0.85)" }}>
                        {p.risk}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm text-gray-900 group-hover:text-red-900 transition leading-tight">{p.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{p.city}, {p.state} · {p.market}</p>
                    <div className="mt-3 grid grid-cols-3 gap-1 text-center border-t border-gray-100 pt-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {p.units ? `${p.units}u` : `${(p.sf / 1000).toFixed(0)}k SF`}
                        </div>
                        <div className="text-xs text-gray-400">{p.units ? "Units" : "Sq Ft"}</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{p.occupancy}%</div>
                        <div className="text-xs text-gray-400">Occupied</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: p.score >= 80 ? "#16a34a" : p.score >= 60 ? "#d97706" : "#dc2626" }}>
                          {p.score}
                        </div>
                        <div className="text-xs text-gray-400">Score</div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-gray-400">Inspection: {p.inspection}</span>
                      <span className="text-xs font-medium" style={{ color: "#800020" }}>View →</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-50">
                      <DigitalStatusBadge status={p.digitalStatus} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-sm font-medium">No properties match your filters</p>
                <button onClick={() => { setSearch(""); setTypeFilter("All"); setRiskFilter("All"); setMinOccupancy(0); }}
                  className="mt-3 text-xs text-red-800 hover:underline">Clear filters</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
