import { useState } from "react";
import { Link } from "react-router-dom";

const PLANS = [
  {
    tier: "Free",
    price: { monthly: "$0", annual: "$0" },
    note: "Forever free",
    color: "#475569",
    cta: "Get started free",
    ctaHref: "/waitlist",
    highlight: false,
    features: [
      { text: "5 AI reports per month", included: true },
      { text: "1 user seat", included: true },
      { text: "AI Inspection Review", included: true },
      { text: "AI Financial Analysis", included: true },
      { text: "Document Extraction (3/mo)", included: true },
      { text: "Marketplace access (view only)", included: true },
      { text: "Unlimited reports", included: false },
      { text: "Marketplace contacts", included: false },
      { text: "API access", included: false },
      { text: "Custom integrations", included: false },
    ],
  },
  {
    tier: "Pro",
    price: { monthly: "$199", annual: "$159" },
    note: "/month",
    color: "#800020",
    cta: "Start Pro free for 14 days",
    ctaHref: "/waitlist",
    highlight: true,
    badge: "Most popular",
    features: [
      { text: "Unlimited AI reports", included: true },
      { text: "5 user seats", included: true },
      { text: "All AI tools (6 modules)", included: true },
      { text: "Document Extraction (unlimited)", included: true },
      { text: "Marketplace — 20 contacts/month", included: true },
      { text: "Export to PDF & Excel", included: true },
      { text: "Priority support", included: true },
      { text: "API access", included: false },
      { text: "Custom integrations", included: false },
      { text: "Dedicated account manager", included: false },
    ],
  },
  {
    tier: "Pay-per-Use",
    price: { monthly: "From $9", annual: "From $9" },
    note: "/report",
    color: "#1D4ED8",
    cta: "Buy credits",
    ctaHref: "/waitlist",
    highlight: false,
    features: [
      { text: "Pay only for what you use", included: true },
      { text: "No monthly commitment", included: true },
      { text: "AI Inspection Report — $29", included: true },
      { text: "Financial Analysis — $19", included: true },
      { text: "Document Extraction — $9", included: true },
      { text: "Damage Assessment — $29", included: true },
      { text: "Marketplace contacts included", included: false },
      { text: "Multiple user seats", included: false },
      { text: "API access", included: false },
      { text: "Custom integrations", included: false },
    ],
  },
  {
    tier: "Enterprise",
    price: { monthly: "Custom", annual: "Custom" },
    note: "",
    color: "#065F46",
    cta: "Talk to sales",
    ctaHref: "mailto:hello@kontraplatform.com",
    highlight: false,
    badge: "For lenders & servicers",
    features: [
      { text: "Unlimited everything", included: true },
      { text: "Unlimited user seats", included: true },
      { text: "All AI tools + portals", included: true },
      { text: "Full marketplace access", included: true },
      { text: "Lender / Servicer / Investor portals", included: true },
      { text: "API & webhook access", included: true },
      { text: "Custom integrations (Salesforce, etc.)", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "SLA & uptime guarantee", included: true },
      { text: "On-premise / private cloud options", included: true },
    ],
  },
];

const FAQ = [
  {
    q: "What is a 'report' in the free tier?",
    a: "A report is any AI-generated output — an inspection review, financial analysis, damage assessment, or document extraction. The free tier includes 5 per month."
  },
  {
    q: "Can I switch plans at any time?",
    a: "Yes. You can upgrade, downgrade, or cancel at any time. If you cancel a paid plan, you'll retain access until the end of the billing period."
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes — annual plans save 20% compared to monthly billing. Contact us or select annual billing during signup."
  },
  {
    q: "What's included in Enterprise?",
    a: "Enterprise includes all four role-based portals (Lender, Servicer, Investor, Borrower), unlimited AI tools, API access, custom integrations, and a dedicated account manager."
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted in transit and at rest. We use Supabase with row-level security for data isolation between organizations."
  },
  {
    q: "Can I use Kontra without a subscription?",
    a: "Yes — the Pay-per-Use option lets you buy individual reports with no monthly commitment. Free tier is also available with no credit card."
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState("monthly");
  const [openFaq, setOpenFaq] = useState(null);

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
            <span className="hidden sm:block text-sm font-medium text-gray-600">Pricing</span>
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
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pricing</p>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-3">
          Start free. Scale as you grow.
        </h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          AI tools for every CRE professional — from individual consultants to enterprise lenders.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setBilling("monthly")}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition ${billing === "monthly" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
            Monthly
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 ${billing === "annual" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
            Annual
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: billing === "annual" ? "rgba(255,255,255,0.2)" : "rgba(128,0,32,0.08)", color: billing === "annual" ? "#fff" : "#800020" }}>
              Save 20%
            </span>
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {PLANS.map(plan => (
            <div
              key={plan.tier}
              className={`rounded-2xl p-6 flex flex-col relative ${plan.highlight ? "shadow-lg" : "border border-gray-100"}`}
              style={plan.highlight ? { background: "#800020" } : { background: "#fff" }}>

              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full shadow-sm"
                        style={plan.highlight
                          ? { background: "#fff", color: "#800020" }
                          : { background: plan.color, color: "#fff" }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-5">
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${plan.highlight ? "text-red-200" : "text-gray-400"}`}>
                  {plan.tier}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-3xl font-black ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {billing === "annual" ? plan.price.annual : plan.price.monthly}
                  </span>
                  {plan.note && (
                    <span className={`text-sm ${plan.highlight ? "text-red-200" : "text-gray-400"}`}>{plan.note}</span>
                  )}
                </div>
                {plan.tier === "Pro" && billing === "annual" && (
                  <p className={`text-xs ${plan.highlight ? "text-red-200" : "text-gray-400"}`}>
                    Billed annually ($1,908/yr)
                  </p>
                )}
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f.text}
                      className={`text-xs flex items-start gap-2 ${
                        f.included
                          ? plan.highlight ? "text-red-100" : "text-gray-700"
                          : plan.highlight ? "text-red-900 opacity-40" : "text-gray-300"
                      }`}>
                    <span className="mt-0.5 shrink-0">{f.included ? "✓" : "·"}</span>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              {plan.ctaHref.startsWith("mailto:") ? (
                <a
                  href={plan.ctaHref}
                  className={`text-center py-3 rounded-xl text-sm font-semibold transition border ${
                    plan.highlight
                      ? "bg-white text-gray-900 border-transparent hover:bg-red-50"
                      : "text-white border-transparent hover:opacity-90"
                  }`}
                  style={!plan.highlight ? { background: plan.color } : {}}>
                  {plan.cta}
                </a>
              ) : (
                <Link
                  to={plan.ctaHref}
                  className={`text-center py-3 rounded-xl text-sm font-semibold transition border ${
                    plan.highlight
                      ? "bg-white text-gray-900 border-transparent hover:bg-red-50"
                      : "text-white border-transparent hover:opacity-90"
                  }`}
                  style={!plan.highlight ? { background: plan.color } : {}}>
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Individual tool pricing */}
      <section className="border-t border-gray-100 py-16 px-6" style={{ background: "#FAFAFA" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pay-per-use pricing</p>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">Individual tool rates</h2>
            <p className="text-sm text-gray-500 mt-2">No subscription required. Buy credits and use them when you need them.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { tool: "AI Property Inspection Review", icon: "🔍", price: "$29", unit: "per report", desc: "Full AI condition assessment with deficiency list and cost-to-cure" },
              { tool: "AI Financial Analysis", icon: "📊", price: "$19", unit: "per analysis", desc: "Automated DSCR, NOI, and underwriting summary with variance flags" },
              { tool: "Document Extraction", icon: "📄", price: "$9", unit: "per document", desc: "Structured data extraction from leases, appraisals, and reports" },
              { tool: "Property Damage Assessment", icon: "⚡", price: "$29", unit: "per report", desc: "AI-powered damage evaluation and insurance claim summary" },
              { tool: "Covenant Monitoring", icon: "🛡️", price: "$49", unit: "per loan/mo", desc: "Automated covenant tracking with breach alerts and cure workflows" },
              { tool: "Draw Review", icon: "📋", price: "$15", unit: "per draw", desc: "AI validation of draw requests against project budget" },
            ].map(item => (
              <div key={item.tool} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4">
                <div className="text-xl shrink-0">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{item.tool}</p>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-gray-900">{item.price}</p>
                      <p className="text-[10px] text-gray-400">{item.unit}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Credits never expire · Bulk discounts available · <Link to="/waitlist" className="underline hover:text-gray-700 transition">Contact us for volume pricing</Link>
          </p>
        </div>
      </section>

      {/* Enterprise callout */}
      <section className="py-16 px-6" style={{ background: "#0B0F19" }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#800020" }}>Enterprise</p>
          <h2 className="text-3xl font-black tracking-tight text-white mb-3">
            For lenders, servicers, and asset managers
          </h2>
          <p className="text-sm max-w-xl mx-auto mb-8" style={{ color: "#64748B" }}>
            The full Kontra platform — all four role-based portals, unlimited AI tools, API access,
            and custom integrations. Built for organizations managing loan portfolios at scale.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Lender Portal", icon: "🏦" },
              { label: "Servicer Portal", icon: "⚙️" },
              { label: "Investor Portal", icon: "📈" },
              { label: "Borrower Portal", icon: "🏘️" },
            ].map(p => (
              <div key={p.label}
                   className="rounded-xl p-4 text-center border"
                   style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div className="text-2xl mb-2">{p.icon}</div>
                <p className="text-xs font-medium" style={{ color: "#94A3B8" }}>{p.label}</p>
              </div>
            ))}
          </div>
          <a href="mailto:hello@kontraplatform.com"
             className="inline-flex text-sm font-semibold px-6 py-3 rounded-xl text-white transition border hover:bg-white hover:text-gray-900"
             style={{ borderColor: "rgba(255,255,255,0.2)" }}>
            Talk to sales →
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">FAQ</p>
          <h2 className="text-2xl font-black tracking-tight text-gray-900">Common questions</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {FAQ.map((item, i) => (
            <div key={i} className="py-4">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-start justify-between gap-4 text-left">
                <span className="text-sm font-medium text-gray-900">{item.q}</span>
                <span className="text-gray-400 shrink-0 mt-0.5">
                  {openFaq === i ? "−" : "+"}
                </span>
              </button>
              {openFaq === i && (
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8" style={{ background: "#FAFAFA" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-xs"
                 style={{ background: "#800020" }}>K</div>
            <span className="text-sm text-gray-400">Kontra Platform</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <Link to="/" className="hover:text-gray-700 transition">Home</Link>
            <Link to="/marketplace" className="hover:text-gray-700 transition">Marketplace</Link>
            <Link to="/login" className="hover:text-gray-700 transition">Sign in</Link>
          </div>
          <p className="text-xs text-gray-400">© 2025 Kontra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
