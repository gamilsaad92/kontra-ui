import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PLANS = [
  {
    name: "Starter",
    price: { monthly: 0, annual: 0 },
    desc: "For individuals exploring Kontra.",
    color: "#6b7280",
    features: [
      "Up to 3 properties",
      "Public property search",
      "AI Document Review (5/mo)",
      "Basic compliance tracking",
      "Email support",
    ],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Professional",
    price: { monthly: 199, annual: 159 },
    desc: "For property owners and asset managers.",
    color: "#800020",
    features: [
      "Up to 25 properties",
      "Full AI document suite",
      "Inspection management",
      "Service provider marketplace",
      "Compliance automation",
      "Watchlist & alerts",
      "Priority support",
    ],
    cta: "Start 14-Day Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: { monthly: null, annual: null },
    desc: "For lenders, servicers, and portfolios.",
    color: "#1e40af",
    features: [
      "Unlimited properties",
      "All Professional features",
      "Lender & Servicer portals",
      "Investor portal",
      "Custom integrations",
      "Dedicated success manager",
      "SLA & uptime guarantee",
      "SSO / SAML",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Pricing</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">From individual property owners to institutional portfolios, Kontra scales with your needs.</p>
          <div className="mt-6 inline-flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${!annual ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${annual ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
              Annual
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div key={plan.name}
              className={`bg-white rounded-2xl border p-6 relative ${plan.highlight ? "border-red-200 shadow-lg" : "border-gray-200"}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: "#800020" }}>Most Popular</span>
                </div>
              )}
              <div className="mb-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-500">{plan.desc}</p>
              </div>
              <div className="mb-6">
                {plan.price.monthly === null ? (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">Custom</span>
                  </div>
                ) : plan.price.monthly === 0 ? (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">
                      ${annual ? plan.price.annual : plan.price.monthly}
                    </span>
                    <span className="text-gray-400 text-sm">/mo</span>
                    {annual && <p className="text-xs text-gray-400 mt-0.5">Billed annually</p>}
                  </div>
                )}
              </div>
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: plan.color }}>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/login"
                className={`block text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition ${plan.highlight ? "text-white hover:opacity-90" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                style={plan.highlight ? { background: "#800020" } : {}}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-400">
          All plans include a 14-day free trial. No credit card required to start. &nbsp;
          <a href="mailto:hello@kontraplatform.com" className="text-gray-600 underline">Contact us</a> with questions.
        </div>
      </div>
    </PublicLayout>
  );
}
