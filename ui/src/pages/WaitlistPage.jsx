import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const ROLES = ["Property Owner", "Investor", "Lender", "Servicer", "Borrower", "Inspector", "Consultant", "Engineer", "Asset Manager", "Other"];

const FEATURES = [
  {
    icon: "🔍",
    title: "AI Inspection Review",
    desc: "Upload property photos and inspection reports — get instant AI condition assessments, deficiency lists, and cost-to-cure estimates.",
  },
  {
    icon: "📊",
    title: "AI Financial Analysis",
    desc: "Automated DSCR, NOI, and underwriting summaries from rent rolls and operating statements. Minutes, not days.",
  },
  {
    icon: "🏷️",
    title: "CRE Marketplace",
    desc: "Find and connect with vetted inspectors, engineers, consultants, property managers, and environmental vendors.",
  },
  {
    icon: "🛡️",
    title: "Covenant & Compliance",
    desc: "Automated covenant monitoring, breach alerts, and cure workflows — with AI-powered document review built in.",
  },
];

export default function WaitlistPage() {
  const [form, setForm]       = useState({ name: "", email: "", company: "", role: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.company || !form.role) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
               style={{ background: "#800020" }}>K</div>
          <span className="font-semibold text-lg text-black">Kontra</span>
        </div>
        <a href="/login"
           className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-gray-400 transition">
          Sign in
        </a>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-800 text-xs font-medium mb-6 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Early access — limited spots available
        </div>
        <h1 className="text-5xl font-bold text-black leading-tight tracking-tight mb-5">
          The data infrastructure<br />for CRE loan servicing
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-3">
          Kontra connects lenders, servicers, investors, and borrowers on one platform —
          with AI, real-time data, and tokenization built in from day one.
        </p>
        <p className="text-sm text-gray-400 mb-12">
          Join lenders and servicers getting early access before our public launch.
        </p>

        {/* Form */}
        {!submitted ? (
          <form onSubmit={handleSubmit}
                className="max-w-xl mx-auto bg-gray-50 border border-gray-200 rounded-2xl p-8 text-left shadow-sm">
            <h2 className="text-lg font-semibold text-black mb-5">Request early access</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Full name</label>
                  <input
                    type="text"
                    placeholder="Alex Rivera"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-black
                               placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Work email</label>
                  <input
                    type="email"
                    placeholder="alex@firm.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-black
                               placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Company</label>
                <input
                  type="text"
                  placeholder="Acme Capital"
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-black
                             placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Your role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-black
                             focus:outline-none focus:border-gray-400 transition"
                >
                  <option value="">Select your role...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "#800020" }}
              >
                {loading ? "Submitting..." : "Request early access →"}
              </button>

              <p className="text-xs text-gray-400 text-center">
                No spam. We'll reach out when your spot is ready.
              </p>
            </div>
          </form>
        ) : (
          <div className="max-w-xl mx-auto bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
            <h2 className="text-xl font-semibold text-black mb-2">You're on the list</h2>
            <p className="text-gray-500 text-sm">
              Thanks, <strong>{form.name}</strong>. We'll be in touch at <strong>{form.email}</strong> when your spot is ready.
            </p>
            <a href="/login"
               className="inline-block mt-6 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition hover:opacity-90"
               style={{ background: "#800020" }}>
              Explore the demo →
            </a>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium text-center mb-10">
          What you get with Kontra
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-gray-50 border border-gray-100 rounded-xl p-6 hover:border-gray-200 transition">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-black text-sm mb-2">{f.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof strip */}
      <section className="bg-gray-50 border-t border-gray-100 px-6 py-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="text-2xl font-bold text-black">$4.5T</p>
            <p className="text-xs text-gray-500">US CRE debt market</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-black">0%</p>
            <p className="text-xs text-gray-500">of CRE loans tokenized today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-black">4 portals</p>
            <p className="text-xs text-gray-500">lender, servicer, investor, borrower</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-black">GPT-4o</p>
            <p className="text-xs text-gray-500">AI layer across all workflows</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs"
                 style={{ background: "#800020" }}>K</div>
            <span className="text-sm text-gray-400">Kontra Platform · kontraplatform.com</span>
          </div>
          <p className="text-xs text-gray-400">© 2025 Kontra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
