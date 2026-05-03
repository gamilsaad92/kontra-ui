import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const LETTERS = "KONTRA".split("");
const ROLES = [
  { name: "LENDER", color: "var(--lender)" },
  { name: "SERVICER", color: "var(--servicer)" },
  { name: "INVESTOR", color: "var(--investor)" },
  { name: "BORROWER", color: "var(--borrower)" },
];

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 5500), // Exiting
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="absolute -z-10 rounded-full"
        style={{
          width: "800px",
          height: "800px",
          background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
        }}
        animate={{ 
          scale: phase >= 3 ? 0.8 : [1, 1.1, 1],
          opacity: phase >= 3 ? 0 : 1
        }}
        transition={{ duration: 4, repeat: phase >= 3 ? 0 : Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col items-center z-10 w-full max-w-5xl">
        <div
          className="flex items-center justify-center leading-none select-none w-full"
          style={{ fontSize: "clamp(80px, 15vw, 180px)", letterSpacing: "-0.03em" }}
        >
          {LETTERS.map((char, i) => (
            <motion.span
              key={i}
              className="font-extrabold"
              style={{ color: "var(--cream)", display: "inline-block" }}
              initial={{ opacity: 0, y: 80, rotateX: -60, scale: 0.8 }}
              animate={phase >= 3 ? {
                opacity: 0, y: -40, scale: 1.1, filter: "blur(10px)"
              } : {
                opacity: 1, y: 0, rotateX: 0, scale: 1, filter: "blur(0px)"
              }}
              transition={{
                delay: phase >= 3 ? i * 0.05 : 0.2 + i * 0.08,
                type: phase >= 3 ? "tween" : "spring",
                stiffness: 250,
                damping: 20,
                duration: phase >= 3 ? 0.4 : undefined
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.p
          className="mt-8 text-xl md:text-2xl tracking-[0.15em] uppercase font-semibold text-center"
          style={{ color: "var(--gold)" }}
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={phase >= 3 ? { opacity: 0, y: -10 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: phase >= 3 ? 0 : 1.2, duration: 0.6, ease: "easeOut" }}
        >
          Data infrastructure for CRE loan servicing
        </motion.p>

        <div className="mt-12 flex flex-wrap justify-center gap-4 md:gap-6">
          {ROLES.map((role, i) => (
            <motion.div
              key={role.name}
              className="flex items-center"
              initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
              animate={phase >= 3 ? { opacity: 0, scale: 0.9 } : phase >= 2 ? { opacity: 1, x: 0, filter: "blur(0px)" } : {}}
              transition={{ delay: phase >= 3 ? i*0.05 : i * 0.15, duration: 0.5, ease: "easeOut" }}
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color, boxShadow: `0 0 8px ${role.color}` }} />
                <span className="text-sm font-mono tracking-widest font-medium" style={{ color: "var(--cream)" }}>
                  {role.name}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
