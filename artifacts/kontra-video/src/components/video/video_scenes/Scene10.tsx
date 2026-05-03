import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const LETTERS = "KONTRA".split("");
const ROLES = [
  { name: "LENDER", color: "var(--lender)" },
  { name: "SERVICER", color: "var(--servicer)" },
  { name: "INVESTOR", color: "var(--investor)" },
  { name: "BORROWER", color: "var(--borrower)" },
];

export function Scene10() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[var(--bg)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6 } }}
      exit={{ opacity: 0, transition: { duration: 1 } }} // slow fade out for the end
    >
      <div className="relative flex flex-col items-center z-10">
        <div
          className="flex items-center justify-center leading-none select-none w-full mb-4"
          style={{ fontSize: "140px", letterSpacing: "-0.03em" }}
        >
          {LETTERS.map((char, i) => (
            <motion.span
              key={i}
              className="font-extrabold"
              style={{ color: "var(--cream)", display: "inline-block" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.8, ease: "easeOut" }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.div 
          className="w-full h-1 bg-[var(--gold)] mb-8"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 1, ease: "easeInOut" }}
        />

        <motion.div
          className="text-[var(--gold)] font-mono text-xl tracking-widest mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          kontraplatform.com
        </motion.div>

        <motion.div
          className="text-white/60 text-lg uppercase tracking-widest font-light mb-16"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          The operating system for CRE debt markets.
        </motion.div>

        <motion.div 
          className="flex gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
        >
          {ROLES.map((role, i) => (
            <motion.div
              key={role.name}
              className="px-4 py-2 rounded-full border border-white/10 bg-white/5 relative overflow-hidden"
              animate={{ 
                boxShadow: [`0 0 0px ${role.color}`, `0 0 15px ${role.color}`, `0 0 0px ${role.color}`]
              }}
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
            >
              <div className="w-full h-full absolute inset-0 opacity-20" style={{ backgroundColor: role.color }} />
              <span className="text-xs font-mono tracking-widest font-medium relative z-10" style={{ color: "var(--cream)" }}>
                {role.name}
              </span>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </motion.div>
  );
}
