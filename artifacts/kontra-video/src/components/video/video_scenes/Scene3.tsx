import { motion } from "framer-motion";

const DOCS = [
  {
    label: "RENT ROLL",
    color: "rgba(124,29,53,0.8)",
    accent: "#FCA5A5",
    lines: 8,
    result: "NOI: $2.14M",
    delay: 0.3,
  },
  {
    label: "T-12 FINANCIALS",
    color: "rgba(146,64,14,0.8)",
    accent: "#FCD34D",
    lines: 10,
    result: "DSCR: 1.38×",
    delay: 0.8,
  },
  {
    label: "INSPECTION REPORT",
    color: "rgba(76,29,149,0.8)",
    accent: "#C4B5FD",
    lines: 7,
    result: "LTV: 58.3%",
    delay: 1.3,
  },
];

function DocCard({
  label,
  color,
  accent,
  lines,
  result,
  delay,
}: (typeof DOCS)[0]) {
  return (
    <motion.div
      className="relative rounded-lg overflow-hidden"
      style={{
        width: "200px",
        background: "rgba(28,30,38,0.9)",
        border: `1px solid ${color}`,
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="px-4 py-2 text-xs font-mono font-bold tracking-widest"
        style={{
          background: color,
          color: accent,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {label}
      </div>
      <div className="p-4">
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            className="h-[3px] rounded-full mb-2"
            style={{
              background: i % 3 === 0 ? "rgba(201,168,76,0.25)" : "rgba(90,95,114,0.4)",
              width: `${55 + Math.sin(i * 1.7) * 30}%`,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              delay: delay + 0.1 + i * 0.06,
              duration: 0.3,
              ease: "easeOut",
              transformOrigin: "left",
            }}
          />
        ))}
        <motion.div
          className="mt-3 pt-3 text-sm font-bold font-mono"
          style={{
            color: accent,
            borderTop: `1px solid ${color}`,
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.7, duration: 0.4 }}
        >
          → {result}
        </motion.div>
      </div>
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${color} 50%, transparent 100%)`,
          opacity: 0.08,
        }}
        initial={{ y: "-100%" }}
        animate={{ y: "200%" }}
        transition={{
          delay: delay + 0.2,
          duration: 0.7,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      <motion.h2
        className="text-3xl font-bold text-center"
        style={{ color: "var(--cream)" }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        Every document.{" "}
        <span style={{ color: "var(--gold)" }}>Instantly structured.</span>
      </motion.h2>

      <div className="flex gap-6 items-start">
        {DOCS.map((doc) => (
          <DocCard key={doc.label} {...doc} />
        ))}
      </div>

      <motion.p
        className="text-xs font-mono tracking-widest uppercase"
        style={{
          color: "var(--muted)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.8, duration: 0.8 }}
      >
        AI-powered · Auditable · Immutable
      </motion.p>
    </motion.div>
  );
}
