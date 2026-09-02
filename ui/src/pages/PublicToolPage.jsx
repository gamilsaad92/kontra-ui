import { Link, useParams } from "react-router-dom";

const TOOL_DATA = {
  "ai-inspection-review": {
    icon: "🔍",
    name: "AI Property Inspection Review",
    hero: "AI-powered property condition assessments in minutes",
    desc: "Upload inspection photos and reports. Get an AI-generated condition assessment, prioritized deficiency list, and cost-to-cure estimate — in minutes, not days.",
    color: "#800020",
    loginPath: "/inspection",
    seo: {
      title: "AI Property Inspection Review | Kontra",
      description: "AI-powered commercial property inspection review. Upload photos and reports, get instant condition assessments and deficiency lists.",
    },
    useCases: [
      { icon: "🏗️", title: "Construction Lenders", desc: "Validate draw requests against inspection findings and flag over-disbursements before they happen." },
      { icon: "💼", title: "Investors & Buyers", desc: "Get AI-assisted condition summaries during due diligence — faster than waiting for a manual review." },
      { icon: "🔍", title: "Inspectors", desc: "Submit digital reports and generate AI-powered summaries automatically for your clients." },
      { icon: "🏦", title: "Servicers", desc: "Track property condition trends across your loan book with automated inspection scoring." },
    ],
    howItWorks: [
      { step: "1", title: "Upload your report", desc: "Upload a PDF inspection report, photos, or both. Supported formats: PDF, JPG, PNG, DOCX." },
      { step: "2", title: "AI analyzes the data", desc: "Our AI model reads the report, identifies deficiencies, categorizes severity, and estimates costs." },
      { step: "3", title: "Review and export", desc: "Get a structured summary with a deficiency table, severity ratings, and cost-to-cure estimates. Export to PDF." },
    ],
    stats: [
      { value: "< 3 min", label: "Average processing time" },
      { value: "95%", label: "Accuracy vs. manual review" },
      { value: "12K+", label: "Reports processed" },
      { value: "$29", label: "Per report (pay-per-use)" },
    ],
  },
  "property-financial-analysis": {
    icon: "📊",
    name: "AI Property Financial Analysis",
    hero: "Automated DSCR, NOI, and underwriting in seconds",
    desc: "Upload rent rolls, T-12 operating statements, or borrower financials. Get a complete AI-powered financial analysis with DSCR, NOI trends, variance flags, and underwriting summary.",
    color: "#6D28D9",
    loginPath: "/portfolio/underwriting",
    seo: {
      title: "AI Property Financial Analysis | Kontra",
      description: "AI-powered CRE financial analysis. Upload rent rolls and operating statements for automated DSCR, NOI, and underwriting summaries.",
    },
    useCases: [
      { icon: "🏦", title: "Lenders & Underwriters", desc: "Reduce underwriting time from days to minutes. AI handles the math — you handle the judgment." },
      { icon: "💼", title: "Investors", desc: "Analyze deal financials before committing. Get DSCR, cap rates, and cash-on-cash returns instantly." },
      { icon: "🧑‍💼", title: "Consultants", desc: "Prepare financial analysis packages for clients faster with AI-assisted data extraction and modeling." },
      { icon: "🏘️", title: "Property Owners", desc: "Understand your property's financial performance with clear AI-generated reports and trend analysis." },
    ],
    howItWorks: [
      { step: "1", title: "Upload financials", desc: "Upload a T-12, rent roll, operating statement, or tax return in PDF or Excel format." },
      { step: "2", title: "AI extracts and models", desc: "AI extracts line items, normalizes the data, calculates DSCR, NOI, and key metrics, and flags variances." },
      { step: "3", title: "Review the analysis", desc: "Get a structured underwriting summary with trend charts, metric breakdowns, and lender-ready export." },
    ],
    stats: [
      { value: "< 2 min", label: "Analysis time" },
      { value: "DSCR + NOI", label: "Core metrics calculated" },
      { value: "20+", label: "Financial metrics" },
      { value: "$19", label: "Per analysis (pay-per-use)" },
    ],
  },
  "property-damage-assessment": {
    icon: "⚡",
    name: "Property Recovery & Claim Tracking",
    hero: "Track property damage claims and recovery workflows",
    desc: "Manage property damage events from first notice of loss through final settlement. AI-powered damage assessment, contractor coordination, and insurance claim tracking — all in one place.",
    color: "#065F46",
    loginPath: "/hazard-recovery",
    seo: {
      title: "Property Damage Assessment & Claim Tracking | Kontra",
      description: "AI-powered property damage assessment and insurance claim tracking for CRE professionals. Manage recovery from FNOL to final settlement.",
    },
    useCases: [
      { icon: "🏢", title: "Property Owners", desc: "Track damage claims, coordinate with adjusters and contractors, and monitor recovery timelines — all in one dashboard." },
      { icon: "🏦", title: "Lenders & Servicers", desc: "Monitor hazard events across your loan portfolio. Get alerts and track claim status to protect collateral value." },
      { icon: "⚖️", title: "Insurance Adjusters", desc: "Collaborate with property owners and lenders on claim documentation and settlement workflows." },
      { icon: "🔧", title: "Contractors", desc: "Receive work orders, submit progress photos, and track draw approvals through the Kontra platform." },
    ],
    howItWorks: [
      { step: "1", title: "Report the damage event", desc: "Log a new damage event with property details, event type, and initial photos or documents." },
      { step: "2", title: "AI assesses and categorizes", desc: "AI analyzes uploaded photos and documents to categorize damage severity and estimate restoration cost ranges." },
      { step: "3", title: "Track to resolution", desc: "Manage the full recovery workflow — adjuster coordination, contractor draws, and final settlement — in one place." },
    ],
    stats: [
      { value: "FNOL → Close", label: "Full workflow coverage" },
      { value: "Real-time", label: "Status tracking" },
      { value: "All perils", label: "Supported event types" },
      { value: "$29", label: "Per assessment" },
    ],
  },
  "dscr-calculator": {
    icon: "🧮",
    name: "DSCR Calculator",
    hero: "Free debt service coverage ratio calculator for CRE",
    desc: "Calculate DSCR, debt yield, and loan-to-value ratios instantly. Free tool for lenders, borrowers, and investors evaluating commercial real estate loans.",
    color: "#1D4ED8",
    loginPath: "/portfolio/underwriting",
    seo: {
      title: "Free DSCR Calculator — Commercial Real Estate | Kontra",
      description: "Free commercial real estate DSCR calculator. Calculate debt service coverage ratio, debt yield, and LTV for CRE loans instantly.",
    },
    useCases: [
      { icon: "🏦", title: "Lenders", desc: "Quickly calculate DSCR during initial loan screening before committing to full underwriting." },
      { icon: "🏘️", title: "Borrowers", desc: "Understand whether your property qualifies for financing before approaching lenders." },
      { icon: "💼", title: "Investors", desc: "Evaluate deals on the fly — know the debt coverage before your call with the broker ends." },
      { icon: "🧑‍💼", title: "Brokers", desc: "Run quick DSCR checks for clients to determine loan viability and set expectations." },
    ],
    howItWorks: [
      { step: "1", title: "Enter property income", desc: "Input gross rents, vacancy rate, and operating expenses to calculate NOI." },
      { step: "2", title: "Enter loan terms", desc: "Input loan amount, interest rate, and amortization period to calculate annual debt service." },
      { step: "3", title: "Get your DSCR", desc: "Instantly see your DSCR, debt yield, LTV, and a quick lender eligibility assessment." },
    ],
    stats: [
      { value: "Free", label: "No account required" },
      { value: "Instant", label: "Calculation time" },
      { value: "DSCR + LTV", label: "Key metrics" },
      { value: "6+", label: "Calculated outputs" },
    ],
  },
  "insurance-claim-tracking": {
    icon: "🛡️",
    name: "Insurance Claim Tracking",
    hero: "Track CRE insurance claims from filing to settlement",
    desc: "Manage your commercial property insurance claims with a centralized dashboard. Track adjuster communications, document submissions, and settlement timelines — all in one place.",
    color: "#B45309",
    loginPath: "/hazard-recovery",
    seo: {
      title: "CRE Insurance Claim Tracking | Kontra",
      description: "Track commercial real estate insurance claims from first notice of loss to settlement. Centralized dashboard for property owners and lenders.",
    },
    useCases: [
      { icon: "🏢", title: "Property Owners", desc: "Track every open claim across your portfolio. Never miss a deadline or lose a document again." },
      { icon: "🏦", title: "Servicers", desc: "Monitor insurance claims affecting loan collateral. Get alerts and coordinate disbursements." },
      { icon: "⚖️", title: "Adjusters", desc: "Collaborate on claims digitally — share assessments, request documents, and update status in real time." },
      { icon: "🧑‍💼", title: "Risk Managers", desc: "Get a portfolio-level view of all active claims with severity ratings and resolution timelines." },
    ],
    howItWorks: [
      { step: "1", title: "Log your claim", desc: "Create a claim record with policy details, event date, property info, and initial loss documentation." },
      { step: "2", title: "Track milestones", desc: "Log adjuster visits, document submissions, reserve changes, and denial or approval events." },
      { step: "3", title: "Close with documentation", desc: "Record the final settlement, upload the release, and archive the complete claim file." },
    ],
    stats: [
      { value: "All perils", label: "Supported" },
      { value: "Real-time", label: "Status updates" },
      { value: "Portfolio view", label: "Across properties" },
      { value: "Free tier", label: "Available" },
    ],
  },
};

export default function PublicToolPage() {
  const { toolSlug } = useParams();
  const tool = TOOL_DATA[toolSlug];

  if (!tool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tool not found</h1>
          <p className="text-gray-500 mb-6">That tool doesn't exist or may have moved.</p>
          <Link to="/" className="text-sm font-medium px-4 py-2 rounded-lg text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>Back to home</Link>
        </div>
      </div>
    );
  }

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
            <span className="hidden sm:block text-sm font-medium text-gray-600">{tool.name}</span>
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
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 border"
             style={{ background: `${tool.color}08`, borderColor: `${tool.color}25`, color: tool.color }}>
          <span className="text-base">{tool.icon}</span>
          AI-powered tool
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-5 leading-tight">
          {tool.hero}
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-8">
          {tool.desc}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/waitlist"
            className="w-full sm:w-auto text-sm font-semibold px-6 py-3 rounded-xl text-white transition hover:opacity-90"
            style={{ background: tool.color }}>
            Try it free →
          </Link>
          <Link to="/login"
            className="w-full sm:w-auto text-sm font-medium px-6 py-3 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition">
            Sign in to use tool
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-b border-gray-100" style={{ background: "#FAFAFA" }}>
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {tool.stats.map(s => (
            <div key={s.label}>
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">How it works</p>
          <h2 className="text-2xl font-black tracking-tight text-gray-900">
            Three steps. Minutes, not days.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tool.howItWorks.map(step => (
            <div key={step.step} className="text-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm mx-auto mb-4"
                   style={{ background: tool.color }}>
                {step.step}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-gray-100 py-16 px-6" style={{ background: "#FAFAFA" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Who it's for</p>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">Built for every CRE professional</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tool.useCases.map(uc => (
              <div key={uc.title} className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="text-xl mb-3">{uc.icon}</div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1.5">{uc.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pricing</p>
        <h2 className="text-2xl font-black tracking-tight text-gray-900 mb-3">
          Simple, transparent pricing
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Free tier", value: "5 reports/mo", note: "No credit card" },
            { label: "Pay-per-use", value: tool.stats.find(s => s.label.includes("per"))?.value || "$19+", note: "No subscription" },
            { label: "Pro plan", value: "$199/mo", note: "Unlimited reports" },
          ].map(p => (
            <div key={p.label} className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{p.label}</p>
              <p className="text-lg font-black text-gray-900">{p.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.note}</p>
            </div>
          ))}
        </div>
        <Link to="/pricing"
          className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-4 transition">
          See full pricing comparison →
        </Link>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 py-16 px-6 text-center" style={{ background: "#FAFAFA" }}>
        <h2 className="text-3xl font-black tracking-tight text-gray-900 mb-3">
          Ready to try {tool.name}?
        </h2>
        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
          Start free — no credit card required. Or sign in if you already have an account.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/waitlist"
            className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition hover:opacity-90"
            style={{ background: tool.color }}>
            Get started free →
          </Link>
          <Link to="/login"
            className="text-sm font-medium px-6 py-3 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-400 transition">
            Sign in
          </Link>
        </div>
      </section>

      {/* Other tools */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">More tools</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(TOOL_DATA)
            .filter(([slug]) => slug !== toolSlug)
            .map(([slug, t]) => (
              <Link
                key={slug}
                to={`/tools/${slug}`}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-gray-400 transition">
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </Link>
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
            <Link to="/pricing" className="hover:text-gray-700 transition">Pricing</Link>
          </div>
          <p className="text-xs text-gray-400">© 2025 Kontra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
