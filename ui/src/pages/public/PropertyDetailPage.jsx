import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PROPERTIES = {
  "westside-commons": { name: "Westside Commons", type: "Multifamily", city: "Los Angeles", state: "CA", zip: "90025", address: "11420 Santa Monica Blvd", units: 234, sf: null, yearBuilt: 2018, occupancy: 94, risk: "Low", riskColor: "#16a34a", score: 87, inspection: "Passed", market: "SoCal", condition: 88, description: "Class A multifamily community in West LA featuring studio through 3-bedroom floor plans, resort-style amenities, and dedicated parking. Built in 2018 with modern finishes." },
  "meridian-tower": { name: "The Meridian", type: "Office", city: "Dallas", state: "TX", zip: "75201", address: "1700 Pacific Ave", units: null, sf: 182000, yearBuilt: 2005, occupancy: 78, risk: "Medium", riskColor: "#d97706", score: 62, inspection: "Due Soon", market: "DFW", condition: 71, description: "Class A office tower in Uptown Dallas with panoramic city views, on-site parking, fitness center, and full-service café. Positioned in one of DFW's most active submarkets." },
  "summit-industrial": { name: "Summit Industrial Park", type: "Industrial", city: "Atlanta", state: "GA", zip: "30318", address: "2840 Ellsworth Industrial Blvd", units: null, sf: 145000, yearBuilt: 2015, occupancy: 100, risk: "Low", riskColor: "#16a34a", score: 91, inspection: "Passed", market: "Atlanta", condition: 94, description: "Fully leased industrial campus in Atlanta's I-285 corridor with 32' clear height, 28 dock doors, and direct interstate access. Single tenant NNN lease through 2031." },
  "harbor-view": { name: "Harbor View Apartments", type: "Multifamily", city: "Miami", state: "FL", zip: "33132", address: "825 Brickell Bay Dr", units: 312, sf: null, yearBuilt: 2020, occupancy: 97, risk: "Low", riskColor: "#16a34a", score: 93, inspection: "Passed", market: "South FL", condition: 96, description: "Luxury waterfront multifamily community in Brickell with bay views, rooftop pool, co-working spaces, and ground-floor retail. Among Miami's newest class A assets." },
  "oakwood-plaza": { name: "Oakwood Business Plaza", type: "Office", city: "Phoenix", state: "AZ", zip: "85012", address: "3550 N Central Ave", units: null, sf: 82000, yearBuilt: 1998, occupancy: 68, risk: "High", riskColor: "#dc2626", score: 44, inspection: "Failed", market: "Phoenix", condition: 52, description: "Suburban office building in Midtown Phoenix showing elevated vacancy and deferred maintenance. Recent HVAC failure flagged in latest inspection. Lease rollover risk in 2025." },
  "harbor-view": { name: "Harbor View Apartments", type: "Multifamily", city: "Miami", state: "FL", zip: "33132", address: "825 Brickell Bay Dr", units: 312, sf: null, yearBuilt: 2020, occupancy: 97, risk: "Low", riskColor: "#16a34a", score: 93, inspection: "Passed", market: "South FL", condition: 96, description: "Luxury waterfront multifamily community in Brickell with bay views, rooftop pool, co-working spaces, and ground-floor retail." },
};

const DEFAULT_PROPERTY = { name: "Property Not Found", type: "Unknown", city: "N/A", state: "", zip: "", address: "", units: null, sf: null, yearBuilt: null, occupancy: 0, risk: "Unknown", riskColor: "#94a3b8", score: 0, inspection: "N/A", market: "N/A", condition: 0, description: "" };

const INSPECTION_HISTORY = [
  { date: "Mar 2025", type: "Annual Physical", result: "Passed", inspector: "Cardinal RE Inspections", findings: 2 },
  { date: "Sep 2024", type: "Insurance Inspection", result: "Passed", inspector: "National Property Services", findings: 0 },
  { date: "Mar 2024", type: "Annual Physical", result: "Passed", inspector: "Cardinal RE Inspections", findings: 1 },
];

const PUBLIC_DOCS = [
  { name: "2024 Annual Inspection Report", type: "Inspection", date: "Mar 2025" },
  { name: "Certificate of Occupancy", type: "Legal", date: "Jan 2019" },
  { name: "Property Fact Sheet", type: "Marketing", date: "Oct 2024" },
];

const LOCKED_SECTIONS = [
  { icon: "💰", title: "Full Financials", desc: "NOI, cap rate, cash flow, and historical P&L" },
  { icon: "📋", title: "Rent Roll", desc: "Unit-by-unit rent data, lease terms, and tenant details" },
  { icon: "🏦", title: "Loan Data", desc: "Outstanding balance, terms, lender, and covenant status" },
  { icon: "🤖", title: "AI Compliance Analysis", desc: "AI-generated risk summary and covenant flags" },
  { icon: "📁", title: "Private Documents", desc: "Financials, appraisals, and confidential due diligence" },
  { icon: "📊", title: "Investor Analytics", desc: "IRR projections, comparables, and market positioning" },
];

export default function PropertyDetailPage() {
  const { id } = useParams();
  const property = PROPERTIES[id] || DEFAULT_PROPERTY;
  const [watchlisted, setWatchlisted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const TABS = ["overview", "inspections", "documents", "providers"];

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200 py-3">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 text-sm text-gray-500">
          <Link to="/properties" className="hover:text-gray-900 transition">Properties</Link>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">{property.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Property header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl shrink-0">
              {property.type === "Multifamily" ? "🏠" : property.type === "Industrial" ? "🏭" : property.type === "Retail" ? "🏬" : "🏢"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{property.address}, {property.city}, {property.state} {property.zip}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-700">{property.type}</span>
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold"
                  style={{ background: property.riskColor + "18", color: property.riskColor }}>
                  {property.risk} Risk
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">{property.market}</span>
                {property.yearBuilt && <span className="text-xs text-gray-400">Built {property.yearBuilt}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setWatchlisted(!watchlisted)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition ${watchlisted ? "border-red-200 bg-red-50 text-red-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
              {watchlisted ? "★ Watchlisted" : "☆ Add to Watchlist"}
            </button>
            <Link to="/login"
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Claim Property
            </Link>
          </div>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Risk Score", value: `${property.score}/100`, sub: property.risk + " Risk", color: property.riskColor },
            { label: "Occupancy", value: `${property.occupancy}%`, sub: "Current occupancy", color: property.occupancy >= 90 ? "#16a34a" : property.occupancy >= 75 ? "#d97706" : "#dc2626" },
            { label: "Condition Score", value: `${property.condition}/100`, sub: "Property condition", color: property.condition >= 80 ? "#16a34a" : property.condition >= 60 ? "#d97706" : "#dc2626" },
            { label: "Inspection", value: property.inspection, sub: "Latest status", color: property.inspection === "Passed" ? "#16a34a" : property.inspection === "Failed" ? "#dc2626" : "#d97706" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="border-b border-gray-200 flex gap-0">
              {TABS.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition capitalize ${activeTab === tab ? "border-red-800 text-red-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Property Overview</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{property.description}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Facts</h3>
                  <dl className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Property Type", value: property.type },
                      { label: property.units ? "Total Units" : "Total SF", value: property.units ? `${property.units} units` : `${property.sf?.toLocaleString()} SF` },
                      { label: "Year Built", value: property.yearBuilt || "N/A" },
                      { label: "Market", value: property.market },
                      { label: "Current Occupancy", value: `${property.occupancy}%` },
                      { label: "Risk Level", value: property.risk },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                        <dt className="text-xs text-gray-400">{item.label}</dt>
                        <dd className="text-sm font-semibold text-gray-900 mt-0.5">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Market Summary</h3>
                  <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 text-sm text-blue-800">
                    <p className="leading-relaxed">The {property.market} market continues to show {property.risk === "Low" ? "strong fundamentals with stable occupancy and rent growth" : "mixed signals with elevated vacancy in some submarkets"}. This property is positioned {property.score >= 80 ? "above average" : property.score >= 60 ? "near the market median" : "below market benchmarks"} relative to its peer set.</p>
                  </div>
                </div>

                {/* Request Inspection CTA */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Request an Inspection</p>
                    <p className="text-xs text-gray-500 mt-0.5">Connect with a vetted inspector from our service provider network.</p>
                  </div>
                  <Link to="/service-providers"
                    className="shrink-0 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white transition">
                    Find Inspectors
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "inspections" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Inspection History</h3>
                {INSPECTION_HISTORY.map((ins, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{ins.type}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ins.inspector} · {ins.date}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${ins.result === "Passed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {ins.result}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{ins.findings === 0 ? "No findings" : `${ins.findings} finding${ins.findings > 1 ? "s" : ""} noted`}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Public Documents</h3>
                {PUBLIC_DOCS.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm">📄</div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-400">{doc.type} · {doc.date}</p>
                      </div>
                    </div>
                    <Link to="/login" className="text-xs font-medium text-red-800 hover:underline">View</Link>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "providers" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Service Provider History</h3>
                {[
                  { name: "Cardinal RE Inspections", role: "Inspector", last: "Mar 2025" },
                  { name: "Pacific Shield Insurance", role: "Insurance Broker", last: "Jan 2025" },
                  { name: "Summit Property Management", role: "Property Manager", last: "Ongoing" },
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                        {p.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.role} · Last: {p.last}</p>
                      </div>
                    </div>
                    <Link to="/service-providers" className="text-xs font-medium text-red-800 hover:underline">Find similar</Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: locked sections + CTA */}
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Workspace Tools</p>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">
                Sign in to access full financials, rent roll, loan data, AI analysis, and private documents for this property.
              </p>
              <div className="space-y-2 mb-5">
                {LOCKED_SECTIONS.map((s) => (
                  <div key={s.title} className="flex items-center gap-2.5 py-2 border-b border-white/10">
                    <span className="text-base">{s.icon}</span>
                    <div>
                      <p className="text-xs font-medium">{s.title}</p>
                      <p className="text-xs text-gray-500">{s.desc}</p>
                    </div>
                    <svg className="ml-auto w-3.5 h-3.5 text-gray-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ))}
              </div>
              <Link to="/login"
                className="block text-center w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#800020" }}>
                Sign in to access workspace
              </Link>
              <Link to="/login"
                className="block text-center w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition">
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
