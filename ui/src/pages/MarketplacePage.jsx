import { useState } from "react";
import { Link } from "react-router-dom";

const CATEGORIES = ["All", "Inspectors", "Engineers", "Consultants", "Property Managers", "Environmental", "Legal"];

const VENDORS = [
  {
    id: 1,
    name: "Summit Property Inspection Group",
    category: "Inspectors",
    logo: "🔍",
    tagline: "Commercial inspection specialists across the Southeast",
    services: ["Physical condition reports", "Pre-acquisition inspections", "Lender draw inspections", "ALTA surveys"],
    coverage: "AL, GA, FL, TN, SC, NC",
    rating: 4.9,
    reviews: 128,
    turnaround: "2–3 business days",
    verified: true,
    featured: true,
  },
  {
    id: 2,
    name: "Apex Structural Engineering",
    category: "Engineers",
    logo: "🏗️",
    tagline: "Licensed structural engineers for CRE due diligence",
    services: ["Structural assessments", "Seismic evaluations", "Foundation inspections", "MEP reviews"],
    coverage: "Nationwide",
    rating: 4.8,
    reviews: 94,
    turnaround: "5–7 business days",
    verified: true,
    featured: true,
  },
  {
    id: 3,
    name: "ClearPath Environmental",
    category: "Environmental",
    logo: "🌿",
    tagline: "Phase I & II environmental site assessments",
    services: ["Phase I ESA", "Phase II ESA", "Remediation consulting", "Vapor intrusion studies"],
    coverage: "TX, OK, NM, CO, AR, LA",
    rating: 4.7,
    reviews: 67,
    turnaround: "10–14 business days",
    verified: true,
    featured: false,
  },
  {
    id: 4,
    name: "Meridian CRE Advisors",
    category: "Consultants",
    logo: "📐",
    tagline: "Financial advisory for complex CRE transactions",
    services: ["Underwriting support", "DSCR analysis", "Market studies", "Loan restructuring"],
    coverage: "Nationwide",
    rating: 4.9,
    reviews: 213,
    turnaround: "3–5 business days",
    verified: true,
    featured: true,
  },
  {
    id: 5,
    name: "Harbor View Property Management",
    category: "Property Managers",
    logo: "🏢",
    tagline: "Full-service multifamily and commercial PM",
    services: ["Leasing & tenant mgmt", "Maintenance coordination", "Financial reporting", "Vendor management"],
    coverage: "FL, GA, SC",
    rating: 4.6,
    reviews: 41,
    turnaround: "Immediate",
    verified: true,
    featured: false,
  },
  {
    id: 6,
    name: "Blackstone CRE Legal Group",
    category: "Legal",
    logo: "⚖️",
    tagline: "Commercial real estate attorneys for lenders and investors",
    services: ["Loan documentation", "Title review", "CMBS counsel", "Workout & foreclosure"],
    coverage: "NY, NJ, CT, PA, FL",
    rating: 4.8,
    reviews: 156,
    turnaround: "Varies",
    verified: true,
    featured: false,
  },
  {
    id: 7,
    name: "BlueSky Inspections LLC",
    category: "Inspectors",
    logo: "🔍",
    tagline: "Rapid turnaround property condition assessments",
    services: ["Property condition assessments", "Fannie/Freddie PCAs", "Seismic PSL", "Accessibility surveys"],
    coverage: "CA, OR, WA, NV, AZ",
    rating: 4.7,
    reviews: 88,
    turnaround: "24–48 hours",
    verified: true,
    featured: false,
  },
  {
    id: 8,
    name: "ProManage Commercial",
    category: "Property Managers",
    logo: "🏢",
    tagline: "Office, retail, and industrial property management",
    services: ["Tenant relations", "CAM reconciliation", "Capital project oversight", "Leasing"],
    coverage: "TX, OK, KS",
    rating: 4.5,
    reviews: 29,
    turnaround: "Immediate",
    verified: false,
    featured: false,
  },
  {
    id: 9,
    name: "Trident Engineering Solutions",
    category: "Engineers",
    logo: "🏗️",
    tagline: "MEP and civil engineering for CRE projects",
    services: ["MEP assessments", "Civil engineering", "ADA compliance", "Cost estimating"],
    coverage: "TX, LA, MS, AL",
    rating: 4.6,
    reviews: 52,
    turnaround: "7–10 business days",
    verified: true,
    featured: false,
  },
];

function StarRating({ rating }) {
  return (
    <span className="text-amber-400 text-xs">
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
    </span>
  );
}

function ContactModal({ vendor, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        {!sent ? (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-900">{vendor.name}</h3>
                <p className="text-xs text-gray-400">{vendor.tagline}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition ml-4">✕</button>
            </div>
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Your name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Alex Rivera"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="alex@firm.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Message</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your project and what you need..."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Send inquiry →
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-xl mx-auto mb-4">✓</div>
            <h3 className="font-bold text-gray-900 mb-2">Inquiry sent</h3>
            <p className="text-sm text-gray-500 mb-4">
              {vendor.name} will respond within 1 business day.
            </p>
            <button onClick={onClose}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [contactVendor, setContactVendor] = useState(null);

  const filtered = VENDORS.filter(v => {
    const matchesCat = activeCategory === "All" || v.category === activeCategory;
    const matchesSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.services.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
      v.coverage.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const featured = filtered.filter(v => v.featured);
  const rest = filtered.filter(v => !v.featured);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                   style={{ background: "#800020" }}>K</div>
              <span className="font-bold text-lg tracking-tight text-gray-900">Kontra</span>
            </Link>
            <span className="hidden sm:block text-gray-300">·</span>
            <span className="hidden sm:block text-sm font-medium text-gray-600">Marketplace</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-400 transition">
              Sign in
            </Link>
            <Link to="/waitlist"
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-gray-100 py-14 px-6" style={{ background: "#0B0F19" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#800020" }}>
            Kontra Marketplace
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white mb-3">
            Find vetted CRE professionals
          </h1>
          <p className="text-sm max-w-xl mx-auto mb-8" style={{ color: "#64748B" }}>
            Inspectors, engineers, consultants, property managers, environmental vendors — 
            all pre-screened and rated by the Kontra community.
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search by service, location, or vendor name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm text-gray-900 bg-white border border-transparent focus:outline-none focus:border-gray-300 transition"
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="sticky top-[65px] z-40 border-b border-gray-100 bg-white px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border transition ${
                activeCategory === cat
                  ? "text-white border-transparent"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
              style={activeCategory === cat ? { background: "#800020", borderColor: "#800020" } : {}}
            >
              {cat}
            </button>
          ))}
          {search && (
            <button
              onClick={() => setSearch("")}
              className="shrink-0 text-xs text-gray-400 hover:text-gray-700 transition ml-2">
              Clear search ✕
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium text-gray-600">No vendors found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
            <button onClick={() => { setSearch(""); setActiveCategory("All"); }}
                    className="mt-4 text-sm font-medium text-gray-600 hover:text-gray-900 underline transition">
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <div className="mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Featured vendors</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featured.map(vendor => (
                    <VendorCard key={vendor.id} vendor={vendor} onContact={setContactVendor} />
                  ))}
                </div>
              </div>
            )}

            {rest.length > 0 && (
              <div>
                {featured.length > 0 && (
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">All vendors</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rest.map(vendor => (
                    <VendorCard key={vendor.id} vendor={vendor} onContact={setContactVendor} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Vendor CTA */}
        <div className="mt-14 text-center border border-dashed border-gray-200 rounded-2xl p-10">
          <p className="text-2xl mb-3">🏷️</p>
          <h3 className="font-bold text-gray-900 mb-2">Are you a CRE professional?</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
            List your services on Kontra Marketplace and connect with lenders, investors, and property owners.
          </p>
          <Link to="/waitlist"
            className="inline-flex text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Apply to list your business →
          </Link>
        </div>
      </div>

      {contactVendor && (
        <ContactModal vendor={contactVendor} onClose={() => setContactVendor(null)} />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 mt-10" style={{ background: "#FAFAFA" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-xs"
                 style={{ background: "#800020" }}>K</div>
            <span className="text-sm text-gray-400">Kontra Platform</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <Link to="/" className="hover:text-gray-700 transition">Home</Link>
            <Link to="/pricing" className="hover:text-gray-700 transition">Pricing</Link>
            <Link to="/login" className="hover:text-gray-700 transition">Sign in</Link>
          </div>
          <p className="text-xs text-gray-400">© 2025 Kontra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function VendorCard({ vendor, onContact }) {
  return (
    <div className="border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
             style={{ background: "#F8FAFC" }}>
          {vendor.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{vendor.name}</h3>
            {vendor.verified && (
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(128,0,32,0.08)", color: "#800020" }}>
                ✓ VERIFIED
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 leading-tight">{vendor.tagline}</p>
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2 mb-3">
        <StarRating rating={vendor.rating} />
        <span className="text-xs font-semibold text-gray-700">{vendor.rating}</span>
        <span className="text-xs text-gray-400">({vendor.reviews} reviews)</span>
      </div>

      {/* Services */}
      <div className="mb-3 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Services</p>
        <ul className="space-y-1">
          {vendor.services.slice(0, 3).map(s => (
            <li key={s} className="text-xs text-gray-600 flex items-center gap-1.5">
              <span className="text-gray-300">·</span> {s}
            </li>
          ))}
          {vendor.services.length > 3 && (
            <li className="text-xs text-gray-400">+{vendor.services.length - 3} more</li>
          )}
        </ul>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-xs text-gray-400">
        <span>📍 {vendor.coverage}</span>
        <span>⏱ {vendor.turnaround}</span>
      </div>

      {/* CTA */}
      <button
        onClick={() => onContact(vendor)}
        className="w-full py-2.5 rounded-xl text-sm font-semibold border transition hover:opacity-90 text-white"
        style={{ background: "#800020", borderColor: "#800020" }}>
        Contact vendor
      </button>
    </div>
  );
}
