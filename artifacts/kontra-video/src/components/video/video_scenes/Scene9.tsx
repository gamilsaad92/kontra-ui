import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene9() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1900),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => setPhase(5), 7500), // Exiting
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const stats = [
    { value: "10,290+", label: "Accredited Investors" },
    { value: "$623.5M", label: "Assets Under Management" },
    { value: "$124.2M", label: "Secondary Trades YTD" },
    { value: "6 Active", label: "Loans Across 4 Asset Classes" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-[1px] bg-white/5 opacity-20">
        {[...Array(4)].map((_, i) => (
          <motion.div 
            key={i} 
            className="bg-black w-full h-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1, delay: i * 0.2 }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-12 relative z-10 w-full max-w-4xl px-8">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col items-center">
            <motion.div
              className="text-5xl md:text-7xl font-bold font-mono tracking-tighter text-white"
              initial={{ opacity: 0, y: 40 }}
              animate={phase >= 5 ? { opacity: 0 } : phase >= i + 1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
            >
              {stat.value}
            </motion.div>
            <motion.div
              className="mt-2 relative"
              initial={{ opacity: 0 }}
              animate={phase >= 5 ? { opacity: 0 } : phase >= i + 1 ? { opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="text-[var(--gold)] text-sm md:text-base tracking-widest uppercase font-mono mb-2 text-center">
                {stat.label}
              </div>
              <motion.div 
                className="h-[2px] bg-[var(--gold)] mx-auto"
                initial={{ width: 0 }}
                animate={phase >= i + 1 ? { width: "100%" } : { width: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              />
            </motion.div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
