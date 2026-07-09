import React, { useContext, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

const PUBLIC_NAV = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "AI Tools",     href: "/ai-tools" },
  { label: "Pricing",      href: "/pricing" },
  { label: "About",        href: "/about" },
  { label: "My Deal Rooms", href: "/my-deal-rooms" },
];

const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Properties", href: "/app/properties" },
  { label: "Documents", href: "/app/documents" },
  { label: "Watchlist", href: "/app/watchlist" },
  { label: "Inspections", href: "/app/inspections" },
];

export default function PublicLayout({ children, hideFooter = false }) {
  const { session, signOut } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const isLoggedIn = !!session;
  const navLinks = isLoggedIn ? APP_NAV : PUBLIC_NAV;
  const userEmail = session?.user?.email || "User";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "#800020" }}>K</div>
            <span className="font-semibold text-lg text-gray-900">Kontra</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center max-w-xl">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === link.href || location.pathname.startsWith(link.href + "/")
                    ? "bg-red-50 text-red-900 font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}>
                {link.label}
              </Link>
            ))}
            {/* Browse marketplace link when logged in */}
            {isLoggedIn && (
              <Link to="/properties"
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                Marketplace ↗
              </Link>
            )}
          </nav>

          {/* Desktop CTA area */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {isLoggedIn ? (
              <>
                <Link to="/lender/dashboard"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                  Lender Tools
                </Link>
                <div className="relative">
                  <button onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: "#800020" }}>
                      {userEmail[0]?.toUpperCase()}
                    </div>
                    <span className="max-w-24 truncate">{userEmail.split("@")[0]}</span>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                      <Link to="/dashboard" onClick={() => setProfileOpen(false)}
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Dashboard</Link>
                      <Link to="/app/properties" onClick={() => setProfileOpen(false)}
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">My Properties</Link>
                      <div className="border-t border-gray-100 my-1" />
                      <button onClick={handleSignOut}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/my-deal-rooms"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                  My Deal Rooms
                </Link>
                <Link to="/create-deal-room"
                  className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition hover:opacity-90"
                  style={{ background: "#800020" }}>
                  Create Workspace
                </Link>
              </>
            )}
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
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                {link.label}
              </Link>
            ))}
            {isLoggedIn && (
              <Link to="/properties" onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50">
                Browse Marketplace ↗
              </Link>
            )}
            <div className="pt-2 flex flex-col gap-2">
              {isLoggedIn ? (
                <>
                  <Link to="/lender/dashboard" onClick={() => setMenuOpen(false)}
                    className="block text-center px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600">
                    Lender Tools
                  </Link>
                  <button onClick={handleSignOut}
                    className="block text-center px-4 py-2.5 rounded-lg border border-red-100 text-sm font-medium text-red-600">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/my-deal-rooms" onClick={() => setMenuOpen(false)}
                    className="block text-center px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">
                    My Deal Rooms
                  </Link>
                  <Link to="/create-deal-room" onClick={() => setMenuOpen(false)}
                    className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                    style={{ background: "#800020" }}>
                    Create Workspace
                  </Link>
                </>
              )}
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
                  The workspace where every party on a transaction — lenders, borrowers, inspectors, insurers, buyers, sellers — works from the same verified data.
                </p>
              </div>
              {[
                { title: "Deal Room", links: [
                  { label: "How It Works", href: "/how-it-works" },
                  { label: "AI Tools", href: "/ai-tools" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Service Providers", href: "/service-providers" },
                ]},
                { title: "Platform", links: [
                  { label: "Dashboard", href: "/dashboard" },
                  { label: "My Properties", href: "/app/properties" },
                  { label: "Documents", href: "/app/documents" },
                  { label: "Properties", href: "/properties" },
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
