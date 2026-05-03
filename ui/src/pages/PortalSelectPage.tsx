/**
 * PortalSelectPage — enterprise post-login portal selection screen.
 * Clean light theme: white surface, subtle borders, role color only for accent.
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
  accentBg: string;
  accentBorder: string;
  icon: React.ReactNode;
};

const MULTI_PORTAL_ROLES: AppRole[] = ["platform_admin", "lender_admin"];

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15l.75 18H3.75L4.5 3zM8.25 21V10.5M12 21V10.5M15.75 21V10.5M8.25 7.5h.008v.008H8.25V7.5zm3.75 0h.008v.008H12V7.5zm3.75 0h.008v.008h-.008V7.5z" />
    </svg>
  );
}
function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function HomeModernIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  );
}

const ALL_PORTALS: PortalCard[] = [
  {
    id: "lender",
    label: "Lender Portal",
    description: "Loan origination, portfolio management, capital markets, tokenization, compliance, and risk intelligence.",
    path: "/dashboard",
    accent: "#E5484D",
    accentBg: "#FDECEC",
    accentBorder: "#FECACA",
    icon: <BuildingIcon />,
  },
  {
    id: "servicer",
    label: "Servicer Portal",
    description: "Payment processing, inspections, draws, escrow management, borrower financials, and AI operations.",
    path: "/servicer/overview",
    accent: "#B45309",
    accentBg: "#FEF3C7",
    accentBorder: "#FDE68A",
    icon: <WrenchIcon />,
  },
  {
    id: "investor",
    label: "Investor Portal",
    description: "Portfolio holdings, distribution history, governance voting, debt exchange, and token NAV pricing.",
    path: "/investor",
    accent: "#7C3AED",
    accentBg: "#F5F3FF",
    accentBorder: "#DDD6FE",
    icon: <ChartBarIcon />,
  },
  {
    id: "borrower",
    label: "Borrower Portal",
    description: "Loan status, payment history, draw requests, document submissions, and servicer messages.",
    path: "/borrower",
    accent: "#065F46",
    accentBg: "#ECFDF5",
    accentBorder: "#A7F3D0",
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

  useEffect(() => {
    const token = session?.access_token;
    if (!token) { setLoading(false); return; }

    fetch("/api/onboarding/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const fetchedRole = (data?.app_role ?? "member") as AppRole;
        try { localStorage.setItem("kontra_resolved_role", fetchedRole); } catch (_) {}
        if (!MULTI_PORTAL_ROLES.includes(fetchedRole) && fetchedRole !== "member") {
          navigate(getPortalPath(fetchedRole), { replace: true });
          return;
        }
        setRole(fetchedRole);
        setLoading(false);
      })
      .catch(() => { setRole("member"); setLoading(false); });
  }, [session?.access_token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  const portalsToShow =
    role === "platform_admin" || role === "lender_admin" || role === "member"
      ? ALL_PORTALS
      : ALL_PORTALS.filter((p) => p.path === getPortalPath(role as AppRole));

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: "#F8FAFC" }}>

      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#E5484D" }}>
            <span className="text-sm font-black text-white" style={{ letterSpacing: "-0.05em" }}>K</span>
          </div>
          <span className="text-xl font-bold text-gray-900" style={{ letterSpacing: "-0.02em" }}>Kontra</span>
        </div>
        <p className="text-sm text-gray-400">Real estate loan servicing infrastructure</p>
      </div>

      {/* Greeting */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ letterSpacing: "-0.02em" }}>
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-sm text-gray-500">
          {portalsToShow.length === 1 ? "Entering your workspace…" : "Select the workspace you want to enter."}
        </p>
      </div>

      {/* Portal cards */}
      <div
        className={`w-full grid gap-3 ${
          portalsToShow.length === 1 ? "max-w-sm" :
          portalsToShow.length === 2 ? "max-w-2xl grid-cols-1 sm:grid-cols-2" :
          portalsToShow.length === 4 ? "max-w-4xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" :
          "max-w-3xl grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {portalsToShow.map((portal) => (
          <button
            key={portal.id}
            onClick={() => navigate(portal.path, { replace: true })}
            className="group flex flex-col gap-3 rounded-xl bg-white border border-gray-200 p-5 text-left transition-all hover:border-gray-300 hover:shadow-sm focus:outline-none"
          >
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: portal.accentBg, color: portal.accent, border: `1px solid ${portal.accentBorder}` }}
            >
              {portal.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-1">{portal.label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{portal.description}</p>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: portal.accentBg, color: portal.accent, border: `1px solid ${portal.accentBorder}` }}
              >
                {portal.id}
              </span>
              <span className="text-xs text-gray-400 group-hover:text-gray-700 transition-colors">Enter →</span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-center gap-4 text-xs text-gray-400">
        <span>{userEmail}</span>
        <span>·</span>
        <button onClick={handleSignOut} className="hover:text-gray-600 transition-colors">Sign out</button>
      </div>
    </div>
  );
}
