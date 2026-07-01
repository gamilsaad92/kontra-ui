import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { label: "Pricing",   href: "/pricing" },
  { label: "Live Demo", href: "/deal-room/kontra-demo" },
  { label: "AI Tools",  href: "/ai-tools" },
];

export default function PublicLayout({ children, hideFooter = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "#800020" }}>K</div>
            <span className="font-semibold text-lg text-gray-900">Kontra</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center max-w-xl">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} to={link.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === link.href || location.pathname.startsWith(link.href + "/")
                    ? "bg-red-50 text-red-900 font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}>
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Link to="/my-deal-rooms"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
              My Deal Rooms
            </Link>
            <Link to="/create-deal-room"
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Create Deal Room →
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden p-2 rounded-lg text-gray-500" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 pb-4 pt-2 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} to={link.href} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                {link.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/my-deal-rooms" onClick={() => setMenuOpen(false)}
                className="block text-center px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">
                My Deal Rooms
              </Link>
              <Link to="/create-deal-room" onClick={() => setMenuOpen(false)}
                className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#800020" }}>
                Create Deal Room →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="flex-1" onClick={() => { if (profileOpen) setProfileOpen(false); }}>
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      {!hideFooter && (
        <footer className="border-t border-gray-100 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="col-span-2">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ background: "#800020" }}>K</div>
                  <span className="font-semibold text-gray-900">Kontra</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                  The deal room where lenders, borrowers, inspectors, insurers, and investors work together on every CRE transaction.
                </p>
              </div>
              {[
                { title: "Product", links: [
                  { label: "Live Demo", href: "/deal-room/kontra-demo" },
                  { label: "AI Tools", href: "/ai-tools" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "How It Works", href: "/how-it-works" },
                ]},
                { title: "Owners", links: [
                  { label: "My Deal Rooms", href: "/my-deal-rooms" },
                  { label: "Create Deal Room", href: "/create-deal-room" },
                ]},
                { title: "Company", links: [
                  { label: "About", href: "/about" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Contact", href: "mailto:hello@kontraplatform.com" },
                ]},
              ].map((col) => (
                <div key={col.title}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{col.title}</p>
                  <ul className="space-y-2">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a href={link.href} className="text-sm text-gray-500 hover:text-gray-900 transition">{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-400">© 2026 Kontra Platform, Inc. All rights reserved.</p>
              <div className="flex gap-4 text-xs text-gray-400">
                <a href="/privacy" className="hover:text-gray-600">Privacy</a>
                <a href="/terms" className="hover:text-gray-600">Terms</a>
                <a href="mailto:security@kontraplatform.com" className="hover:text-gray-600">Security</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
