import { useState } from "react";
import { Link } from "react-router-dom";

const TOOLS = [
  {
    icon: "🔍",
    name: "AI Property Inspection Review",
    desc: "Upload inspection photos and reports. Get an AI-powered condition assessment, deficiency list, and cost-to-cure estimate in minutes.",
    badge: "AI",
    href: "/tools/ai-inspection-review",
    color: "#800020",
  },
  {
    icon: "📊",
    name: "AI Property Financial Analysis",
    desc: "Upload rent rolls, T-12s, and operating statements. Get automated DSCR, NOI, and underwriting summaries with variance flags.",
    badge: "AI",
    href: "/tools/property-financial-analysis",
    color: "#6D28D9",
  },
  {
    icon: "⚡",
    name: "Property Recovery & Claim Tracking",
    desc: "Track property damage, insurance claims, and recovery timelines. Automated status updates across adjusters, contractors, and lenders.",
    badge: "NEW",
    href: "/tools/property-damage-assessment",
    color: "#065F46",
  },
  {
    icon: "📋",
    name: "Draw Review & Management",
    desc: "Streamline construction draw approvals. AI validates line items against budgets and flags over-disbursements automatically.",
    badge: "AI",
    href: "/login",
    color: "#92400E",
  },
  {
    icon: "📄",
    name: "Document Extraction & Analysis",
    desc: "Extract structured data from any CRE document — leases, appraisals, environmental reports — using OCR and AI parsing.",
    badge: "AI",
    href: "/document-extraction",
    color: "#1D4ED8",
  },
  {
    icon: "🛡️",
    name: "Covenant & Compliance Monitoring",
    desc: "Track loan covenants, trigger alerts on breaches, and generate cure workflows — all automated with AI-powered document review.",
    badge: "AI",
    href: "/login",
    color: "#B45309",
  },
];

const WHO_ITS_FOR = [
  { icon: "🏗️", title: "Property Owners", desc: "Track assets, manage vendors, analyze financials, and monitor insurance claims across your entire portfolio." },
  { icon: "💼", title: "Investors", desc: "Review deal financials, track distributions, and get AI-powered underwriting summaries before you commit." },
  { icon: "🏦", title: "Lenders", desc: "Automate covenant monitoring, inspection review, and draw management across your entire loan book." },
  { icon: "⚙️", title: "Servicers", desc: "Manage draws, escrows, borrower financials, and compliance workflows on one unified platform." },
  { icon: "🔎", title: "Inspectors", desc: "Submit inspection reports digitally, get AI-assisted findings summaries, and connect with lenders directly." },
  { icon: "🏘️", title: "Borrowers", desc: "View your loan status, submit documents, track draw requests, and communicate with your servicer — all in one place." },
  { icon: "🧑‍💼", title: "Consultants", desc: "Use AI tools to prepare financial analyses, inspection reviews, and due diligence packages for clients." },
  { icon: "🌿", title: "Asset Managers", desc: "Monitor property performance, track capital projects, and coordinate with vendors across your managed portfolio." },
];

const STATS = [
  { value: "$4.5T", label: "US CRE debt market" },
  { value: "8+", label: "AI-powered tools" },
  { value: "4", label: "Role-based portals" },
  { value: "GPT-4o", label: "AI engine" },
];

const MARKETPLACE_CATEGORIES = [
  { icon: "🔍", label: "Inspectors" },
  { icon: "🏗️", label: "Engineers" },
  { icon: "📐", label: "Consultants" },
  { icon: "🌿", label: "Environmental" },
  { icon: "🏢", label: "Property Managers" },
  { icon: "⚖️", label: "Legal" },
];

export default function PublicHomePage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleQuickSignup = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                 style={{ background: "#800020" }}>K</div>
            <span className="font-bold text-lg tracking-tight">Kontra</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/tools/ai-inspection-review" className="hover:text-gray-900 transition">AI Tools</Link>
            <Link to="/marketplace" className="hover:text-gray-900 transition">Marketplace</Link>
            <Link to="/pricing" className="hover:text-gray-900 transition">Pricing</Link>
            <Link to="/login" className="hover:text-gray-900 transition">Sign in</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login"
              className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-400 transition">
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

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
             style={{ background: "rgba(128,0,32,0.06)", borderColor: "rgba(128,0,32,0.2)", color: "#800020" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#800020" }} />
          Now in beta — limited access
        </div>

        <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tight mb-6 text-gray-900">
          AI tools for commercial<br />
          <span style={{ color: "#800020" }}>real estate professionals</span>
        </h1>

        <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-4">
          Kontra is an AI-powered platform and marketplace for CRE professionals —
          from property inspection and financial analysis to vendor coordination and compliance tracking.
        </p>

        <p className="text-sm text-gray-400 mb-10">
          Used by property owners, investors, lenders, servicers, borrowers, and consultants.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/waitlist"
            className="w-full sm:w-auto text-sm font-semibold px-6 py-3 rounded-xl text-white transition hover:opacity-90"
            style={{ background: "#800020" }}>
            Get started free →
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto text-sm font-medium px-6 py-3 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition">
            Explore the demo
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Free tier available · No credit card required · Enterprise plans available
        </p>
      </section>

      {/* ── Stats ── */}
      <section className="border-t border-b border-gray-100" style={{ background: "#FAFAFA" }}>
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-3xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Tools ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">AI-powered tools</p>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">
            Every CRE workflow, powered by AI
          </h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
            Upload your documents, financials, or photos — and get structured, AI-generated analysis in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TOOLS.map(tool => (
            <Link
              key={tool.name}
              to={tool.href}
              className="group border border-gray-100 rounded-2xl p-6 hover:border-gray-300 hover:shadow-sm transition-all bg-white"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{tool.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{tool.name}</h3>
                    <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${tool.color}15`, color: tool.color }}>
                      {tool.badge}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">{tool.desc}</p>
                </div>
              </div>
              <div className="mt-4 text-xs font-medium text-gray-400 group-hover:text-gray-700 transition">
                Learn more →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Marketplace Teaser ── */}
      <section className="border-t border-gray-100 py-20" style={{ background: "#0B0F19" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#800020" }}>
              Marketplace
            </p>
            <h2 className="text-3xl font-black tracking-tight text-white">
              Find vetted CRE professionals
            </h2>
            <p className="text-sm mt-3 max-w-xl mx-auto leading-relaxed" style={{ color: "#64748B" }}>
              Connect with inspectors, engineers, consultants, property managers, and environmental vendors — 
              all pre-screened and rated by the Kontra community.
            </p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10">
            {MARKETPLACE_CATEGORIES.map(cat => (
              <Link
                key={cat.label}
                to="/marketplace"
                className="flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition hover:border-gray-600"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-medium" style={{ color: "#94A3B8" }}>{cat.label}</span>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl border transition hover:bg-white hover:text-gray-900"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#E2E8F0" }}>
              Browse the marketplace →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Built for everyone in CRE</p>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">
            One platform. Every role.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WHO_ITS_FOR.map(item => (
            <div key={item.title}
                 className="border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition">
              <div className="text-xl mb-3">{item.icon}</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1.5">{item.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section className="border-t border-gray-100 py-20" style={{ background: "#FAFAFA" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pricing</p>
          <h2 className="text-3xl font-black tracking-tight text-gray-900 mb-3">
            Start free. Scale as you grow.
          </h2>
          <p className="text-gray-500 text-sm mb-8 max-w-md mx-auto">
            Access core AI tools for free. Upgrade to Pro for unlimited reports, or talk to us about Enterprise.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              { tier: "Free", price: "$0", note: "Forever", features: ["5 AI reports/month", "1 user", "Core tools access"] },
              { tier: "Pro", price: "$199", note: "/month", features: ["Unlimited reports", "5 users", "All AI tools + marketplace"], highlight: true },
              { tier: "Enterprise", price: "Custom", note: "", features: ["Unlimited users", "Custom integrations", "Dedicated support"] },
            ].map(plan => (
              <div key={plan.tier}
                   className={`rounded-2xl p-6 border text-left ${plan.highlight ? "border-transparent" : "border-gray-200 bg-white"}`}
                   style={plan.highlight ? { background: "#800020", border: "none" } : {}}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.highlight ? "text-red-200" : "text-gray-400"}`}>
                  {plan.tier}
                </p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className={`text-3xl font-black ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? "text-red-200" : "text-gray-400"}`}>{plan.note}</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className={`text-xs flex items-center gap-2 ${plan.highlight ? "text-red-100" : "text-gray-600"}`}>
                      <span>{plan.highlight ? "✓" : "·"}</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Link
            to="/pricing"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition underline underline-offset-4">
            See full pricing comparison →
          </Link>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-black tracking-tight text-gray-900 mb-4">
          Ready to put AI to work<br />on your CRE portfolio?
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          Join property professionals using Kontra to save time and make better decisions.
        </p>

        {!submitted ? (
          <form onSubmit={handleQuickSignup} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 transition"
            />
            <button
              type="submit"
              className="text-sm font-semibold px-5 py-3 rounded-xl text-white transition hover:opacity-90 whitespace-nowrap"
              style={{ background: "#800020" }}>
              Get started free →
            </button>
          </form>
        ) : (
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-green-200 bg-green-50 text-green-800 text-sm font-medium">
            ✓ Check your email — we'll be in touch shortly
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">No credit card required · Free tier available · Cancel anytime</p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-6 py-10" style={{ background: "#FAFAFA" }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                     style={{ background: "#800020" }}>K</div>
                <span className="font-bold text-gray-900">Kontra</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                AI tools and marketplace for commercial real estate professionals.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tools</p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li><Link to="/tools/ai-inspection-review" className="hover:text-gray-900 transition">AI Inspection Review</Link></li>
                <li><Link to="/tools/property-financial-analysis" className="hover:text-gray-900 transition">Financial Analysis</Link></li>
                <li><Link to="/tools/property-damage-assessment" className="hover:text-gray-900 transition">Damage Assessment</Link></li>
                <li><Link to="/tools/dscr-calculator" className="hover:text-gray-900 transition">DSCR Calculator</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Platform</p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li><Link to="/marketplace" className="hover:text-gray-900 transition">Marketplace</Link></li>
                <li><Link to="/pricing" className="hover:text-gray-900 transition">Pricing</Link></li>
                <li><Link to="/waitlist" className="hover:text-gray-900 transition">Early Access</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Portals</p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li><Link to="/login" className="hover:text-gray-900 transition">Lender Portal</Link></li>
                <li><Link to="/login" className="hover:text-gray-900 transition">Investor Portal</Link></li>
                <li><Link to="/login" className="hover:text-gray-900 transition">Borrower Portal</Link></li>
                <li><Link to="/login" className="hover:text-gray-900 transition">Servicer Portal</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Company</p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li><a href="mailto:hello@kontraplatform.com" className="hover:text-gray-900 transition">Contact</a></li>
                <li><Link to="/login" className="hover:text-gray-900 transition">Sign in</Link></li>
                <li><Link to="/waitlist" className="hover:text-gray-900 transition">Get access</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">© 2025 Kontra Platform. All rights reserved.</p>
            <p className="text-xs text-gray-400">AI tools and marketplace for CRE professionals · kontraplatform.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
