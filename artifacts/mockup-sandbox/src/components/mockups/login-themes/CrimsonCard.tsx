export function CrimsonCard() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1a0505 0%, #0f0f0f 60%, #0a0a0a 100%)" }}
    >
      {/* Large glow behind card */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(139,26,26,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Wordmark */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "#8b1a1a", boxShadow: "0 0 24px rgba(139,26,26,0.5)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M4 20 L12 4 L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14 L16 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white" style={{ letterSpacing: "-0.03em" }}>Kontra</span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "rgba(18,18,18,0.9)",
            borderColor: "rgba(139,26,26,0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 0 1px rgba(139,26,26,0.1), 0 40px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* Heading */}
          <h1 className="text-xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
            Sign in
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#6b7280" }}>Access your Kontra workspace</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="block text-xs font-medium" style={{ color: "#9ca3af" }}>Email address</label>
              <div
                className="mt-1.5 flex items-center rounded-lg border px-4 py-3 gap-2.5"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
              >
                <svg className="h-4 w-4 shrink-0" style={{ color: "#4b5563" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m2 7 10 7 10-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm" style={{ color: "#4b5563" }}>you@yourfirm.com</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium" style={{ color: "#9ca3af" }}>Password</label>
              <div
                className="mt-1.5 flex items-center rounded-lg border px-4 py-3 gap-2.5"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
              >
                <svg className="h-4 w-4 shrink-0" style={{ color: "#4b5563" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm tracking-widest" style={{ color: "#4b5563" }}>••••••••</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="h-4 w-4 rounded border" style={{ borderColor: "rgba(255,255,255,0.15)" }} />
                <span className="text-xs" style={{ color: "#6b7280" }}>Remember me</span>
              </label>
              <span className="text-xs font-medium" style={{ color: "#b91c1c" }}>Forgot password?</span>
            </div>

            <button
              className="w-full rounded-lg py-3.5 text-sm font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)",
                boxShadow: "0 4px 24px rgba(153,27,27,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
                letterSpacing: "0.02em",
              }}
            >
              Sign in to Kontra
            </button>
          </div>

          <div className="mt-6 border-t pt-6 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-sm" style={{ color: "#4b5563" }}>
              New to Kontra?{" "}
              <span className="font-semibold" style={{ color: "#b91c1c" }}>Create an account</span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "#374151" }}>
          © 2026 Kontra — Institutional Loan Servicing
        </p>
      </div>
    </div>
  );
}
