import React from "react";
import { Link } from "react-router-dom";

const FEATURED = [
  { id: "harbor-view", name: "Harbor View Apartments", type: "Multifamily", location: "Miami, FL", units: 312, occupancy: 97, risk: "Low", riskColor: "#16a34a", score: 93 },
  { id: "lakeshore-logistics", name: "Lakeshore Logistics Hub", type: "Industrial", location: "Columbus, OH", sf: 290000, occupancy: 98, risk: "Low", riskColor: "#16a34a", score: 95 },
  { id: "tech-corridor", name: "Tech Corridor Campus", type: "Office", location: "San Jose, CA", sf: 310000, occupancy: 85, risk: "Low", riskColor: "#16a34a", score: 82 },
  { id: "riverside-mixed", name: "Riverside Mixed-Use", type: "Mixed-Use", location: "Denver, CO", units: 88, occupancy: 91, risk: "Low", riskColor: "#16a34a", score: 85 },
  { id: "central-square", name: "Central Square Tower", type: "Office", location: "Seattle, WA", sf: 220000, occupancy: 72, risk: "Medium", riskColor: "#d97706", score: 58 },
  { id: "pinecrest-garden", name: "Pinecrest Garden Apts", type: "Multifamily", location: "Austin, TX", units: 156, occupancy: 89, risk: "Low", riskColor: "#16a34a", score: 79 },
];

export default function MarketplacePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Marketplace</h2>
          <p className="text-sm text-gray-500 mt-0.5">Discover and track commercial real estate assets across the US.</p>
        </div>
        <Link to="/properties"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#800020" }}>
          View All Properties →
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Properties Listed", value: "12,400+" },
          { label: "Service Providers", value: "840+" },
          { label: "Markets Covered", value: "48 States" },
          { label: "New This Week", value: "124" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-4">Featured Properties</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {FEATURED.map((p) => (
          <Link key={p.id} to={`/properties/${p.id}`}
            className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all overflow-hidden">
            <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-200 relative flex items-center justify-center">
              <div className="text-4xl opacity-20">
                {p.type === "Multifamily" ? "🏠" : p.type === "Industrial" ? "🏭" : p.type === "Mixed-Use" ? "🏙️" : "🏢"}
              </div>
              <div className="absolute top-2 left-2">
                <span className="px-2 py-0.5 rounded bg-white/90 text-xs font-medium text-gray-700">{p.type}</span>
              </div>
              <div className="absolute top-2 right-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ background: p.riskColor + "22", color: p.riskColor }}>{p.risk}</span>
              </div>
            </div>
            <div className="p-4">
              <p className="font-semibold text-sm text-gray-900 group-hover:text-red-900 transition">{p.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.location}</p>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-500">{p.units ? `${p.units} units` : `${(p.sf / 1000).toFixed(0)}k SF`}</span>
                <span className="text-gray-500">{p.occupancy}% occupied</span>
                <span className="font-medium" style={{ color: p.riskColor }}>{p.score}/100</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm font-semibold text-gray-900 mb-1">Looking for specific assets?</p>
        <p className="text-xs text-gray-500 mb-4">Use the full marketplace to filter by type, location, occupancy, and risk score.</p>
        <Link to="/properties"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#800020" }}>
          Search All Properties
        </Link>
      </div>
    </div>
  );
}
