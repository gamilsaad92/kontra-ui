import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const FRAGMENTS = [
  { text: "Rent roll in Gmail", x: "15%", y: "20%", delay: 0.1 },
  { text: "Excel waterfall model", x: "65%", y: "15%", delay: 0.3 },
  { text: "Missing DSCR data", x: "70%", y: "65%", delay: 0.2 },
  { text: "No audit trail", x: "15%", y: "70%", delay: 0.4 },
  { text: "Manual compliance", x: "45%", y: "85%", delay: 0.15 },
  { text: "Stale T-12 financials", x: "10%", y: "45%", delay: 0.35 },
  { text: "Inspection backlog", x: "80%", y: "35%", delay: 0.25 },
  { text: "Escrow shortage?", x: "50%", y: "25%", delay: 0.5 },
];

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 2500),
      setTimeout(() => setPhase(2), 3500),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.15 } }}
    >
      {/* Background ambient glow */}
      <motion.div 
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(circle at center, rgba(201,168,76,0.15) 0%, transparent 60%)"
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 6, ease: "easeInOut" }}
      />

      {FRAGMENTS.map((f, i) => (
        <motion.div
          key={i}
          className="absolute font-mono text-sm tracking-widest uppercase select-none whitespace-nowrap"
          style={{
            left: f.x,
            top: f.y,
            color: "rgba(201,168,76,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0, y: 15, scale: 0.9 }}
          animate={{
            opacity: phase >= 2 ? 0 : [0, 0.4, 0.2, 0.4],
            y: phase >= 2 ? -20 : [15, 0, -10, 0],
            scale: phase >= 2 ? 0.9 : 1,
            filter: phase >= 2 ? "blur(4px)" : "blur(0px)",
          }}
          transition={{
            delay: phase >= 2 ? 0 : f.delay,
            duration: phase >= 2 ? 0.5 : 5,
            times: phase >= 2 ? undefined : [0, 0.2, 0.6, 1],
            repeat: phase >= 2 ? 0 : Infinity,
            repeatType: phase >= 2 ? undefined : "mirror",
            ease: "easeInOut",
          }}
        >
          {f.text}
        </motion.div>
      ))}

      <div className="relative text-center px-16 z-10 w-full max-w-4xl mx-auto">
        {/* Red Strike Line */}
        <motion.div
          className="absolute left-0 right-0 h-1 z-20"
          style={{
            top: "50%",
            background: "#EF4444", // Red strike
            transformOrigin: "left center",
            boxShadow: "0 0 15px rgba(239,68,68,0.5)"
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ 
            scaleX: phase >= 1 ? 1 : 0, 
            opacity: phase >= 1 ? 0.9 : 0,
            y: phase >= 2 ? -5 : 0
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.h1
          className="text-6xl md:text-7xl font-extrabold leading-tight tracking-tighter"
          style={{ color: "var(--cream)" }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ 
            opacity: phase >= 2 ? 0 : 1, 
            y: phase >= 2 ? -20 : 0,
            scale: phase >= 2 ? 1.05 : 1,
            filter: phase >= 2 ? "blur(8px)" : "blur(0px)"
          }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          CRE loan servicing<br />still runs on email.
        </motion.h1>
      </div>
    </motion.div>
  );
}
