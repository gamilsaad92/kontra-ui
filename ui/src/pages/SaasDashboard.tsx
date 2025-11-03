import { FormEvent, useContext, useEffect, useMemo, useState, type ComponentType } from "react";
import { isFeatureEnabled } from "../lib/featureFlags";
import useFeatureUsage from "../lib/useFeatureUsage";
import { lenderNavRoutes } from "../routes";
import { AuthContext } from "../lib/authContext";
import {
  clearOtpState,
  isOtpVerified,
  loadOtpState,
  markOtpRequested,
  markOtpVerified,
  OTP_TTL_MS,
  requestOtp,
  verifyOtp,
  type OtpChannel,
  type OtpState,
} from "../services/auth";

const Placeholder = ({ title }: { title: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-slate-600">Placeholder. Connect this when ready.</p>
  </div>
);

type NavItem = (typeof lenderNavRoutes)[number];

export default function SaasDashboard() {
  const { session, supabase, isLoading } = useContext(AuthContext);
  const apiBase = (import.meta as any)?.env?.VITE_API_URL || "/api";
  const { usage, recordUsage } = useFeatureUsage();

  const navItems = useMemo(
    () => lenderNavRoutes.filter((item) => !item.flag || isFeatureEnabled(item.flag)),
    [isFeatureEnabled]
  );

  const [activeLabel, setActiveLabel] = useState<string>(() => navItems[0]?.label ?? "Dashboard");
      
  useEffect(() => {
    if (!navItems.some((item) => item.label === activeLabel)) {
      const fallback = navItems[0];
      if (fallback) {
        setActiveLabel(fallback.label);
      }
    }
  }, [activeLabel, navItems]);

  const activeItem = useMemo(() => {
    return navItems.find((item) => item.label === activeLabel);
  }, [navItems, activeLabel]);

  const frequentItems = useMemo(() => {
    return navItems
      .filter((item) => usage[item.label])
      .sort((a, b) => (usage[b.label] ?? 0) - (usage[a.label] ?? 0))
      .slice(0, 3);
  }, [navItems, usage]);

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon as ComponentType<{ className?: string }> | undefined;
    const active = item.label === activeLabel;
    const base = "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium";
    const state = active
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white active:bg-slate-900";
    
    return (
      <button
        key={item.label}
        type="button"
        className={`${base} ${state}`}
        title={item.label}
        onClick={() => {
          setActiveLabel(item.label);
          recordUsage(item.label);
        }}
      >
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  const renderContent = () => {
    if (activeItem?.component) {
      const Component = activeItem.component as ComponentType<any>;
      if (activeLabel === "Dashboard") {
        return <Component apiBase={apiBase} />;
      }
      return <Component />;
    }
    return <Placeholder title={activeLabel} />;
  };

  const isDashboard = activeLabel === "Dashboard";
  const content = renderContent();

    const [otpState, setOtpState] = useState<OtpState | null>(() => loadOtpState());
  const [otpDestination, setOtpDestination] = useState(otpState?.destination ?? "");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>(otpState?.channel ?? "email");
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  useEffect(() => {
    if (otpState) {
      setOtpDestination(otpState.destination);
      setOtpChannel(otpState.channel);
    }
  }, [otpState]);

   useEffect(() => {
    if (otpState || otpDestination) return;
    const user = session?.user;
    const candidate = (user?.email || user?.phone || user?.user_metadata?.email || user?.user_metadata?.phone || '').trim();
    if (candidate) {
      setOtpDestination(candidate);
    }
  }, [session, otpState, otpDestination]);

  useEffect(() => {
    if (!otpState?.verifiedAt) return;
    const remaining = OTP_TTL_MS - (Date.now() - otpState.verifiedAt);
    if (remaining <= 0) {
      setOtpState(loadOtpState());
      return;
    }
    const timer = window.setTimeout(() => {
      setOtpState(loadOtpState());
    }, remaining + 1000);
    return () => window.clearTimeout(timer);
  }, [otpState]);

  const otpVerified = isOtpVerified(otpState);
  const overlayVisible = !otpVerified;
  const hasRequestedOtp = Boolean(otpState);
  const otpWindowMinutes = Math.floor(OTP_TTL_MS / 60000);

    const handleSignOut = () => {
    if (!supabase) return;
    void supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading authentication…
      </div>
    );
  }

  const runRequestOtp = async () => {
    const destination = otpDestination.trim();
    if (!destination) {
      setOtpError("Enter a destination for the code.");
      return;
    }
    setOtpBusy(true);
    try {
      await requestOtp(otpChannel, destination);
      setOtpState(markOtpRequested(destination, otpChannel));
      setOtpMessage(`Verification code sent to ${destination}.`);
      setOtpCode("");
      setOtpError(null);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Failed to send code");
    } finally {
      setOtpBusy(false);
    }
  };

  const runVerifyOtp = async () => {
    if (!otpState) {
      setOtpError("Request a verification code first.");
      return;
    }
    const code = otpCode.trim();
    if (!code) {
      setOtpError("Enter the verification code.");
      return;
    }
    const destination = otpDestination.trim();
    if (destination !== otpState.destination) {
      setOtpError("Destination changed. Request a new code to continue.");
      return;
    }
    setOtpBusy(true);
    try {
      const result = await verifyOtp(otpState.destination, code);
      if (!result.verified) {
        setOtpError("Incorrect or expired code.");
        return;
      }
      setOtpState(markOtpVerified(otpState));
      setOtpMessage("Two-factor verification complete.");
      setOtpError(null);
      setOtpCode("");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOtpError(null);
    setOtpMessage(null);
    if (hasRequestedOtp) {
      await runVerifyOtp();
    } else {
      await runRequestOtp();
    }
  };

  const handleResend = async () => {
    if (otpBusy) return;
    setOtpError(null);
    setOtpMessage(null);
    await runRequestOtp();
  };

  const handleResetOtp = () => {
    if (otpBusy) return;
    clearOtpState();
    setOtpState(null);
    setOtpDestination("");
    setOtpCode("");
    setOtpMessage(null);
    setOtpError(null);
    setOtpChannel("email");
  };

  return (
    <>
      {overlayVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 px-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Verify your workspace access</h2>
            <p className="mt-1 text-sm text-slate-600">
              Secure sensitive SaaS controls with a one-time verification code.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleOtpSubmit}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Delivery method
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["email", "sms"] as OtpChannel[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setOtpChannel(option)}
                      className={`rounded-lg px-3 py-2 text-sm transition ${
                        otpChannel === option
                          ? "bg-slate-900 text-white shadow"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      disabled={otpBusy}
                    >
                      {option === "email" ? "Email" : "SMS"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Destination
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  value={otpDestination}
                  onChange={(event) => setOtpDestination(event.target.value)}
                  placeholder={otpChannel === "sms" ? "+1 555 555 1212" : "you@example.com"}
                  disabled={otpBusy && hasRequestedOtp}
                />
              </div>
              {hasRequestedOtp && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Verification code
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    disabled={otpBusy}
                  />
                </div>
              )}
              {otpError && <p className="text-sm text-rose-500">{otpError}</p>}
              {otpMessage && <p className="text-sm text-emerald-600">{otpMessage}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={otpBusy}
                >
                  {hasRequestedOtp ? (otpBusy ? "Verifying…" : "Verify code") : otpBusy ? "Sending…" : "Send code"}
                </button>
                {hasRequestedOtp && (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-sm text-slate-600 hover:text-slate-900 disabled:text-slate-400"
                    disabled={otpBusy}
                  >
                    Resend code
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetOtp}
                  className="ml-auto text-sm text-slate-500 hover:text-slate-900 disabled:text-slate-400"
                  disabled={otpBusy}
                >
                  Use different contact
                </button>
              </div>
              <p className="text-xs text-slate-500">Codes expire {otpWindowMinutes} minutes after delivery.</p>
            </form>
          </div>
        </div>
     )}

      <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <aside className="flex w-64 flex-col bg-slate-950 text-slate-100">
          <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold tracking-tight">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800">
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path className="fill-white/90" d="M12 2 3 7v10l9 5 9-5V7zM6 9l6 3 6-3" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="text-slate-100">SaaS</span> Control
            </span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {frequentItems.length > 0 && (
              <div className="mb-2 space-y-1">
                {frequentItems.map((item) => renderNavItem(item))}
                <hr className="border-slate-800" />
              </div>
            )}
            {navItems.map((item) => renderNavItem(item))}
                       <div className="pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={!supabase}
                className="w-full rounded-lg border border-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent"
              >
                Log Out
              </button>
              {!supabase && (
                <p className="mt-2 text-xs text-slate-500">
                  Connect Supabase to enable authentication actions.
                </p>
              )}
            </div>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          {!isDashboard && (
            <header className="mb-6 space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{activeLabel}</h1>
              <p className="text-sm text-slate-500">
                Connected lending, trading, and servicing workspaces for your active SaaS tenant.
              </p>
            </header>
          )}
           {isDashboard ? content : <div className="space-y-6">{content}</div>}
        </main>
      </div>
    </>
  );
}
