import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2400),
      setTimeout(() => setPhase(5), 3200),
      setTimeout(() => setPhase(6), 8400),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const covenants = [
    { label: "DSCR", value: "1.42×", pct: 75, ok: true },
    { label: "LTV", value: "68.2%", pct: 68, ok: true },
    { label: "Occupancy", value: "91.7%", pct: 92, ok: true },
    { label: "Debt Yield", value: "9.3%", pct: 80, ok: true },
  ];

  const draws = [
    { id: "DR-442", date: "May 2", amount: "$450,000", category: "Construction", status: "Under Review", color: "amber" },
    { id: "DR-428", date: "Apr 18", amount: "$310,000", category: "Renovation", status: "Approved", color: "green" },
    { id: "DR-415", date: "Apr 1", amount: "$175,000", category: "FF&E", status: "Funded", color: "green" },
    { id: "DR-401", date: "Mar 15", amount: "$225,000", category: "Construction", status: "Funded", color: "green" },
  ];

  const docs = [
    { name: "Rent Roll — Apr 2026", type: "XLSX", status: "Uploaded", ok: true },
    { name: "Inspection Report Q1", type: "PDF", status: "Uploaded", ok: true },
    { name: "Insurance Certificate", type: "PDF", status: "Expiring Soon", ok: false },
    { name: "Operating Statement", type: "PDF", status: "Due May 15", ok: false },
  ];

  const statusColors: Record<string, string> = {
    amber: "bg-amber-500/20 text-amber-300",
    green: "bg-green-500/20 text-green-300",
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="absolute -z-10"
        style={{
          inset: 0,
          background: "radial-gradient(ellipse at 30% 60%, rgba(6,78,59,0.12) 0%, transparent 65%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-[90vw] h-[84vh] rounded-xl border border-white/10 bg-[#12151F]/92 backdrop-blur-xl shadow-2xl flex overflow-hidden">

        {/* Sidebar */}
        <motion.div
          className="w-56 border-r border-white/10 bg-black/30 flex flex-col p-5 shrink-0"
          initial={{ x: -80, opacity: 0 }}
          animate={phase >= 6 ? { x: -50, opacity: 0 } : phase >= 1 ? { x: 0, opacity: 1 } : {}}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-8">
            <div className="px-3 py-1.5 rounded bg-[var(--borrower)] font-bold text-white text-xs tracking-widest shadow-[0_0_18px_rgba(6,78,59,0.5)] inline-block">
              BORROWER
            </div>
          </div>

          <div className="mb-6 p-3 rounded-lg border border-white/8" style={{ background: "rgba(6,78,59,0.08)" }}>
            <div className="text-[10px] text-white/40 font-mono uppercase mb-1">LN-2847</div>
            <div className="text-white text-sm font-semibold">Meridian Apartments</div>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span className="text-green-400 text-[11px] font-mono">Current</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {["Dashboard", "Loan Status", "Draw Requests", "Documents", "Payments", "Messages"].map((item, i) => (
              <div key={item} className="text-sm px-3 py-2 rounded-lg"
                style={{ color: i <= 3 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)', background: i <= 1 ? 'rgba(255,255,255,0.07)' : undefined }}>
                {item}
                {i === 2 && <span className="ml-auto float-right bg-amber-500 text-black text-[10px] font-bold rounded-full px-1.5">1</span>}
                {i === 3 && <span className="ml-auto float-right bg-red-500/80 text-white text-[10px] font-bold rounded-full px-1.5">!</span>}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <motion.div
            className="px-8 py-5 border-b border-white/8 flex items-center justify-between"
            initial={{ opacity: 0, y: -10 }}
            animate={phase >= 6 ? { opacity: 0 } : phase >= 2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            <div>
              <h2 className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>LN-2847 · The Meridian Apartments</h2>
              <p className="text-white/40 text-sm mt-0.5">$45.2M balance · Floating Rate · Matures Dec 2027</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-green-500/15 text-green-300 text-xs font-mono border border-green-500/20">
                Loan Current
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-mono border border-amber-500/20">
                Draw Under Review
              </div>
            </div>
          </motion.div>

          {/* Covenant row */}
          <div className="grid grid-cols-4 gap-4 px-8 py-4 border-b border-white/5">
            {covenants.map((c, i) => (
              <motion.div
                key={c.label}
                className="rounded-lg border border-white/8 p-3 flex flex-col items-center"
                style={{ background: "rgba(0,0,0,0.2)" }}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={phase >= 6 ? { opacity: 0, scale: 0.88 } : phase >= 3 ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: phase >= 6 ? 0 : i * 0.08, duration: 0.4, type: "spring" }}
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2 relative">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <motion.circle
                      cx="32" cy="32" r="28"
                      fill="none"
                      stroke="var(--borrower)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="175.9"
                      initial={{ strokeDashoffset: 175.9 }}
                      animate={phase >= 3 ? { strokeDashoffset: 175.9 - (175.9 * c.pct / 100) } : { strokeDashoffset: 175.9 }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 1.2, ease: "easeOut" }}
                    />
                  </svg>
                  <span className="text-sm font-bold text-white relative z-10">{c.value}</span>
                </div>
                <div className="text-[10px] text-white/45 font-mono uppercase tracking-widest">{c.label}</div>
                <div className="text-[10px] text-green-400 font-mono mt-0.5">✓ Compliant</div>
              </motion.div>
            ))}
          </div>

          {/* Two-col: draws + docs */}
          <div className="flex gap-4 px-8 py-4 flex-1 min-h-0">

            {/* Draw requests */}
            <motion.div
              className="flex-[3] flex flex-col rounded-xl border border-white/8 overflow-hidden"
              style={{ background: "rgba(0,0,0,0.18)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={phase >= 6 ? { opacity: 0, y: 16 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <span className="text-white text-sm font-semibold">Draw Request History</span>
                <motion.div
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-mono cursor-pointer"
                  style={{ background: "var(--borrower)" }}
                  animate={{ boxShadow: ["0 0 0px rgba(6,78,59,0)", "0 0 16px rgba(6,78,59,0.6)", "0 0 0px rgba(6,78,59,0)"] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  + New Draw Request
                </motion.div>
              </div>
              <div className="grid grid-cols-5 px-5 py-2.5 border-b border-white/5 text-[10px] font-mono text-white/30 uppercase">
                <div>Draw ID</div><div>Date</div><div>Amount</div><div>Category</div><div>Status</div>
              </div>
              <div className="flex-1 overflow-hidden">
                {draws.map((d, i) => (
                  <motion.div
                    key={d.id}
                    className="grid grid-cols-5 px-5 py-3.5 border-b border-white/5 text-sm text-white/75"
                    style={{ background: i === 0 ? 'rgba(245,158,11,0.04)' : undefined }}
                    initial={{ opacity: 0, x: -12 }}
                    animate={phase >= 6 ? { opacity: 0 } : phase >= 4 ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: phase >= 6 ? 0 : 0.1 + i * 0.07, duration: 0.35 }}
                  >
                    <div className="font-mono text-white/90">{d.id}</div>
                    <div className="text-white/40 font-mono text-xs">{d.date}</div>
                    <div className="font-mono text-white">{d.amount}</div>
                    <div className="text-white/60">{d.category}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusColors[d.color]}`}>
                        {d.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Progress bar for DR-442 */}
              <motion.div
                className="px-5 py-4 border-t border-white/8"
                initial={{ opacity: 0 }}
                animate={phase >= 6 ? { opacity: 0 } : phase >= 5 ? { opacity: 1 } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="text-[11px] text-white/40 font-mono mb-2 uppercase tracking-widest">DR-442 Approval Progress</div>
                <div className="flex items-center gap-3">
                  {["Submitted", "Servicer Review", "Lender Approval", "Funded"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2 flex-1">
                      <div className={`h-2 rounded-full flex-1 ${i <= 1 ? 'bg-amber-500' : 'bg-white/10'}`}
                        style={{ background: i <= 1 ? 'var(--borrower)' : undefined }} />
                      {i < 3 && <div className="w-1 h-1 rounded-full bg-white/20" />}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-white/30 mt-1.5 font-mono">
                  <span>Submitted</span><span>In Review</span><span>Pending</span><span>Funded</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Documents */}
            <motion.div
              className="flex-[2] flex flex-col rounded-xl border border-white/8 overflow-hidden"
              style={{ background: "rgba(0,0,0,0.18)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={phase >= 6 ? { opacity: 0, y: 16 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <span className="text-white text-sm font-semibold">Required Documents</span>
                <span className="text-white/40 text-xs font-mono">2 actions needed</span>
              </div>
              <div className="flex-1 overflow-hidden">
                {docs.map((doc, i) => (
                  <motion.div
                    key={doc.name}
                    className="px-5 py-4 border-b border-white/5 flex items-start gap-3"
                    style={{ background: !doc.ok ? 'rgba(239,68,68,0.03)' : undefined }}
                    initial={{ opacity: 0, x: 12 }}
                    animate={phase >= 6 ? { opacity: 0 } : phase >= 4 ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: phase >= 6 ? 0 : 0.15 + i * 0.08, duration: 0.35 }}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${doc.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {doc.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/85 truncate">{doc.name}</div>
                      <div className={`text-[11px] mt-0.5 font-mono ${doc.ok ? 'text-green-400/70' : 'text-red-400/80'}`}>
                        {doc.status}
                      </div>
                    </div>
                    {!doc.ok && (
                      <div className="px-2 py-1 rounded text-[10px] font-mono bg-[var(--borrower)]/20 text-green-300 shrink-0">
                        Upload
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Payment next due */}
              <motion.div
                className="px-5 py-4 border-t border-white/8"
                initial={{ opacity: 0 }}
                animate={phase >= 6 ? { opacity: 0 } : phase >= 5 ? { opacity: 1 } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2.5 font-mono">Next Payment</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold text-base">$187,500</div>
                    <div className="text-white/40 text-[11px] font-mono">Due Jun 1, 2026</div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/70 border border-white/15">
                    Auto-Pay On
                  </div>
                </div>
                <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-green-500"
                    initial={{ width: "0%" }}
                    animate={phase >= 5 ? { width: "72%" } : { width: "0%" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <div className="text-[10px] text-white/30 mt-1 font-mono">29 days until due</div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-10 px-8 py-3 bg-[var(--gold)]/10 backdrop-blur border border-[var(--gold)]/30 rounded-full text-[var(--gold)] tracking-widest font-mono text-sm shadow-[0_0_30px_rgba(201,168,76,0.15)]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 6 ? { opacity: 0, y: 20 } : phase >= 5 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
      >
        LOAN STATUS · DRAWS · DOCUMENTS · COVENANTS · PAYMENTS
      </motion.div>
    </motion.div>
  );
}
