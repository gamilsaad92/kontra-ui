export function Executive() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#0f0f0f" }}
    >
      {/* Subtle noise grain */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.6)]" style={{ background: "#fff" }}>
        {/* Top red bar */}
        <div className="relative px-10 py-9" style={{ background: "#8b1a1a" }}>
          {/* Logo row */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }}>
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M4 20 L12 4 L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 14 L16 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white" style={{ letterSpacing: "-0.01em" }}>Kontra</span>
          </div>

          <div className="mt-6">
            <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Welcome back</h1>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>Sign in to your workspace</p>
          </div>

          {/* Decorative arc */}
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>

        {/* White form body */}
        <div className="px-10 py-8">
          {/* Tabs */}
          <div className="mb-8 flex border-b" style={{ borderColor: "#e5e7eb" }}>
            <button className="mr-6 pb-3 text-sm font-semibold border-b-2" style={{ borderColor: "#8b1a1a", color: "#8b1a1a" }}>
              Sign in
            </button>
            <button className="pb-3 text-sm font-medium" style={{ color: "#9ca3af" }}>
              Create account
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>Email</label>
              <input
                type="email"
                placeholder="you@yourfirm.com"
                readOnly
                className="mt-2 w-full rounded-lg border px-4 py-3 text-sm outline-none"
                style={{ borderColor: "#e5e7eb", background: "#fafafa", color: "#111" }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>Password</label>
                <span className="text-xs font-medium" style={{ color: "#8b1a1a" }}>Forgot?</span>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                readOnly
                className="mt-2 w-full rounded-lg border px-4 py-3 text-sm outline-none"
                style={{ borderColor: "#e5e7eb", background: "#fafafa" }}
              />
            </div>

            <button
              className="w-full rounded-lg py-3 text-sm font-bold text-white shadow-md"
              style={{ background: "#8b1a1a", letterSpacing: "0.02em", boxShadow: "0 4px 20px rgba(139,26,26,0.35)" }}
            >
              Sign in
            </button>
          </div>

          <p className="mt-6 text-center text-xs" style={{ color: "#9ca3af" }}>
            Don't have an account? <span className="font-semibold" style={{ color: "#8b1a1a" }}>Create one</span>
          </p>

          <div className="mt-8 pt-6 text-center border-t" style={{ borderColor: "#f3f4f6" }}>
            <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#d1d5db" }}>Institutional Loan Servicing</p>
          </div>
        </div>
      </div>
    </div>
  );
}
