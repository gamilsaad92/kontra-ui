import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import { AuthContext } from "../../lib/authContext";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const PLANS = [
  {
    id: "deal",
    name: "Per Deal",
    price: { monthly: 499, annual: 499 },
    priceNote: "per deal",
    desc: "For a single transaction. Pay once, close the deal.",
    color: "#065f46",
    features: [
      "1 property deal room",
      "Unlimited party invites",
      "Full AI document suite",
      "Investment Readiness Report",
      "All party portals included",
      "90-day access after close",
    ],
    cta: "Start a Deal Room",
    ctaAction: "contact",
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: { monthly: 199, annual: 159 },
    priceNote: "/mo",
    desc: "For owners and managers with ongoing deals.",
    color: "#800020",
    features: [
      "Up to 25 active deal rooms",
      "Full AI document suite",
      "Inspection management",
      "Service provider network",
      "Compliance automation",
      "Watchlist & portfolio alerts",
      "Priority support",
    ],
    cta: "Start 14-Day Trial",
    ctaAction: "checkout",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: { monthly: null, annual: null },
    priceNote: null,
    desc: "For lenders, servicers, and institutional portfolios.",
    color: "#1e40af",
    features: [
      "Unlimited deal rooms",
      "All Professional features",
      "Lender & Servicer portals",
      "Investor portal",
      "Custom integrations",
      "Dedicated success manager",
      "SLA & uptime guarantee",
      "SSO / SAML",
    ],
    cta: "Contact Sales",
    ctaAction: "contact",
    highlight: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const { session } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCta = async (plan) => {
    if (plan.ctaAction === "contact") {
      window.location.href = "mailto:hello@kontraplatform.com?subject=Kontra Enterprise";
      return;
    }
    if (plan.ctaAction === "signup") {
      navigate("/login");
      return;
    }
    if (plan.ctaAction === "checkout") {
      if (!session) {
        navigate("/login?redirect=/pricing");
        return;
      }
      setLoadingPlan(plan.id);
      try {
        const token = session?.access_token;
        const res = await fetch(`${API_BASE}/api/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ plan: plan.id, billing: annual ? "annual" : "monthly" }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          window.location.href = `mailto:hello@kontraplatform.com?subject=Kontra Pro Plan — ${annual ? "Annual" : "Monthly"}`;
        }
      } catch {
        window.location.href = `mailto:hello@kontraplatform.com?subject=Kontra Pro Plan`;
      } finally {
        setLoadingPlan(null);
      }
    }
  };

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
                  <div><span className="text-3xl font-bold text-gray-900">Custom</span></div>
                ) : plan.price.monthly === 0 ? (
                  <div><span className="text-3xl font-bold text-gray-900">Free</span></div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">
                      ${plan.id === "deal" ? plan.price.monthly : (annual ? plan.price.annual : plan.price.monthly)}
                    </span>
                    <span className="text-gray-400 text-sm">{plan.priceNote}</span>
                    {annual && plan.id !== "deal" && plan.price.monthly !== plan.price.annual && (
                      <p className="text-xs text-gray-400 mt-0.5">Billed annually · Save ${(plan.price.monthly - plan.price.annual) * 12}/yr</p>
                    )}
                    {plan.id === "deal" && (
                      <p className="text-xs text-gray-400 mt-0.5">One-time · No subscription required</p>
                    )}
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
              <button
                onClick={() => handleCta(plan)}
                disabled={loadingPlan === plan.id}
                className={`w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-70 ${
                  plan.highlight
                    ? "text-white hover:opacity-90"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                style={plan.highlight ? { background: "#800020" } : {}}>
                {loadingPlan === plan.id && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {loadingPlan === plan.id ? "Redirecting…" : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-400">
          All plans include a 14-day free trial. No credit card required to start. &nbsp;
          <a href="mailto:hello@kontraplatform.com" className="text-gray-600 underline">Contact us</a> with questions.
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">Common questions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { q: "What counts as a property?", a: "Any commercial real estate asset — multifamily, office, industrial, retail, or mixed-use. Each property gets its own dedicated workspace." },
              { q: "Can I upgrade or downgrade anytime?", a: "Yes. You can upgrade, downgrade, or cancel at any time from your account settings. Annual plans are prorated on upgrade." },
              { q: "Is my data secure?", a: "Yes. All data is encrypted at rest and in transit. We use Supabase (SOC 2 Type II) for data storage with row-level security." },
              { q: "What's included in the AI document suite?", a: "Inspection analysis, financial statement review, insurance policy review, rent roll analysis, and lease abstraction — all powered by GPT-4o." },
            ].map((faq) => (
              <div key={faq.q} className="bg-gray-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">{faq.q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
