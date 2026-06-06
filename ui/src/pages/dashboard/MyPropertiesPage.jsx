import React, { useState } from "react";
import { Link } from "react-router-dom";

const MY_PROPERTIES = [
  { id: "westside-commons", name: "Westside Commons", type: "Multifamily", location: "Los Angeles, CA", units: 234, occupancy: 94, risk: "Low", riskColor: "#16a34a", score: 87, inspection: "Passed", lastUpdated: "2 days ago", status: "Active" },
  { id: "summit-industrial", name: "Summit Industrial Park", type: "Industrial", location: "Atlanta, GA", sf: 145000, occupancy: 100, risk: "Low", riskColor: "#16a34a", score: 91, inspection: "Passed", lastUpdated: "1 week ago", status: "Active" },
  { id: "northgate-retail", name: "Northgate Retail Center", type: "Retail", location: "Chicago, IL", sf: 94000, occupancy: 81, risk: "Medium", riskColor: "#d97706", score: 71, inspection: "Pending", lastUpdated: "3 days ago", status: "Monitoring" },
];

const WORKSPACE_TABS = ["Overview", "Documents", "Financials", "Inspections", "Compliance", "Tasks", "AI Analysis"];

export default function MyPropertiesPage() {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [showAdd, setShowAdd] = useState(false);

  if (selectedProperty) {
    const p = selectedProperty;
    return (
      <div>
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setSelectedProperty(null)} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            My Properties
          </button>
          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-gray-900">{p.name}</span>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{p.name}</h2>
            <p className="text-sm text-gray-500">{p.location} · {p.type}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: p.riskColor + "18", color: p.riskColor }}>
            {p.risk} Risk
          </span>
        </div>

        <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
          {WORKSPACE_TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition ${activeTab === tab ? "border-red-800 text-red-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content - all show placeholder state inviting usage */}
        <div className="grid md:grid-cols-3 gap-4">
          {activeTab === "Overview" && (
            <>
              {[
                { label: "Occupancy", value: `${p.occupancy}%`, sub: "Current", color: p.riskColor },
                { label: "Risk Score", value: `${p.score}/100`, sub: p.risk, color: p.riskColor },
                { label: "Inspection", value: p.inspection, sub: "Latest status", color: p.inspection === "Passed" ? "#16a34a" : "#d97706" },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-xs text-gray-400">{card.label}</div>
                  <div className="text-xs text-gray-500">{card.sub}</div>
                </div>
              ))}
            </>
          )}
          {activeTab !== "Overview" && (
            <div className="col-span-3 flex flex-col items-center justify-center py-16 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <div className="text-4xl mb-3">
                {activeTab === "Documents" ? "📁" : activeTab === "Financials" ? "💰" : activeTab === "Inspections" ? "🔍" : activeTab === "Compliance" ? "✅" : activeTab === "Tasks" ? "⚡" : "🤖"}
              </div>
              <p className="text-sm font-medium">No {activeTab.toLowerCase()} yet</p>
              <p className="text-xs mt-1 max-w-xs">
                {activeTab === "Documents" ? "Upload rent rolls, financials, insurance, or inspection reports for AI analysis." : `Add your first ${activeTab.toLowerCase()} item to get started.`}
              </p>
              <button className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#800020" }}>
                {activeTab === "Documents" ? "Upload Document" : `Add ${activeTab.slice(0, -1)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Properties</h2>
          <p className="text-sm text-gray-500 mt-0.5">{MY_PROPERTIES.length} properties in your workspace</p>
        </div>
        <div className="flex gap-2">
          <Link to="/properties"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Browse Marketplace
          </Link>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            + Add Property
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-blue-800">Search the marketplace to claim a property or add it to your workspace.</p>
          <div className="flex gap-2">
            <Link to="/properties" className="text-sm font-medium text-blue-800 underline">Browse Properties</Link>
            <button onClick={() => setShowAdd(false)} className="text-blue-400 hover:text-blue-600">✕</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {MY_PROPERTIES.map((p) => (
          <button key={p.id} onClick={() => setSelectedProperty(p)}
            className="w-full text-left bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">
                  {p.type === "Multifamily" ? "🏠" : p.type === "Industrial" ? "🏭" : "🏬"}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.location} · {p.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold text-gray-900">{p.occupancy}%</p>
                  <p className="text-xs text-gray-400">Occupancy</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold text-gray-900">{p.score}/100</p>
                  <p className="text-xs text-gray-400">Risk Score</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: p.riskColor + "18", color: p.riskColor }}>
                  {p.risk}
                </span>
                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-gray-400">
              <span>Inspection: {p.inspection}</span>
              <span>Updated {p.lastUpdated}</span>
              <span className={`font-medium ${p.status === "Active" ? "text-green-600" : "text-amber-600"}`}>{p.status}</span>
            </div>
          </button>
        ))}

        {/* Add property CTA card */}
        <button onClick={() => setShowAdd(true)}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 hover:bg-gray-50 transition text-gray-400">
          <div className="text-2xl mb-2">+</div>
          <p className="text-sm font-medium">Add a property</p>
          <p className="text-xs mt-0.5">Claim from marketplace or create manually</p>
        </button>
      </div>
    </div>
  );
}
