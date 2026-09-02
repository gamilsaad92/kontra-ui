import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PRINCIPLES = [
  {
    icon: "🏗️",
    title: "Built on a real problem",
    desc: "Transactions stall because the right people can't find the right documents at the right time. Kontra exists to fix that — one transaction at a time.",
  },
  {
    icon: "🔒",
    title: "Role-scoped from day one",
    desc: "Every party in a deal sees only what they need. Lenders see risk. Inspectors see findings. Owners see everything. Privacy and clarity built in by design.",
  },
  {
    icon: "⚡",
    title: "Speed over ceremony",
    desc: "No enterprise contracts. No 6-month onboarding. Pay once, get your deal room in minutes, invite every party the same day.",
  },
  {
    icon: "📊",
    title: "Structured data, not PDFs",
    desc: "Documents become structured data automatically. AI extracts the numbers, flags the risks, and surfaces what each party needs — so nobody is reading 200-page reports.",
  },
];

export default function AboutPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleContact = (e) => {
    e.preventDefault();
    window.location.href = `mailto:hello@kontraplatform.com?subject=Hello from ${email}`;
    setSent(true);
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gray-950 text-white py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#e8a0a0" }}>About Kontra</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5" style={{ letterSpacing: "-0.03em" }}>
            Built for the people<br />already in the room.
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-xl mx-auto">
            Kontra is deal room infrastructure. We help the parties on a transaction — lender, borrower, inspector, insurer, attorney, buyer, and seller — coordinate around the same current record instead of long email chains.
          </p>
        </div>
      </section>

      {/* The problem we solve */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Why this exists</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-snug">
              Complex transactions have always run on email threads and forwarded PDFs.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              The lender needs the inspection report. The inspector uploaded it to a different folder. The insurer needs the certificate the borrower emailed three weeks ago. The underwriter is waiting on the financial statements that exist somewhere in a Dropbox.
            </p>
            <p className="text-gray-500 leading-relaxed">
              This wastes weeks. It increases risk. It keeps deals from closing. We built Kontra to solve the coordination problem at the center of every high-value transaction.
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">What a Kontra deal room does</p>
            <div className="space-y-3">
              {[
                "One deal room per transaction — all parties, all documents",
                "Role-scoped access — each party sees only what's relevant",
                "AI-assisted document review and structured transaction data",
                "Transaction status, open items, and review history in one place",
                "No subscriptions — $499 per deal room, all parties included",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ background: "#800020" }}>{i + 1}</div>
                  <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>How we build</p>
            <h2 className="text-2xl font-bold text-gray-900">Our principles</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where we are */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#800020" }}>Where we are</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Early stage. Real product.</h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              Kontra is an early-stage product focused on deal room infrastructure — the coordination layer for complex transactions. It does not broker transactions, make investment recommendations, or issue or custody digital assets.
            </p>
            <p className="text-gray-500 leading-relaxed">
              The product is available for teams evaluating a coordinated deal room. If you're working on a complex transaction and want to keep the parties aligned through closing, we'd be glad to show you how the workflow works.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "#800020" + "15" }}>📍</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Headquarters</p>
                <p className="text-xs text-gray-500">Pasadena, CA 91101</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "#800020" + "15" }}>💼</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Stage</p>
                <p className="text-xs text-gray-500">Early stage — product availability varies</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: "#800020" + "15" }}>🏢</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Focus</p>
                <p className="text-xs text-gray-500">Deal room infrastructure — coordination software, not a broker</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-gray-950 py-16">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Get in touch</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Questions about the platform, partnership inquiries, or just want to see a deal room in action — we respond to every message.
          </p>
          <div className="space-y-3">
            <a href="mailto:hello@kontraplatform.com"
              className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition">
              <span>✉️</span> hello@kontraplatform.com
            </a>
            <a href="mailto:security@kontraplatform.com"
              className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-medium text-gray-400 border border-white/10 hover:bg-white/5 transition">
              <span>🔒</span> security@kontraplatform.com
            </a>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-4">Ready to try it on a real deal?</p>
            <Link to="/create-deal-room"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#800020" }}>
              Create Your Deal Room — $499 →
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
