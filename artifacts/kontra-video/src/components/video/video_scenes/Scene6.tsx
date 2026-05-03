import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene6() {
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

  const gauges = [
    { label: "DSCR", value: "1.42×", pct: "75%", ok: true },
    { label: "LTV", value: "68.2%", pct: "68%", ok: true },
    { label: "Occupancy", value: "91.7%", pct: "91%", ok: true },
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
          background: "radial-gradient(circle at 80% 80%, rgba(6,78,59,0.08) 0%, transparent 60%)",
        }}
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.02, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-[85vw] h-[80vh] rounded-xl border border-white/10 bg-[#12151F]/90 backdrop-blur-xl shadow-2xl flex overflow-hidden">
        
        {/* Sidebar */}
        <motion.div 
          className="w-64 border-r border-white/10 bg-white/5 flex flex-col p-6 relative overflow-hidden"
          initial={{ x: -100, opacity: 0 }}
          animate={phase >= 5 ? { x: -50, opacity: 0 } : phase >= 1 ? { x: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-white/5 blur-xl" />
          <div className="flex items-center gap-3 mb-10 relative z-10">
            <div className="px-3 py-1 rounded bg-[var(--borrower)] font-bold text-white text-xs tracking-widest shadow-[0_0_15px_rgba(6,78,59,0.6)]">
              BORROWER
            </div>
          </div>
          <div className="flex flex-col gap-4 relative z-10">
            {["Dashboard", "Loan Status", "Documents", "Draw Requests", "Settings"].map((item, i) => (
              <div key={item} className={`text-sm px-3 py-2 rounded ${i === 1 ? 'bg-white/10 text-white' : 'text-white/50'}`}>
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 p-10 flex flex-col">
          <motion.h2 
            className="text-3xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: -20 } : phase >= 2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            LN-2847 • The Meridian Apartments
          </motion.h2>
          
          <motion.div
             className="px-3 py-1 bg-green-500/20 text-green-300 text-xs font-mono uppercase tracking-widest rounded self-start mb-8"
             initial={{ opacity: 0 }}
             animate={phase >= 5 ? { opacity: 0 } : phase >= 2 ? { opacity: 1 } : {}}
             transition={{ delay: 0.2 }}
          >
            Status: Current
          </motion.div>

          {/* Gauges */}
          <div className="grid grid-cols-3 gap-6 mb-10">
            {gauges.map((g, i) => (
              <motion.div 
                key={g.label}
                className="bg-black/30 border border-white/5 rounded-lg p-5 flex flex-col items-center justify-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={phase >= 5 ? { opacity: 0, scale: 0.9 } : phase >= 3 ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: phase >= 5 ? 0 : i * 0.1, duration: 0.5 }}
              >
                <div className="w-24 h-24 rounded-full border-4 border-white/10 flex items-center justify-center mb-4 relative">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <motion.circle
                      cx="48" cy="48" r="46"
                      fill="none"
                      stroke="var(--borrower)"
                      strokeWidth="4"
                      strokeDasharray="289"
                      initial={{ strokeDashoffset: 289 }}
                      animate={phase >= 3 ? { strokeDashoffset: 289 - (289 * parseInt(g.pct) / 100) } : { strokeDashoffset: 289 }}
                      transition={{ delay: 0.2 + i*0.1, duration: 1, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="text-xl font-bold text-white">{g.value}</div>
                </div>
                <div className="text-white/50 text-xs font-mono uppercase tracking-widest">{g.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Draw Request Form Mock */}
          <motion.div 
            className="bg-black/20 rounded-lg border border-white/5 p-6 flex-1"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="text-white font-medium mb-4">New Draw Request</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/5 border border-white/10 rounded p-3 h-12 flex items-center text-white/30 text-sm font-mono">Amount...</div>
              <div className="bg-white/5 border border-white/10 rounded p-3 h-12 flex items-center text-white/30 text-sm font-mono">Category...</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded p-3 h-24 mb-4 flex items-start text-white/30 text-sm font-mono">Description...</div>
            <div className="bg-[var(--borrower)] text-white text-sm font-bold tracking-widest uppercase rounded py-3 text-center opacity-50">Submit Request</div>
          </motion.div>
        </div>
      </div>

      <motion.div 
        className="absolute bottom-12 px-8 py-3 bg-[var(--gold)]/10 backdrop-blur border border-[var(--gold)]/30 rounded-full text-[var(--gold)] tracking-widest font-mono text-sm shadow-[0_0_30px_rgba(201,168,76,0.15)]"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: phase >= 5 ? 0 : 0.6, duration: 0.6 }}
      >
        LOAN STATUS · DOCUMENTS · DRAW REQUESTS
      </motion.div>

    </motion.div>
  );
}
