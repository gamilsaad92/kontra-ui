import React, { useContext, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import { AuthContext } from "../../lib/authContext";
import { useProperties } from "../../hooks/useProperties";

const PROPERTIES = {
  "harbor-view": {
    id: "harbor-view", name: "Harbor View Apartments", type: "Multifamily", market: "Miami, FL",
    address: "1425 Brickell Ave, Miami, FL 33131", units: 312, sqft: 285000, year: 2019,
    occupancy: 97, noi: 3400000, price: 48000000, capRate: 7.1, risk: "Low", riskColor: "#16a34a",
    score: 93, image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
    description: "Class A luxury multifamily asset in the heart of Brickell. Strong rental demand driven by financial sector employment and Miami's continued population growth.",
    highlights: ["97% occupancy (stabilized)", "Recent $4.2M capital improvement", "Walk Score 94", "LEED Silver certified"],
  },
  "meridian-tower": {
    id: "meridian-tower", name: "The Meridian", type: "Office", market: "Dallas, TX",
    address: "2100 McKinney Ave, Dallas, TX 75201", units: null, sqft: 185000, year: 2016,
    occupancy: 78, noi: 2100000, price: 29500000, capRate: 7.1, risk: "Medium", riskColor: "#d97706",
    score: 62, image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80",
    description: "Class A office tower in Uptown Dallas with significant lease rollover risk over next 18 months. Opportunity to reposition with creative tenanting strategy.",
    highlights: ["Uptown Dallas submarket", "Lease rollover risk — 2 anchor tenants", "Strong building infrastructure", "Covered parking 4:1000"],
  },
  "palm-garden": {
    id: "palm-garden", name: "Palm Garden Villas", type: "Multifamily", market: "Las Vegas, NV",
    address: "4800 S Maryland Pkwy, Las Vegas, NV 89119", units: 248, sqft: 198000, year: 2021,
    occupancy: 95, noi: 2800000, price: 38500000, capRate: 7.3, risk: "Low", riskColor: "#16a34a",
    score: 90, image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
    description: "Modern garden-style multifamily community near UNLV campus. Strong student and young professional demand with consistent rent growth.",
    highlights: ["Near UNLV campus", "In-unit washer/dryer", "Resort-style amenities", "95% occupancy"],
  },
  "summit-industrial": {
    id: "summit-industrial", name: "Summit Industrial Park", type: "Industrial", market: "Atlanta, GA",
    address: "7200 Industrial Blvd, Atlanta, GA 30336", units: null, sqft: 420000, year: 2017,
    occupancy: 100, noi: 3900000, price: 54000000, capRate: 7.2, risk: "Low", riskColor: "#16a34a",
    score: 95, image: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=1200&q=80",
    description: "NNN-leased Class A industrial park with two long-term national tenants. Located near I-285 and Hartsfield-Jackson airport.",
    highlights: ["100% leased — NNN", "36-ft clear height", "BNSF rail access", "Airport proximity"],
  },
  "westside-commons": {
    id: "westside-commons", name: "Westside Commons", type: "Multifamily", market: "Los Angeles, CA",
    address: "1800 S La Cienega Blvd, Los Angeles, CA 90035", units: 195, sqft: 165000, year: 2018,
    occupancy: 94, noi: 4200000, price: 62000000, capRate: 6.8, risk: "Low", riskColor: "#16a34a",
    score: 88, image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
    description: "Mid-rise multifamily in prime Westside LA submarket. Excellent public transit access, strong demographics, and consistent rent growth.",
    highlights: ["LA Metro adjacent", "Ground floor retail", "EV charging", "Rooftop deck"],
  },
  "tech-corridor": {
    id: "tech-corridor", name: "Tech Corridor Campus", type: "Office", market: "San Jose, CA",
    address: "3000 Olsen Dr, San Jose, CA 95128", units: null, sqft: 220000, year: 2015,
    occupancy: 82, noi: 5100000, price: 71000000, capRate: 7.2, risk: "Medium", riskColor: "#d97706",
    score: 71, image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
    description: "Silicon Valley office campus with tech tenant mix. Elevated vacancy reflects broader Bay Area office headwinds but strong long-term demand drivers.",
    highlights: ["Silicon Valley submarket", "Fiber infrastructure", "Bike-friendly campus", "2 buildings, 4 floors each"],
  },
  "northgate-retail": {
    id: "northgate-retail", name: "Northgate Retail Center", type: "Retail", market: "Phoenix, AZ",
    address: "4500 E Thomas Rd, Phoenix, AZ 85018", units: null, sqft: 95000, year: 2012,
    occupancy: 89, noi: 1450000, price: 20000000, capRate: 7.3, risk: "Medium", riskColor: "#d97706",
    score: 74, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=80",
    description: "Grocery-anchored neighborhood retail center in central Phoenix. Anchor lease stable through 2031. Secondary tenants represent repositioning upside.",
    highlights: ["Grocery-anchored", "Anchor lease to 2031", "High-traffic corridor", "98K SF GLA"],
  },
  "lakeshore-logistics": {
    id: "lakeshore-logistics", name: "Lakeshore Logistics Hub", type: "Industrial", market: "Columbus, OH",
    address: "7100 Muirfield Dr, Columbus, OH 43017", units: null, sqft: 290000, year: 2021,
    occupancy: 98, noi: 3600000, price: 50000000, capRate: 7.2, risk: "Low", riskColor: "#16a34a",
    score: 95, image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80",
    description: "Class A last-mile logistics hub in Columbus, Ohio. 100% leased to national e-commerce tenant through 2028 with annual rent escalations.",
    highlights: ["Last-mile logistics", "National tenant — e-commerce", "Lease through 2028", "32-ft clear height"],
  },
  "riverside-mixed": {
    id: "riverside-mixed", name: "Riverside Mixed-Use", type: "Mixed-Use", market: "Denver, CO",
    address: "1500 Platte St, Denver, CO 80202", units: 88, sqft: 42000, year: 2019,
    occupancy: 91, noi: 2200000, price: 31000000, capRate: 7.1, risk: "Low", riskColor: "#16a34a",
    score: 85, image: "https://images.unsplash.com/photo-1574359411659-15573a27fd0c?w=1200&q=80",
    description: "Mixed-use development on Denver's Platte River corridor. 88 residential units above 42,000 SF of ground-floor retail. Strong walkability and transit access.",
    highlights: ["Mixed-use — residential + retail", "Platte River corridor", "Walk Score 92", "Transit-oriented"],
  },
  "central-square": {
    id: "central-square", name: "Central Square Tower", type: "Office", market: "Seattle, WA",
    address: "1000 2nd Ave, Seattle, WA 98104", units: null, sqft: 220000, year: 2009,
    occupancy: 72, noi: 4100000, price: 57000000, capRate: 7.2, risk: "Medium", riskColor: "#d97706",
    score: 58, image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&q=80",
    description: "Class A downtown Seattle office tower with below-average occupancy reflecting the broader Pacific Northwest office market softening.",
    highlights: ["Central Business District", "LEED Gold", "Below-market rents", "Upside from re-leasing"],
  },
  "pinecrest-garden": {
    id: "pinecrest-garden", name: "Pinecrest Garden Apts", type: "Multifamily", market: "Austin, TX",
    address: "5400 N Lamar Blvd, Austin, TX 78751", units: 156, sqft: 142000, year: 2014,
    occupancy: 89, noi: 1950000, price: 27000000, capRate: 7.2, risk: "Low", riskColor: "#16a34a",
    score: 79, image: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1200&q=80",
    description: "Garden-style multifamily in North Austin's Crestview neighborhood. Strong demographic trends with tech employment driving demand.",
    highlights: ["North Austin submarket", "In-unit washer/dryer", "Pool + fitness center", "Pet-friendly"],
  },
  "oakwood-plaza": {
    id: "oakwood-plaza", name: "Oakwood Business Plaza", type: "Office", market: "Phoenix, AZ",
    address: "7100 E Camelback Rd, Scottsdale, AZ 85251", units: null, sqft: 82000, year: 1998,
    occupancy: 68, noi: 900000, price: 12500000, capRate: 7.2, risk: "High", riskColor: "#dc2626",
    score: 44, image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80",
    description: "Value-add suburban office in Scottsdale with elevated vacancy and deferred maintenance. Acquisition play targeting smaller professional tenants.",
    highlights: ["Value-add opportunity", "Scottsdale submarket", "Below-market rents", "Deferred maintenance"],
  },
};

const DIGITAL_STATUS_MAP = {
  "westside-commons":    "Verified",
  "meridian-tower":      "Unclaimed",
  "summit-industrial":   "Investment-Ready",
  "harbor-view":         "Investment-Ready",
  "oakwood-plaza":       "Unclaimed",
  "northgate-retail":    "Claimed",
  "riverside-mixed":     "Verified",
  "pinecrest-garden":    "Claimed",
  "lakeshore-logistics": "Investment-Ready",
  "central-square":      "Unclaimed",
  "palm-garden":         "Verified",
  "tech-corridor":       "Verified",
};

const DIGITAL_STATUS_CFG = {
  "Investment-Ready": { label: "Investment-Ready", color: "#92400e", bg: "#fffbeb", dot: "#f59e0b", desc: "Verified documents, compliance passed, and investment readiness confirmed." },
  "Verified":         { label: "Verified",         color: "#065f46", bg: "#f0fdf4", dot: "#16a34a", desc: "Documents and ownership claims verified by Kontra." },
  "Claimed":          { label: "Claimed",          color: "#1e3a8a", bg: "#eff6ff", dot: "#3b82f6", desc: "Property claimed by an owner and actively managed on Kontra." },
  "Unclaimed":        { label: "Unclaimed",        color: "#6b7280", bg: "#f9fafb", dot: "#d1d5db", desc: "This property hasn't been claimed yet. Claim it to add it to your workspace." },
};

const TABS = ["Overview", "Inspections", "Documents", "Compliance", "AI Analysis"];

function fmt(n) { return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n.toLocaleString()}`; }
function fmtSF(n) { return `${n.toLocaleString()} SF`; }

function WorkspaceGate({ propertyId, action, label, description, icon }) {
  const { session } = useContext(AuthContext);
  const navigate = useNavigate();
  const href = action === "watchlist" ? "/app/watchlist"
    : action === "inspection" ? "/app/inspections"
    : action === "documents" ? "/app/documents"
    : action === "compliance" ? "/app/compliance"
    : "/dashboard";

  if (session) {
    return (
      <div className="rounded-2xl border border-gray-200 p-8 text-center bg-gray-50">
        <div className="text-4xl mb-3">{icon}</div>
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
        <p className="text-sm text-gray-500 mb-5">{description}</p>
        <Link to={href}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#800020" }}>
          Open in Workspace →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
      <div className="text-4xl mb-3 grayscale opacity-50">{icon}</div>
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <p className="text-sm text-gray-500 mb-5">{description}</p>
      <button
        onClick={() => navigate(`/login?redirect=${encodeURIComponent(href)}&action=${action}&propertyId=${propertyId}`)}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: "#800020" }}>
        Sign in to access →
      </button>
      <p className="text-xs text-gray-400 mt-3">Free account · No credit card required</p>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const { session } = useContext(AuthContext);
  const navigate = useNavigate();
  const { addProperty } = useProperties();
  const [activeTab, setActiveTab] = useState("Overview");
  const [claimState, setClaimState] = useState("idle"); // idle | claiming | claimed

  const property = PROPERTIES[id] || Object.values(PROPERTIES)[0];
  const digitalStatus = DIGITAL_STATUS_MAP[property.id] || "Unclaimed";
  const statusCfg = DIGITAL_STATUS_CFG[digitalStatus];

  // Watchlist persisted to localStorage so WatchlistPage reflects it
  const WL_KEY = "kontra_watchlist";
  const [watchlisted, setWatchlisted] = useState(() => {
    try {
      const raw = localStorage.getItem(WL_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return list.some((i) => i.id === property.id);
    } catch { return false; }
  });

  const handleWatchlist = () => {
    if (!session) {
      navigate(`/login?redirect=/app/watchlist&action=watchlist&propertyId=${property.id}`);
      return;
    }
    try {
      const raw = localStorage.getItem(WL_KEY);
      let list = raw ? JSON.parse(raw) : [];
      if (watchlisted) {
        list = list.filter((i) => i.id !== property.id);
      } else {
        list = [
          {
            id: property.id,
            name: property.name,
            market: property.market,
            type: property.type,
            occupancy: property.occupancy,
            risk: property.risk,
            riskColor: property.riskColor,
            score: property.score,
            savedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            lastUpdate: "Added to watchlist",
          },
          ...list,
        ];
      }
      localStorage.setItem(WL_KEY, JSON.stringify(list));
    } catch {}
    setWatchlisted((w) => !w);
  };

  const handleClaim = async () => {
    if (!session) {
      navigate(`/login?redirect=${encodeURIComponent(`/properties/${property.id}`)}&action=claim&propertyId=${property.id}`);
      return;
    }
    if (claimState === "claimed") {
      navigate("/app/properties");
      return;
    }
    setClaimState("claiming");
    try {
      const [city, state] = (property.market || "").split(",").map((s) => s.trim());
      await addProperty({
        name: property.name,
        type: property.type,
        address: property.address,
        city: city || "",
        state: state || "",
        units: property.units || null,
        sqft: property.sqft || null,
        yearBuilt: property.year || null,
        occupancy: property.occupancy || null,
        noi: property.noi || null,
      });
      setClaimState("claimed");
    } catch {
      setClaimState("idle");
    }
  };

  return (
    <PublicLayout>
      {/* Claim success banner */}
      {claimState === "claimed" && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-green-800">
              <span className="text-lg">✓</span>
              <span className="text-sm font-semibold">
                {property.name} added to your workspace!
              </span>
            </div>
            <Link to="/app/properties"
              className="text-sm font-semibold text-green-700 hover:text-green-900 underline">
              View in My Properties →
            </Link>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img src={property.image} alt={property.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-7xl mx-auto">
            <Link to="/properties" className="text-xs font-medium text-white/70 hover:text-white transition mb-2 inline-block">
              ← Back to properties
            </Link>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">{property.type}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: `${property.riskColor}50`, border: `1px solid ${property.riskColor}80` }}>
                    {property.risk} Risk
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold">{property.name}</h1>
                <p className="text-sm text-white/80 mt-0.5">{property.address}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleWatchlist}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                    watchlisted ? "bg-yellow-400 text-yellow-900 border-yellow-400" : "bg-white/10 text-white border-white/30 hover:bg-white/20"
                  }`}>
                  {watchlisted ? "⭐ Saved" : "☆ Watchlist"}
                </button>
                <button onClick={handleClaim} disabled={claimState === "claiming"}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: claimState === "claimed" ? "#16a34a" : "#800020" }}>
                  {claimState === "claiming" && (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  )}
                  {claimState === "idle" && "Claim Property"}
                  {claimState === "claiming" && "Claiming…"}
                  {claimState === "claimed" && "✓ View in Workspace →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Main content ─────────────────────────────────── */}
          <div className="lg:col-span-2">
            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Asking Price", value: fmt(property.price) },
                { label: "Cap Rate", value: `${property.capRate}%` },
                { label: "NOI", value: fmt(property.noi) },
                { label: "Occupancy", value: `${property.occupancy}%` },
              ].map((m) => (
                <div key={m.label} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className="text-xl font-bold text-gray-900">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <div className="flex gap-0 overflow-x-auto">
                {TABS.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                      activeTab === tab
                        ? "border-red-800 text-red-900 font-semibold"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "Overview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">About this property</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{property.description}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Highlights</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {property.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3">
                        <span className="text-green-500 text-sm mt-0.5">✓</span>
                        <span className="text-sm text-gray-700">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Type", value: property.type },
                    { label: "Market", value: property.market },
                    { label: "Year Built", value: property.year },
                    { label: "Size", value: fmtSF(property.sqft) },
                    { label: property.units ? "Units" : "Class", value: property.units || "Class A" },
                    { label: "Kontra Score", value: `${property.score}/100` },
                  ].map((d) => (
                    <div key={d.label} className="p-3 rounded-xl border border-gray-200">
                      <p className="text-xs text-gray-400 mb-0.5">{d.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{d.value}</p>
                    </div>
                  ))}
                </div>

                {!session && (
                  <div className="rounded-2xl p-6 text-center" style={{ background: "#f8f4f4", border: "1px solid #f0e4e4" }}>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Get the full picture</p>
                    <p className="text-xs text-gray-500 mb-4">
                      Sign in to access inspection reports, compliance tracking, document upload, and AI analysis for this property.
                    </p>
                    <button onClick={() => navigate(`/login?redirect=/app/properties&action=claim&propertyId=${property.id}`)}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: "#800020" }}>
                      Sign in free →
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Inspections" && (
              <WorkspaceGate propertyId={property.id} action="inspection" label="Inspection Reports"
                description="Access full inspection history, findings, and remediation status. Request new inspections from our vetted inspector network."
                icon="🔍" />
            )}
            {activeTab === "Documents" && (
              <WorkspaceGate propertyId={property.id} action="documents" label="Document Workspace"
                description="Upload and analyze rent rolls, operating statements, leases, insurance policies, and more with AI-powered document review."
                icon="📁" />
            )}
            {activeTab === "Compliance" && (
              <WorkspaceGate propertyId={property.id} action="compliance" label="Compliance Center"
                description="Track covenant compliance, insurance expiration, tax deadlines, and regulatory requirements for this property."
                icon="✅" />
            )}
            {activeTab === "AI Analysis" && (
              <WorkspaceGate propertyId={property.id} action="documents" label="AI Property Analysis"
                description="Upload documents to get instant AI analysis — rent roll validation, lease abstraction, risk scoring, and covenant tracking."
                icon="🤖" />
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Kontra Score */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Kontra Score</p>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-5xl font-black" style={{ color: property.riskColor }}>{property.score}</span>
                <span className="text-lg text-gray-400 mb-1">/100</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${property.score}%`, background: property.riskColor }} />
              </div>
              <p className="text-xs text-gray-500">{property.risk} risk · {property.occupancy}% occupied</p>
            </div>

            {/* Digital Asset Status */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Digital Asset Status</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.dot }} />
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{statusCfg.desc}</p>
              {digitalStatus === "Unclaimed" && (
                <button onClick={handleClaim} disabled={claimState === "claiming"}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: "#800020" }}>
                  {claimState === "claiming" ? "Claiming…" : "Claim this Property"}
                </button>
              )}
              {claimState === "claimed" && (
                <Link to="/app/properties"
                  className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center text-white transition hover:opacity-90"
                  style={{ background: "#16a34a" }}>
                  ✓ View in My Properties →
                </Link>
              )}
              {(digitalStatus !== "Unclaimed" && claimState !== "claimed") && (
                <Link to="/app/properties"
                  className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center border border-gray-200 text-gray-700 hover:bg-gray-50 transition">
                  Open Workspace →
                </Link>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-900 mb-1">Interested in this property?</p>
              <p className="text-xs text-gray-500 mb-4">Access the full workspace to analyze documents, track compliance, and connect with service providers.</p>
              <div className="space-y-2">
                <button onClick={handleWatchlist}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${
                    watchlisted ? "bg-yellow-50 text-yellow-800 border border-yellow-200" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}>
                  {watchlisted ? "⭐ Saved to Watchlist" : "☆ Add to Watchlist"}
                </button>
                <button onClick={() => navigate(session ? "/app/inspections" : `/login?redirect=/app/inspections&action=inspection&propertyId=${property.id}`)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 transition">
                  Request Inspection
                </button>
                <button onClick={() => navigate(session ? "/app/documents" : `/login?redirect=/app/documents&action=documents&propertyId=${property.id}`)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: "#800020" }}>
                  Upload Documents
                </button>
              </div>
            </div>

            {/* Service providers */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-900 mb-3">Service Providers</p>
              <div className="space-y-2.5">
                {[
                  { icon: "🔍", label: "Find Inspectors" },
                  { icon: "⚖️", label: "Find Appraisers" },
                  { icon: "🏦", label: "Find Lenders" },
                ].map((s) => (
                  <Link key={s.label} to="/service-providers"
                    className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-red-900 transition">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                    <span className="ml-auto text-gray-300">→</span>
                  </Link>
                ))}
              </div>
            </div>

            <Link to="/properties"
              className="block text-center px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
              ← View all properties
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
