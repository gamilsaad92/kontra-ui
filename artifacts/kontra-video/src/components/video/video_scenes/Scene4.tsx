import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene4() {
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

  const stats = [
    { label: "Pending Draws", value: "12" },
    { label: "In Queue", value: "$2.84M" },
    { label: "Inspections Due", value: "4", alert: true },
  ];

  const steps = [
    { label: "Pending", status: "complete" },
    { label: "Approved", status: "complete" },
    { label: "Funded", status: "active" },
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
          background: "radial-gradient(circle at 80% 50%, rgba(146,64,14,0.08) 0%, transparent 60%)",
        }}
        animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.02, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-[85vw] h-[80vh] rounded-xl border border-white/10 bg-[#12151F]/90 backdrop-blur-xl shadow-2xl flex overflow-hidden">
        
        {/* Sidebar */}
        <motion.div 
          className="w-64 border-r border-white/10 bg-white/5 flex flex-col p-6"
          initial={{ x: -100, opacity: 0 }}
          animate={phase >= 5 ? { x: -50, opacity: 0 } : phase >= 1 ? { x: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 mb-10">
            <div className="px-3 py-1 rounded bg-[var(--servicer)] font-bold text-white text-xs tracking-widest shadow-[0_0_15px_rgba(146,64,14,0.6)]">
              SERVICER
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {["Operations", "Draws", "Inspections", "Payments", "Escrow"].map((item, i) => (
              <div key={item} className={`text-sm px-3 py-2 rounded ${i === 1 ? 'bg-white/10 text-white' : 'text-white/50'}`}>
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
            Servicing Operations Center
          </motion.h2>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-6 mb-10">
            {stats.map((stat, i) => (
              <motion.div 
                key={stat.label}
                className="bg-black/30 border border-white/5 rounded-lg p-5"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={phase >= 5 ? { opacity: 0, scale: 0.9 } : phase >= 3 ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: phase >= 5 ? 0 : i * 0.1, duration: 0.5, type: "spring" }}
              >
                <div className="text-white/50 text-xs font-mono mb-2 uppercase">{stat.label}</div>
                <div className={`text-4xl font-light ${stat.alert ? 'text-amber-400' : 'text-white'}`}>
                  {stat.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Draw Request Card */}
          <motion.div 
            className="bg-black/20 rounded-lg border border-white/5 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 5 ? { opacity: 0, y: 20 } : phase >= 4 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-white font-medium text-lg">Draw Request #DR-442</div>
                <div className="text-white/50 text-sm">LN-2847 • $450,000.00</div>
              </div>
              <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono uppercase tracking-wider">
                Action Required
              </div>
            </div>

            <div className="flex items-center gap-4">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <div className={`h-2 rounded-full w-24 ${step.status === 'complete' ? 'bg-amber-500' : step.status === 'active' ? 'bg-amber-500/40 animate-pulse' : 'bg-white/10'}`} />
                    <div className={`text-xs font-mono uppercase ${step.status === 'complete' ? 'text-amber-500' : step.status === 'active' ? 'text-amber-300' : 'text-white/30'}`}>
                      {step.label}
                    </div>
                  </div>
                  {i < steps.length - 1 && <div className="text-white/20">→</div>}
                </div>
              ))}
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
        PAYMENTS · DRAWS · INSPECTIONS · ESCROW
      </motion.div>

    </motion.div>
  );
}
