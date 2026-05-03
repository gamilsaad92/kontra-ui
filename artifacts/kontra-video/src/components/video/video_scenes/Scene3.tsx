import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 7500), // Exiting
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const kpis = [
    { label: "AUM", value: "$623.5M" },
    { label: "Active Loans", value: "6" },
    { label: "Critical Alerts", value: "2", alert: true },
    { label: "Covenants at Risk", value: "3", alert: true },
  ];

  const loans = [
    { id: "LN-2847", property: "The Meridian", balance: "$45.2M", status: "Current" },
    { id: "LN-3011", property: "Grand Ave Retail", balance: "$18.5M", status: "Watchlist" },
    { id: "LN-2741", property: "Westside Ind", balance: "$32.8M", status: "Current" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="absolute -z-10 rounded-full"
        style={{
          width: "120vw",
          height: "120vh",
          background: "radial-gradient(circle at 20% 50%, rgba(124,29,53,0.08) 0%, transparent 60%)",
        }}
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.02, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-[85vw] h-[80vh] rounded-xl border border-white/10 bg-[#12151F]/90 backdrop-blur-xl shadow-2xl flex overflow-hidden">
        
        {/* Sidebar */}
        <motion.div 
          className="w-64 border-r border-white/10 bg-black/40 flex flex-col p-6 relative overflow-hidden"
          initial={{ x: -100, opacity: 0 }}
          animate={phase >= 5 ? { x: -50, opacity: 0 } : phase >= 1 ? { x: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-[var(--lender)] opacity-5 blur-xl" />
          <div className="flex items-center gap-3 mb-10 relative z-10">
            <div className="w-8 h-8 rounded bg-[var(--lender)] flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(124,29,53,0.6)]">
              K
            </div>
            <span className="font-semibold tracking-wider text-sm text-white">LENDER</span>
          </div>
          <div className="flex flex-col gap-4 relative z-10">
            {["Overview", "Portfolio", "Compliance", "Tokenization", "Reports"].map((item, i) => (
              <div key={item} className={`text-sm px-3 py-2 rounded ${i === 0 ? 'bg-white/10 text-white' : 'text-white/50'}`}>
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 p-10 flex flex-col relative z-10">
          <motion.h2 
            className="text-3xl font-bold text-white mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: -20 } : phase >= 2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            Portfolio Overview
          </motion.h2>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-6 mb-10">
            {kpis.map((kpi, i) => (
              <motion.div 
                key={kpi.label}
                className="bg-black/30 border border-white/5 rounded-lg p-5"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={phase >= 5 ? { opacity: 0, scale: 0.9 } : phase >= 3 ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: phase >= 5 ? 0 : i * 0.1, duration: 0.5, type: "spring" }}
              >
                <div className="text-white/50 text-xs font-mono mb-2 uppercase">{kpi.label}</div>
                <div className={`text-3xl font-light ${kpi.alert ? 'text-red-400' : 'text-white'}`}>
                  {kpi.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Table */}
          <motion.div 
            className="flex-1 bg-black/20 rounded-lg border border-white/5 p-1 overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-4 px-4 py-3 border-b border-white/5 text-xs font-mono text-white/40 uppercase">
              <div>Loan ID</div>
              <div>Property</div>
              <div>Balance</div>
              <div>Status</div>
            </div>
            {loans.map((loan, i) => (
              <motion.div 
                key={loan.id}
                className="grid grid-cols-4 px-4 py-4 border-b border-white/5 text-sm text-white/80 hover:bg-white/5"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= 5 ? { opacity: 0 } : phase >= 4 ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: phase >= 5 ? 0 : 0.2 + i * 0.1, duration: 0.4 }}
              >
                <div className="font-mono text-white">{loan.id}</div>
                <div>{loan.property}</div>
                <div className="font-mono">{loan.balance}</div>
                <div>
                  <span className={`px-2 py-1 rounded text-xs ${loan.status === 'Current' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {loan.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div 
        className="absolute bottom-12 px-8 py-3 bg-[var(--gold)]/10 backdrop-blur border border-[var(--gold)]/30 rounded-full text-[var(--gold)] tracking-widest font-mono text-sm shadow-[0_0_30px_rgba(201,168,76,0.15)]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: phase >= 5 ? 0 : 0.6, duration: 0.6 }}
      >
        PORTFOLIO MANAGEMENT · COMPLIANCE · TOKENIZATION
      </motion.div>

    </motion.div>
  );
}
