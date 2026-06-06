import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const CATEGORIES = [
  "All", "Inspectors", "Engineers", "Roofing", "Property Managers",
  "Insurance Brokers", "Appraisers", "Environmental", "General Contractors",
];

const PROVIDERS = [
  { id: 1, name: "Cardinal RE Inspections", category: "Inspectors", city: "Los Angeles", state: "CA", serviceArea: "Southern California", rating: 4.9, reviews: 128, verified: true, specialties: ["Physical Inspection", "Life Safety", "HVAC Assessment"] },
  { id: 2, name: "National Property Services", category: "Inspectors", city: "Dallas", state: "TX", serviceArea: "Texas & Oklahoma", rating: 4.7, reviews: 94, verified: true, specialties: ["Insurance Inspections", "Annual Physical", "Environmental"] },
  { id: 3, name: "Apex Structural Engineers", category: "Engineers", city: "Chicago", state: "IL", serviceArea: "Midwest", rating: 4.8, reviews: 67, verified: true, specialties: ["Structural Analysis", "Seismic Assessment", "Foundation Review"] },
  { id: 4, name: "Pacific Shield Insurance", category: "Insurance Brokers", city: "San Francisco", state: "CA", serviceArea: "National", rating: 4.6, reviews: 215, verified: true, specialties: ["Property & Casualty", "GL Coverage", "Builder's Risk"] },
  { id: 5, name: "Summit Property Management", category: "Property Managers", city: "Denver", state: "CO", serviceArea: "Rocky Mountain", rating: 4.8, reviews: 183, verified: true, specialties: ["Multifamily", "Mixed-Use", "Lease-Up"] },
  { id: 6, name: "Green Earth Environmental", category: "Environmental", city: "Atlanta", state: "GA", serviceArea: "Southeast", rating: 4.7, reviews: 49, verified: true, specialties: ["Phase I ESA", "Phase II ESA", "Mold Assessment"] },
  { id: 7, name: "Rooftop Solutions Inc.", category: "Roofing", city: "Phoenix", state: "AZ", serviceArea: "Southwest", rating: 4.5, reviews: 72, verified: false, specialties: ["Roof Inspection", "TPO / EPDM", "Metal Roofing"] },
  { id: 8, name: "Valbridge Property Advisors", category: "Appraisers", city: "Miami", state: "FL", serviceArea: "Florida", rating: 4.9, reviews: 156, verified: true, specialties: ["MAI Certified", "CRE Appraisals", "Litigation Support"] },
  { id: 9, name: "Ironclad General Contractors", category: "General Contractors", city: "Seattle", state: "WA", serviceArea: "Pacific Northwest", rating: 4.6, reviews: 88, verified: true, specialties: ["Capital Improvements", "Tenant Improvements", "Renovation"] },
  { id: 10, name: "Hartland Engineering Group", category: "Engineers", city: "Houston", state: "TX", serviceArea: "Gulf Coast", rating: 4.7, reviews: 103, verified: true, specialties: ["MEP Engineering", "ADA Compliance", "Energy Audits"] },
  { id: 11, name: "Cornerstone Appraisal Group", category: "Appraisers", city: "New York", state: "NY", serviceArea: "Tri-State Area", rating: 4.8, reviews: 201, verified: true, specialties: ["Commercial Appraisal", "Portfolio Valuation", "Feasibility Studies"] },
  { id: 12, name: "BlueStar Property Management", category: "Property Managers", city: "Austin", state: "TX", serviceArea: "Central Texas", rating: 4.5, reviews: 76, verified: false, specialties: ["Multifamily", "Student Housing", "Single Family"] },
];

const CAT_ICONS = {
  Inspectors: "🔧", Engineers: "⚙️", Roofing: "🏠", "Property Managers": "🏢",
  "Insurance Brokers": "🛡️", Appraisers: "📐", Environmental: "🌿", "General Contractors": "🏗️",
};

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} className={`w-3 h-3 ${s <= Math.round(rating) ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating} ({(Math.floor(rating * 10) % 10 === 0 ? Math.round : (x => x))(rating)})</span>
    </div>
  );
}

export default function ServiceProvidersPage() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filtered = useMemo(() => {
    return PROVIDERS.filter((p) => {
      const matchCat = category === "All" || p.category === category;
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.city.toLowerCase().includes(search.toLowerCase()) ||
        p.serviceArea.toLowerCase().includes(search.toLowerCase());
      const matchVerified = !verifiedOnly || p.verified;
      return matchCat && matchSearch && matchVerified;
    });
  }, [category, search, verifiedOnly]);

  return (
    <PublicLayout>
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Service Provider Marketplace</h1>
          <p className="text-sm text-gray-500">Find vetted inspectors, engineers, property managers, and more — connected to your properties.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${category === cat ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              style={category === cat ? { background: "#800020" } : {}}>
              {cat !== "All" && <span>{CAT_ICONS[cat]}</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, city, or service area..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800/40" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer bg-white border border-gray-200 rounded-xl px-4 py-2.5">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="w-4 h-4 rounded accent-red-800" />
            Verified only
          </label>
        </div>

        <p className="text-xs text-gray-400 mb-5">{filtered.length} providers</p>

        {/* Provider grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">
                    {CAT_ICONS[p.category] || "🏢"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.city}, {p.state}</p>
                  </div>
                </div>
                {p.verified && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>

              <div className="mb-3">
                <StarRating rating={p.rating} />
                <p className="text-xs text-gray-400 mt-0.5">{p.reviews} reviews</p>
              </div>

              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1">Service Area</p>
                <p className="text-xs font-medium text-gray-700">{p.serviceArea}</p>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {p.specialties.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-gray-100 text-xs text-gray-600">{s}</span>
                ))}
              </div>

              <Link to="/login"
                className="block text-center w-full px-3 py-2 rounded-lg border text-sm font-medium transition hover:shadow-sm"
                style={{ borderColor: "#800020", color: "#800020" }}>
                Request Quote
              </Link>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm font-medium">No providers match your filters</p>
            <button onClick={() => { setSearch(""); setCategory("All"); setVerifiedOnly(false); }}
              className="mt-3 text-xs text-red-800 hover:underline">Clear filters</button>
          </div>
        )}

        {/* Join CTA */}
        <div className="mt-12 bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Are you a CRE service provider?</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">List your business on Kontra and connect with property owners, lenders, and asset managers.</p>
          <Link to="/waitlist"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#800020" }}>
            Apply to join marketplace
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
