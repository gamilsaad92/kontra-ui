import { motion } from "framer-motion";

const FRAGMENTS = [
  { text: "Rent roll in Gmail", x: "12%", y: "18%", delay: 0.1 },
  { text: "Excel waterfall model", x: "62%", y: "13%", delay: 0.25 },
  { text: "Missing DSCR data", x: "76%", y: "58%", delay: 0.15 },
  { text: "No audit trail", x: "18%", y: "68%", delay: 0.35 },
  { text: "Manual compliance", x: "42%", y: "78%", delay: 0.2 },
  { text: "Stale T-12 financials", x: "8%", y: "42%", delay: 0.4 },
  { text: "Inspection backlog", x: "78%", y: "30%", delay: 0.3 },
  { text: "Escrow shortage?", x: "50%", y: "22%", delay: 0.45 },
];

export function Scene1() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      {FRAGMENTS.map((f, i) => (
        <motion.div
          key={i}
          className="absolute font-mono text-xs tracking-widest uppercase select-none"
          style={{
            left: f.x,
            top: f.y,
            color: "rgba(201,168,76,0.35)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: [0, 0.35, 0.25, 0.35],
            y: [8, 0, -4, 0],
          }}
          transition={{
            delay: f.delay,
            duration: 4,
            times: [0, 0.2, 0.6, 1],
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        >
          {f.text}
        </motion.div>
      ))}

      <div className="relative text-center px-16 z-10">
        <motion.div
          className="mb-5"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: "1px",
            background: "var(--gold)",
            transformOrigin: "left center",
          }}
        />

        <motion.h1
          className="text-5xl font-bold leading-tight tracking-tight"
          style={{ color: "var(--cream)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          CRE loan servicing
          <br />
          still runs on email.
        </motion.h1>

        <motion.p
          className="mt-4 text-base tracking-widest uppercase font-mono"
          style={{
            color: "var(--muted)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          There's a better way.
        </motion.p>

        <motion.div
          className="mt-5"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: "1px",
            background: "var(--gold)",
            transformOrigin: "right center",
          }}
        />
      </div>
    </motion.div>
  );
}
