/**
 * PortalSelectPage — neutral post-login portal selection screen.
 *
 * Fetches the user's real role from the API (reads org_memberships +
 * organization_members in priority order) so it works even before the
 * Supabase custom_access_token_hook is registered.
 *
 * Single-role users (investor, borrower, servicer, asset_manager) are
 * automatically redirected to their portal. Admins choose from the card grid.
 */

import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext";
import { getPortalPath } from "../lib/usePortalRouter";

type AppRole =
  | "platform_admin" | "lender_admin" | "servicer" | "asset_manager"
  | "investor" | "borrower" | "member";

type PortalCard = {
  id: string;
  label: string;
  description: string;
  path: string;
  accent: string;
  ring: string;
  iconBg: string;
  icon: React.ReactNode;
};

// Roles that see a selection screen (multi-portal access)
const MULTI_PORTAL_ROLES: AppRole[] = ["platform_admin", "lender_admin"];

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

const ALL_PORTALS: PortalCard[] = [
  {
    id: "lender",
    label: "Lender / Servicer Workspace",
    description: "Loan origination, asset management, servicing, capital markets, and full platform control.",
    path: "/dashboard",
    accent: "text-brand-300",
    ring: "ring-brand-700 hover:ring-brand-500",
    iconBg: "bg-brand-900/50 text-brand-400",
    icon: <BuildingIcon />,
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
  },
];

export default function PortalSelectPage() {
  const { session, signOut } = useContext(AuthContext) as {
    session: { access_token?: string; user?: { email?: string; user_metadata?: Record<string, string> } } | null;
    signOut: () => Promise<void>;
  };
  const navigate = useNavigate();

  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const userEmail = session?.user?.email ?? "";
  const userName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.name ??
    userEmail.split("@")[0] ??
    "there";

  // Fetch real role from API (checks org_memberships + organization_members)
  useEffect(() => {
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }

    fetch("/api/onboarding/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const fetchedRole = (data?.app_role ?? "member") as AppRole;

        // Single-role users shouldn't be on this page — redirect them directly
        if (!MULTI_PORTAL_ROLES.includes(fetchedRole) && fetchedRole !== "member") {
          navigate(getPortalPath(fetchedRole), { replace: true });
          return;
        }

        setRole(fetchedRole);
        setLoading(false);
      })
      .catch(() => {
        setRole("member");
        setLoading(false);
      });
  }, [session?.access_token, navigate]);

  // While fetching role
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
          <span className="text-xs font-medium tracking-widest uppercase text-slate-500">
            Loading your workspace…
          </span>
        </div>
      </div>
    );
  }

  // Which portals to show:
  // - platform_admin / member → all three
  // - lender_admin → all three (they may need to check investor/borrower experience)
  const portalsToShow =
    role === "platform_admin" || role === "lender_admin" || role === "member"
      ? ALL_PORTALS
      : ALL_PORTALS.filter((p) => p.path === getPortalPath(role as AppRole));

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
          {portalsToShow.length === 1
            ? "Entering your workspace…"
            : "Select the workspace you want to enter."}
        </p>
      </div>

      {/* Portal cards */}
      <div
        className={`w-full grid gap-4 ${
          portalsToShow.length === 1
            ? "max-w-sm"
            : portalsToShow.length === 2
            ? "max-w-2xl grid-cols-1 sm:grid-cols-2"
            : "max-w-4xl grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {portalsToShow.map((portal) => (
          <button
            key={portal.id}
            onClick={() => navigate(portal.path, { replace: true })}
            className={`group relative flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left ring-1 transition-all duration-200 ${portal.ring} hover:bg-slate-800/80 focus:outline-none focus:ring-2`}
          >
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${portal.iconBg}`}>
              {portal.icon}
            </div>
            <div className="flex-1">
              <p className={`text-base font-semibold mb-1 ${portal.accent}`}>{portal.label}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{portal.description}</p>
            </div>
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
        <button onClick={handleSignOut} className="hover:text-slate-400 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}
