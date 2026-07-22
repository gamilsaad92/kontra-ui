import React, { useState } from "react";
import { Link } from "react-router-dom";

function computePropertyId(p) {
  const seed = (p.name + (p.address || "") + (p.id || ""))
    .split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `KP-2026-${seed.toString(16).padStart(6, "0").toUpperCase()}`;
}

function DigitalRegistryTab({ p }) {
  const propertyId = computePropertyId(p);
  const claimDate = p.createdAt
    ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Today";

  const PILLARS = [
    { label: "Property Claimed", desc: "Property record created in Kontra workspace", done: true },
    { label: "Documents Uploaded", desc: "Upload inspection, insurance, or financial docs to verify", done: false, href: "/app/documents" },
    { label: "Inspection Verified", desc: "AI-analyzed third-party inspection report on file", done: false, href: "/app/documents" },
    { label: "Financials Verified", desc: "12-month operating statement uploaded and reviewed", done: false, href: "/app/documents" },
    { label: "Compliance Cleared", desc: "Insurance current, taxes paid, no open violations", done: false, href: "/app/compliance" },
  ];

  const verifiedCount = PILLARS.filter((x) => x.done).length;
  const pct = Math.round((verifiedCount / PILLARS.length) * 100);

  const RECORD_ROWS = [
    { label: "Property ID", value: propertyId },
    { label: "Registry Status", value: "Claimed" },
    { label: "Claim Date", value: claimDate },
    { label: "Registry Network", value: "Kontra Off-Chain Registry" },
    { label: "Blockchain Sync", value: "Planned Q4 2026" },
    { label: "Token Status", value: "Not yet issued" },
  ];

  const AUDIT = [
    { time: claimDate, event: "Property claimed", detail: "Added to Kontra workspace" },
    { time: claimDate, event: "Digital Registry created", detail: `Registry ID: ${propertyId}` },
    { time: "Pending", event: "Documents verified", detail: "Upload documents to advance" },
    { time: "Pending", event: "Inspection verified", detail: "Run AI inspection analysis to advance" },
  ];

  return (
    <div className="col-span-3 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-gray-900">Digital Asset Registry</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
              Off-chain · Blockchain sync Q4 2026
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed max-w-lg">
            A verified property record that tracks document history, inspection status, compliance, and ownership — the foundation layer before any financing or investment activity.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 shrink-0">Claimed</span>
      </div>

      {/* Registry Record */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Registry Record</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {RECORD_ROWS.map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">{row.label}</p>
                <p className="text-sm font-medium text-gray-900">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Investment Readiness */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Investment Readiness</p>
            <p className="text-xs text-gray-500 mt-0.5">Complete all 5 pillars to unlock financing and investment features</p>
          </div>
          <span className="text-xs text-gray-500">{verifiedCount} / {PILLARS.length}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "#800020" }} />
        </div>
        <div className="space-y-2.5">
          {PILLARS.map((pillar) => (
            <div key={pillar.label} className={`flex items-start gap-3 p-3 rounded-lg ${pillar.done ? "bg-green-50" : "bg-gray-50"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                pillar.done ? "bg-green-500" : "border-2 border-gray-300 bg-white"
              }`}>
                {pillar.done && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${pillar.done ? "text-green-800" : "text-gray-700"}`}>{pillar.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{pillar.desc}</p>
              </div>
              {!pillar.done && pillar.href && (
                <Link to={pillar.href} className="shrink-0 text-xs font-semibold" style={{ color: "#800020" }}>
                  Start →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Audit Trail</p>
        <div className="space-y-4">
          {AUDIT.map((entry, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-2 h-2 rounded-full ${entry.time === "Pending" ? "bg-gray-200" : "bg-green-400"}`} />
                {i < AUDIT.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" style={{ minHeight: 20 }} />}
              </div>
              <div className="pb-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-semibold text-gray-900">{entry.event}</p>
                  <span className="text-xs text-gray-400">{entry.time}</span>
                </div>
                <p className="text-xs text-gray-500">{entry.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Future: Tokenization */}
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <div className="text-2xl mb-2">🔗</div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Future Layer</p>
        <p className="text-sm font-bold text-gray-900 mb-2">Tokenization &amp; Digital Investment</p>
        <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed mb-4">
          When this property achieves Investment-Ready status across all 5 pillars, it becomes eligible for digital investment listing on regulated platforms — with blockchain record, investor onboarding, cap table management, and distributions built on top of this registry.
        </p>
        <Link to="/tokenization" className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#800020" }}>
          Learn about investment readiness →
        </Link>
      </div>
    </div>
  );
}
import { useProperties } from "../../hooks/useProperties";

const WORKSPACE_TABS = ["Overview", "Documents", "Financials", "Inspections", "Compliance", "Tasks", "Service Providers", "AI Analysis", "Loans", "Digital Registry"];

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
        {activeTab === "Digital Registry" && <DigitalRegistryTab p={p} />}
        {activeTab !== "Overview" && activeTab !== "Digital Registry" && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <div className="text-4xl mb-3">
              {activeTab === "Documents" ? "📁"
                : activeTab === "Financials" ? "💰"
                : activeTab === "Inspections" ? "🔍"
                : activeTab === "Compliance" ? "✅"
                : activeTab === "Tasks" ? "⚡"
                : activeTab === "Service Providers" ? "🤝"
                : activeTab === "Loans" ? "🏦"
                : "🤖"}
            </div>
            <p className="text-sm font-medium">No {activeTab.toLowerCase()} yet</p>
            <p className="text-xs mt-1 max-w-xs">
              {activeTab === "Documents"
                ? "Upload rent rolls, financials, insurance, or inspection reports for AI analysis."
                : activeTab === "Service Providers"
                ? "Connect inspectors, contractors, and service providers to this property."
                : activeTab === "Loans"
                ? "Track loan terms, covenants, and financing details for this property."
                : `Add your first ${activeTab.toLowerCase()} item to get started.`}
            </p>
            {activeTab === "AI Analysis" ? (
              <Link to="/create" className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#800020" }}>
                Open a Deal Room
              </Link>
            ) : activeTab === "Service Providers" ? (
              <Link to="/service-providers" className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#800020" }}>
                Browse Service Providers
              </Link>
            ) : (
              <Link to="/app/documents"
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#800020" }}>
                Upload Document
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
