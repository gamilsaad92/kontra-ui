import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene4() {
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

  const kpis = [
    { label: "Draws Pending", value: "12", sub: "↑2 today" },
    { label: "Queue Value", value: "$4.1M", sub: "3 urgent" },
    { label: "Inspections Due", value: "4", sub: "2 overdue", alert: true },
    { label: "Escrow Balance", value: "$1.82M", sub: "All current" },
  ];

  const draws = [
    { id: "DR-442", loan: "LN-2847", property: "Meridian Apts", amount: "$450,000", status: "Action Req", statusColor: "amber" },
    { id: "DR-438", loan: "LN-3011", property: "Grand Ave Retail", amount: "$210,000", status: "In Review", statusColor: "blue" },
    { id: "DR-435", loan: "LN-2741", property: "Westside Ind.", amount: "$185,000", status: "Approved", statusColor: "green" },
    { id: "DR-431", loan: "LN-3204", property: "Harbor Office", amount: "$320,000", status: "Funded", statusColor: "green" },
    { id: "DR-429", loan: "LN-2910", property: "Elm Street MF", amount: "$95,000", status: "Funded", statusColor: "green" },
  ];

  const inspections = [
    { site: "Meridian Apts", date: "May 5", inspector: "R. Torres", status: "Overdue", alert: true },
    { site: "Grand Ave Retail", date: "May 8", inspector: "A. Chen", status: "Scheduled", alert: false },
    { site: "Westside Ind.", date: "May 12", inspector: "M. Davis", status: "Scheduled", alert: false },
  ];

  const statusColors: Record<string, string> = {
    amber: "bg-amber-500/20 text-amber-300",
    blue: "bg-blue-500/20 text-blue-300",
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
          background: "radial-gradient(ellipse at 70% 40%, rgba(146,64,14,0.12) 0%, transparent 65%)",
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
            <div className="px-3 py-1.5 rounded bg-[var(--servicer)] font-bold text-white text-xs tracking-widest shadow-[0_0_18px_rgba(146,64,14,0.5)] inline-block">
              SERVICER
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {["Operations", "Draw Queue", "Inspections", "Payments", "Escrow", "Reports"].map((item, i) => (
              <div key={item} className={`text-sm px-3 py-2 rounded-lg ${i <= 2 ? 'bg-white/8 text-white' : 'text-white/40'}`}
                style={{ background: i <= 2 ? 'rgba(255,255,255,0.07)' : undefined }}>
                {item}
                {i === 1 && <span className="ml-auto float-right bg-amber-500 text-black text-[10px] font-bold rounded-full px-1.5">12</span>}
                {i === 2 && <span className="ml-auto float-right bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5">4</span>}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-6 border-t border-white/10">
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Processing</div>
            <motion.div
              className="h-1.5 rounded-full bg-white/10 overflow-hidden"
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--servicer)" }}
                initial={{ width: "0%" }}
                animate={phase >= 3 ? { width: "68%" } : { width: "0%" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </motion.div>
            <div className="text-[10px] text-white/40 mt-1">8 of 12 processed</div>
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
              <h2 className="text-2xl font-bold text-white" style={{ letterSpacing: "-0.02em" }}>Servicing Operations Center</h2>
              <p className="text-white/40 text-sm mt-0.5">Real-time draw management · Inspections · Payments · Escrow</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-mono border border-amber-500/20">
                3 Actions Required
              </div>
            </div>
          </motion.div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 px-8 py-5">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                className="rounded-lg border border-white/8 p-4"
                style={{ background: "rgba(0,0,0,0.25)" }}
                initial={{ opacity: 0, y: 20, scale: 0.92 }}
                animate={phase >= 6 ? { opacity: 0, scale: 0.9 } : phase >= 3 ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: phase >= 6 ? 0 : i * 0.08, duration: 0.45, type: "spring", stiffness: 200 }}
              >
                <div className="text-white/40 text-[10px] font-mono uppercase tracking-wider mb-1.5">{kpi.label}</div>
                <div className={`text-3xl font-light mb-1 ${kpi.alert ? 'text-amber-400' : 'text-white'}`}>{kpi.value}</div>
                <div className={`text-[10px] font-mono ${kpi.alert ? 'text-amber-400/70' : 'text-white/30'}`}>{kpi.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Two-column: Draw Queue + Inspections */}
          <div className="flex gap-4 px-8 pb-6 flex-1 min-h-0">

            {/* Draw Queue */}
            <motion.div
              className="flex-[3] flex flex-col rounded-xl border border-white/8 overflow-hidden"
              style={{ background: "rgba(0,0,0,0.2)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={phase >= 6 ? { opacity: 0, y: 16 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <span className="text-white text-sm font-semibold">Draw Request Queue</span>
                <span className="text-white/40 text-xs font-mono">12 pending</span>
              </div>
              <div className="grid grid-cols-5 px-5 py-2.5 border-b border-white/5 text-[10px] font-mono text-white/30 uppercase">
                <div>Draw ID</div><div>Loan</div><div>Property</div><div>Amount</div><div>Status</div>
              </div>
              <div className="flex-1 overflow-hidden">
                {draws.map((d, i) => (
                  <motion.div
                    key={d.id}
                    className="grid grid-cols-5 px-5 py-3 border-b border-white/5 text-sm text-white/75"
                    style={{ background: i === 0 ? 'rgba(245,158,11,0.05)' : undefined }}
                    initial={{ opacity: 0, x: -16 }}
                    animate={phase >= 6 ? { opacity: 0 } : phase >= 4 ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: phase >= 6 ? 0 : 0.1 + i * 0.07, duration: 0.35 }}
                  >
                    <div className="font-mono text-white/90">{d.id}</div>
                    <div className="font-mono text-white/50">{d.loan}</div>
                    <div className="text-white/70 truncate">{d.property}</div>
                    <div className="font-mono text-white">{d.amount}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusColors[d.statusColor]}`}>
                        {d.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Approve button animation on row 0 */}
              <motion.div
                className="px-5 py-3 border-t border-white/8 flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={phase >= 6 ? { opacity: 0 } : phase >= 5 ? { opacity: 1 } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="flex-1 text-xs text-white/40 font-mono">DR-442 selected — $450,000 draw from LN-2847</div>
                <div className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-mono border border-red-500/20 cursor-pointer">Reject</div>
                <motion.div
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-mono border cursor-pointer"
                  style={{ background: "var(--servicer)", borderColor: "var(--servicer)" }}
                  animate={{ boxShadow: ["0 0 0px rgba(146,64,14,0)", "0 0 20px rgba(146,64,14,0.6)", "0 0 0px rgba(146,64,14,0)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Approve &amp; Fund
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Inspections panel */}
            <motion.div
              className="flex-[2] flex flex-col rounded-xl border border-white/8 overflow-hidden"
              style={{ background: "rgba(0,0,0,0.2)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={phase >= 6 ? { opacity: 0, y: 16 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <span className="text-white text-sm font-semibold">Inspections</span>
                <span className="text-red-400 text-xs font-mono">2 overdue</span>
              </div>
              <div className="flex-1 overflow-hidden">
                {inspections.map((insp, i) => (
                  <motion.div
                    key={insp.site}
                    className="px-5 py-4 border-b border-white/5 flex flex-col gap-1"
                    style={{ background: insp.alert ? 'rgba(239,68,68,0.04)' : undefined }}
                    initial={{ opacity: 0, x: 16 }}
                    animate={phase >= 6 ? { opacity: 0 } : phase >= 4 ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: phase >= 6 ? 0 : 0.2 + i * 0.1, duration: 0.35 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium truncate">{insp.site}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${insp.alert ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/15 text-blue-300'}`}>
                        {insp.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/40">{insp.date} · {insp.inspector}</div>
                  </motion.div>
                ))}
              </div>

              {/* Escrow mini panel */}
              <motion.div
                className="px-5 py-4 border-t border-white/8"
                initial={{ opacity: 0 }}
                animate={phase >= 6 ? { opacity: 0 } : phase >= 5 ? { opacity: 1 } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="text-[10px] text-white/40 uppercase tracking-widest mb-3 font-mono">Escrow Summary</div>
                {[
                  { label: "Tax Reserve", value: "$412k", pct: 82 },
                  { label: "Insurance", value: "$218k", pct: 54 },
                  { label: "Capex Reserve", value: "$1.19M", pct: 95 },
                ].map((e) => (
                  <div key={e.label} className="mb-2.5">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-white/50">{e.label}</span>
                      <span className="text-white/80 font-mono">{e.value}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "var(--servicer)" }}
                        initial={{ width: "0%" }}
                        animate={phase >= 5 ? { width: `${e.pct}%` } : { width: "0%" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
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
        DRAWS · INSPECTIONS · PAYMENTS · ESCROW · COMPLIANCE
      </motion.div>
    </motion.div>
  );
}
