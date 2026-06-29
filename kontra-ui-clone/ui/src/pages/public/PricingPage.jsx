import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const DEAL_FEATURES = [
  "Unlimited participants",
  "Unlimited document uploads",
  "AI review — inspection, insurance, financials, legal",
  "Deal Health Score (0–100 risk ring)",
  "Automated email notifications on every upload",
  "File versioning — v1, v2, latest tracked automatically",
  "Lender-facing share page",
  "PDF deal summary export",
  "90-day access after close",
];

const ENTERPRISE_FEATURES = [
  "Everything in Deal Room",
  "Multiple deal rooms under one account",
  "Lender & underwriter dashboard",
  "Volume pricing available",
  "White-label options",
  "Dedicated support",
  "SLA & uptime guarantee",
  "SSO / SAML",
];

const FAQS = [
  {
    q: "What counts as a deal room?",
    a: "One deal room = one property. Each room holds all parties, all documents, and all AI analysis for that transaction. Pay once, use it for the life of the deal.",
  },
  {
    q: "Who can access the deal room?",
    a: "Anyone you invite. Owner, lender, inspector, insurer, attorney, underwriter — each gets a role-scoped link to the same workspace. No account creation required for invited parties.",
  },
  {
    q: "What documents does AI analyze?",
    a: "Inspection reports, insurance policies, financial statements (with DSCR/NOI extraction), legal documents, and hotel PIP / brand standards — all powered by GPT-4o.",
  },
  {
    q: "What is file versioning?",
    a: "When someone re-uploads a document (e.g. Inspection_v2.pdf), Kontra tracks it as Version 2. The deal room always shows the latest analysis and keeps the full history. No more 'which PDF is current?'",
  },
  {
    q: "Is there a subscription?",
    a: "No. You pay $499 once per deal room. No monthly fees, no seat charges, no surprises. For multiple active deals, contact us for volume pricing.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted at rest and in transit. We use Supabase (SOC 2 Type II) for data storage with row-level security. Uploaded documents are stored in private, signed-URL-only object storage.",
  },
];

export default function PricingPage() {
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const handleCheckout = async () => {
    setLoadingCheckout(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "deal" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        window.location.href = "/create-deal-room";
      }
    } catch {
      window.location.href = "/create-deal-room";
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#800020" }}>Pricing</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            One price.<br />Zero confusion.
          </h1>
          <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">
            Commercial real estate transactions shouldn't require 700 emails.
            Open a deal room and close faster.
          </p>
        </div>

        {/* Main card */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">

          {/* Deal Room card */}
          <div className="bg-white rounded-2xl border-2 p-8 relative shadow-lg" style={{ borderColor: "#800020" }}>
            <div className="absolute -top-3.5 left-8">
              <span className="px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: "#800020" }}>
                Per Transaction
              </span>
            </div>
            <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-900">Open a Deal Room</h2>
              <p className="text-sm text-gray-500 mt-1">Pay once. No subscription. No seat fees.</p>
            </div>
            <div className="my-6 pb-6 border-b border-gray-100">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-gray-900">$499</span>
                <span className="text-gray-400 text-sm">/ deal</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">One-time · 90-day access · No credit card at signup</p>
            </div>
            <ul className="space-y-3 mb-8">
              {DEAL_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: "#800020" }}>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/create-deal-room"
              className="w-full block text-center py-3.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Open a Deal Room →
            </Link>
          </div>

          {/* Enterprise card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col">
            <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-900">Volume / Enterprise</h2>
              <p className="text-sm text-gray-500 mt-1">For lenders, servicers, and teams with ongoing deal flow.</p>
            </div>
            <div className="my-6 pb-6 border-b border-gray-100">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">Custom</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Multiple deal rooms · Volume discounts · White-label</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {ENTERPRISE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="mailto:hello@kontraplatform.com?subject=Kontra Volume Pricing"
              className="w-full block text-center py-3.5 rounded-xl text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
              Contact Us →
            </a>
          </div>
        </div>

        {/* Social proof strip */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-16 text-center">
          <p className="text-sm font-semibold text-gray-900 mb-4">What you're replacing</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500">
            {[
              { label: "700+ emails per deal", icon: "📧" },
              { label: "Shared Dropbox folders", icon: "📂" },
              { label: "Manual PDF forwarding", icon: "📄" },
              { label: "Version confusion", icon: "🔀" },
              { label: "No single source of truth", icon: "❓" },
            ].map(({ label, icon }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg line-through decoration-red-400">
                <span>{icon}</span>{label}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">Common questions</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-gray-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">{faq.q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center text-sm text-gray-400">
          Questions?{" "}
          <a href="mailto:hello@kontraplatform.com" className="text-gray-600 underline">
            hello@kontraplatform.com
          </a>
        </div>

      </div>
    </PublicLayout>
  );
}
