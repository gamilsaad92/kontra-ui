import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene5() {
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

  const holdings = [
    { id: "LN-2847", amount: "145,000", value: "$145.0k", yield: "7.2%" },
    { id: "LN-3011", amount: "50,000", value: "$50.0k", yield: "6.8%" },
    { id: "LN-2741", amount: "210,000", value: "$210.0k", yield: "8.1%" },
    { id: "LN-3204", amount: "75,000", value: "$75.0k", yield: "7.5%" },
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
          background: "radial-gradient(circle at 20% 80%, rgba(76,29,149,0.1) 0%, transparent 60%)",
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
          <div className="absolute inset-0 bg-[var(--investor)] opacity-5 blur-xl" />
          <div className="flex items-center gap-3 mb-10 relative z-10">
            <div className="px-3 py-1 rounded bg-[var(--investor)] font-bold text-white text-xs tracking-widest shadow-[0_0_15px_rgba(76,29,149,0.6)]">
              INVESTOR
            </div>
          </div>
          <div className="flex flex-col gap-4 relative z-10">
            <div className="mb-6">
              <div className="text-white/50 text-xs mb-1">Total Balance</div>
              <div className="text-2xl text-white font-light">$480,000.00</div>
            </div>
            {["Holdings", "Distributions", "Governance", "Secondary"].map((item, i) => (
              <div key={item} className={`text-sm px-3 py-2 rounded ${i === 0 ? 'bg-white/10 text-white' : 'text-white/50'}`}>
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 p-10 flex flex-col">
          <motion.h2 
            className="text-3xl font-bold text-white mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: -20 } : phase >= 2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            Portfolio Holdings
          </motion.h2>

          {/* Table */}
          <motion.div 
            className="bg-black/20 rounded-lg border border-white/5 p-1 overflow-hidden mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 3 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="grid grid-cols-4 px-4 py-3 border-b border-white/5 text-xs font-mono text-white/40 uppercase">
              <div>Asset</div>
              <div>Tokens</div>
              <div>Est Value</div>
              <div>Yield (Target)</div>
            </div>
            {holdings.map((h, i) => (
              <motion.div 
                key={h.id}
                className="grid grid-cols-4 px-4 py-4 border-b border-white/5 text-sm text-white/80 hover:bg-white/5"
                initial={{ opacity: 0, x: -20 }}
                animate={phase >= 5 ? { opacity: 0 } : phase >= 3 ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: phase >= 5 ? 0 : 0.1 + i * 0.1, duration: 0.4 }}
              >
                <div className="font-mono text-violet-300">{h.id}</div>
                <div className="font-mono">{h.amount}</div>
                <div className="font-mono text-white">{h.value}</div>
                <div className="text-green-400">{h.yield}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Governance Vote */}
          <motion.div 
            className="bg-black/30 rounded-lg border border-white/5 p-6 mt-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="text-white text-sm font-medium">Active Vote: GV-051 Loan Modification</div>
              <div className="text-violet-400 text-xs font-mono">78.3% FOR</div>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-[var(--investor)] rounded-full"
                initial={{ width: "0%" }}
                animate={phase >= 4 ? { width: "78.3%" } : { width: "0%" }}
                transition={{ delay: 0.3, duration: 1.5, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
        className="absolute bottom-12 px-8 py-3 bg-[var(--gold)]/10 backdrop-blur border border-[var(--gold)]/30 rounded-full text-[var(--gold)] tracking-widest font-mono text-sm shadow-[0_0_30px_rgba(201,168,76,0.15)]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: phase >= 5 ? 0 : 0.6, duration: 0.6 }}
      >
        HOLDINGS · DISTRIBUTIONS · GOVERNANCE · SECONDARY MARKET
      </motion.div>

    </motion.div>
  );
}
