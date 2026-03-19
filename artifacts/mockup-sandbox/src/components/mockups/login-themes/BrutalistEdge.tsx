export function BrutalistEdge() {
  return (
    <div
      className="relative flex min-h-screen overflow-hidden"
      style={{ background: "#ffffff" }}
    >
      {/* Left red stripe */}
      <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: "#8b1a1a" }} />

      {/* Full-page form centered */}
      <div className="flex flex-1 flex-col items-center justify-center px-10">
        {/* Logo — stacked */}
        <div className="mb-10 w-full max-w-xs">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded"
              style={{ background: "#8b1a1a" }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M4 20 L12 4 L20 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 14 L16 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-black tracking-tight text-black" style={{ letterSpacing: "-0.04em" }}>KONTRA</span>
          </div>
          <div className="mt-1 h-[3px] w-12" style={{ background: "#8b1a1a" }} />
        </div>

        <div className="w-full max-w-xs">
          {/* Big heading */}
          <h1 className="text-4xl font-black leading-none text-black" style={{ letterSpacing: "-0.04em" }}>
            Sign<br />
            <span style={{ color: "#8b1a1a" }}>in.</span>
          </h1>
          <p className="mt-3 text-sm" style={{ color: "#6b7280" }}>
            Institutional loan servicing platform
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-black">
                Email
              </label>
              <input
                type="email"
                placeholder="you@yourfirm.com"
                readOnly
                className="mt-2 w-full border-b-2 px-0 py-2.5 text-sm outline-none"
                style={{ borderColor: "#111111", background: "transparent", color: "#111" }}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-black">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                readOnly
                className="mt-2 w-full border-b-2 px-0 py-2.5 text-sm outline-none"
                style={{ borderColor: "#111111", background: "transparent" }}
              />
            </div>

            <div className="pt-2">
              <button
                className="w-full rounded-none py-4 text-sm font-black uppercase tracking-widest text-white"
                style={{
                  background: "#8b1a1a",
                  letterSpacing: "0.12em",
                }}
              >
                Sign in
              </button>
            </div>

            <p className="text-xs" style={{ color: "#9ca3af" }}>
              No account?{" "}
              <span className="font-bold underline" style={{ color: "#8b1a1a", textDecorationColor: "#8b1a1a" }}>
                Request access
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom footer */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-10 py-5 border-t"
        style={{ borderColor: "#f3f4f6" }}
      >
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#d1d5db" }}>
          Kontra © 2026
        </span>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: "#d1d5db" }}>
          Institutional
        </span>
      </div>
    </div>
  );
}
