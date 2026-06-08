import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useProperties } from "../../hooks/useProperties";

const WORKSPACE_TABS = ["Overview", "Documents", "Financials", "Inspections", "Compliance", "Tasks", "AI Analysis"];

function PropertyDetail({ p, onBack, updateProperty }) {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
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
          <p className="text-sm text-gray-500">{p.city && p.state ? `${p.city}, ${p.state}` : p.address || "—"} · {p.type}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: (p.riskColor || "#6b7280") + "18", color: p.riskColor || "#6b7280" }}>
          {p.risk || "Unknown"} Risk
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

      <div className="grid md:grid-cols-3 gap-4">
        {activeTab === "Overview" && (
          <>
            {[
              { label: "Occupancy", value: p.occupancy != null ? `${p.occupancy}%` : "—", sub: "Current", color: "#16a34a" },
              { label: "Property Type", value: p.type, sub: p.yearBuilt ? `Built ${p.yearBuilt}` : "—", color: "#2563eb" },
              { label: p.type === "Multifamily" ? "Units" : "Sq Ft", value: (p.units || p.sqft || "—").toString(), sub: p.noi ? `NOI $${Number(p.noi).toLocaleString()}` : "No NOI entered", color: "#7c3aed" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                <div className="text-xs text-gray-400">{card.label}</div>
                <div className="text-xs text-gray-500">{card.sub}</div>
              </div>
            ))}
            <div className="col-span-3 rounded-xl border border-dashed border-gray-200 p-5 text-center text-gray-400">
              <p className="text-sm font-medium mb-1">Upload documents to unlock deeper analysis</p>
              <p className="text-xs mb-3">Inspection reports, lease agreements, financials — AI will analyze them automatically.</p>
              <Link to="/app/documents"
                className="text-sm font-medium" style={{ color: "#800020" }}>
                Upload Documents →
              </Link>
            </div>
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
            {activeTab === "AI Analysis" ? (
              <Link to="/ai-tools"
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#800020" }}>
                Run Free AI Tools
              </Link>
            ) : (
              <Link to={activeTab === "Documents" ? "/app/documents" : "/ai-tools"}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#800020" }}>
                {activeTab === "Documents" ? "Upload Document" : `Add ${activeTab.slice(0, -1)}`}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyPropertiesPage() {
  const { properties, isFirstVisit } = useProperties();
  const [selectedProperty, setSelectedProperty] = useState(null);
  const { updateProperty } = useProperties();

  if (selectedProperty) {
    return <PropertyDetail p={selectedProperty} onBack={() => setSelectedProperty(null)} updateProperty={updateProperty} />;
  }

  const isEmpty = properties.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Properties</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEmpty ? "No properties yet" : `${properties.length} ${properties.length === 1 ? "property" : "properties"} in your workspace`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/properties"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            Browse Marketplace
          </Link>
          <Link to="/app/add-property"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            + Add Property
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <div className="space-y-4">
          {/* Empty state hero */}
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <div className="text-5xl mb-4">🏢</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Add your first property</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed mb-6">
              Add a property to start tracking documents, inspections, compliance, and financials — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/app/add-property"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                + Add Property
              </Link>
              <Link to="/properties"
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Browse Marketplace
              </Link>
            </div>
          </div>

          {/* What you can do */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "📁", title: "Upload Documents", desc: "Rent rolls, inspection reports, insurance, financials — AI analyzes everything." },
              { icon: "🤖", title: "AI Analysis", desc: "Get health scores, risk flags, cost estimates, and action items in seconds." },
              { icon: "✅", title: "Track Compliance", desc: "Insurance expiration, tax deadlines, loan covenants — all monitored automatically." },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map((p) => (
            <button key={p.id} onClick={() => setSelectedProperty(p)}
              className="w-full text-left bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">
                    {p.type === "Multifamily" ? "🏠" : p.type === "Industrial" ? "🏭" : p.type === "Retail" ? "🏪" : p.type === "Office" ? "🏢" : "🏗️"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.city && p.state ? `${p.city}, ${p.state}` : p.address || "No address"} · {p.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {p.occupancy != null && (
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-semibold text-gray-900">{p.occupancy}%</p>
                      <p className="text-xs text-gray-400">Occupancy</p>
                    </div>
                  )}
                  {p.noi && (
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-semibold text-gray-900">${(Number(p.noi) / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-gray-400">Annual NOI</p>
                    </div>
                  )}
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                    {p.status || "Active"}
                  </span>
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              {p.yearBuilt && (
                <div className="mt-3 flex gap-4 text-xs text-gray-400">
                  <span>Built {p.yearBuilt}</span>
                  {p.units && <span>{p.units} units</span>}
                  {p.sqft && <span>{Number(p.sqft).toLocaleString()} SF</span>}
                  <span className="text-green-600 font-medium">Active</span>
                </div>
              )}
            </button>
          ))}

          {/* Add another */}
          <Link to="/app/add-property"
            className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 hover:bg-gray-50 transition text-gray-400 block">
            <div className="text-2xl mb-2">+</div>
            <p className="text-sm font-medium">Add another property</p>
            <p className="text-xs mt-0.5">Claim from marketplace or add manually</p>
          </Link>
        </div>
      )}
    </div>
  );
}
