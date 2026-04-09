/**
 * PortalSelectPage — neutral post-login portal selection screen.
 *
 * Shown when the authenticated user has access to more than one portal
 * (e.g. a platform_admin or lender_admin who can review all three portals).
 *
 * Single-role users (investor, borrower, servicer, asset_manager) are
 * never routed here — they get a direct redirect from usePortalRouter.
 */

import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import { getAppRoleFromToken } from "../lib/usePortalRouter";

type PortalCard = {
  id: string;
  label: string;
  description: string;
  path: string;
  accent: string;
  ring: string;
  iconBg: string;
  icon: React.ReactNode;
  available: boolean;
};

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15l.75 18H3.75L4.5 3zM8.25 21V10.5M12 21V10.5M15.75 21V10.5M8.25 7.5h.008v.008H8.25V7.5zm3.75 0h.008v.008H12V7.5zm3.75 0h.008v.008h-.008V7.5z" />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function HomeModernIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  );
}

export default function PortalSelectPage() {
  const { session, signOut } = useContext(AuthContext) as {
    session: { access_token?: string; user?: { email?: string; user_metadata?: Record<string, string> } } | null;
    signOut: () => Promise<void>;
  };
  const navigate = useNavigate();

  const role = getAppRoleFromToken(session?.access_token);
  const userEmail = session?.user?.email ?? "";
  const userName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.name ??
    userEmail.split("@")[0] ??
    "there";

  const isPlatformAdmin = role === "platform_admin";
  const isLenderAdmin   = role === "lender_admin";

  const portals: PortalCard[] = [
    {
      id: "lender",
      label: "Lender / Servicer Workspace",
      description: "Loan origination, asset management, servicing, capital markets, and full platform control.",
      path: "/dashboard",
      accent: "text-brand-300",
      ring: "ring-brand-700 hover:ring-brand-500",
      iconBg: "bg-brand-900/50 text-brand-400",
      icon: <BuildingIcon />,
      available: true,
    },
    {
      id: "investor",
      label: "Investor Portal",
      description: "Portfolio holdings, distribution history, governance voting, and performance analytics.",
      path: "/investor",
      accent: "text-violet-300",
      ring: "ring-violet-800 hover:ring-violet-500",
      iconBg: "bg-violet-900/50 text-violet-400",
      icon: <ChartBarIcon />,
      available: isPlatformAdmin || isLenderAdmin,
    },
    {
      id: "borrower",
      label: "Borrower Portal",
      description: "Loan status, payment history, draw requests, document submissions, and servicer messages.",
      path: "/borrower",
      accent: "text-emerald-300",
      ring: "ring-emerald-800 hover:ring-emerald-500",
      iconBg: "bg-emerald-900/50 text-emerald-400",
      icon: <HomeModernIcon />,
      available: isPlatformAdmin || isLenderAdmin,
    },
  ];

  const available = portals.filter((p) => p.available);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-7 w-7 rounded-md bg-brand-600 ring-2 ring-brand-500/40" />
          <span className="text-2xl font-bold tracking-tight text-white">Kontra</span>
        </div>
        <p className="text-slate-400 text-sm">Real estate loan servicing infrastructure</p>
      </div>

      {/* Greeting */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-slate-400 text-base">
          {available.length === 1
            ? "Entering your workspace…"
            : "Select the workspace you want to enter."}
        </p>
      </div>

      {/* Portal cards */}
      <div className={`w-full max-w-4xl grid gap-4 ${available.length === 1 ? "max-w-sm" : available.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
        {available.map((portal) => (
          <button
            key={portal.id}
            onClick={() => navigate(portal.path, { replace: true })}
            className={`group relative flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left ring-1 transition-all duration-200 ${portal.ring} hover:bg-slate-800/80 focus:outline-none focus:ring-2`}
          >
            {/* Icon */}
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${portal.iconBg}`}>
              {portal.icon}
            </div>

            {/* Label + description */}
            <div className="flex-1">
              <p className={`text-base font-semibold mb-1 ${portal.accent}`}>{portal.label}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{portal.description}</p>
            </div>

            {/* Enter arrow */}
            <div className="flex items-center justify-end">
              <span className={`text-xs font-semibold tracking-wide uppercase ${portal.accent} group-hover:translate-x-0.5 transition-transform`}>
                Enter →
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 flex items-center gap-6 text-xs text-slate-600">
        <span>{userEmail}</span>
        <span>·</span>
        <button
          onClick={handleSignOut}
          className="hover:text-slate-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
