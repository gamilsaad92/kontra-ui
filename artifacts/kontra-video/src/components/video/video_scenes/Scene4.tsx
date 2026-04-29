import { motion } from "framer-motion";

const PORTALS = [
  {
    role: "LENDER",
    color: "#7C1D35",
    bg: "rgba(124,29,53,0.12)",
    border: "rgba(124,29,53,0.6)",
    text: "#FCA5A5",
    desc: "Origination & Risk",
    metric: "$284M AUM",
    metricLabel: "portfolio value",
    delay: 0.2,
  },
  {
    role: "SERVICER",
    color: "#92400E",
    bg: "rgba(146,64,14,0.12)",
    border: "rgba(146,64,14,0.6)",
    text: "#FCD34D",
    desc: "Compliance & Payments",
    metric: "100%",
    metricLabel: "Freddie Mac aligned",
    delay: 0.45,
  },
  {
    role: "INVESTOR",
    color: "#4C1D95",
    bg: "rgba(76,29,149,0.12)",
    border: "rgba(76,29,149,0.6)",
    text: "#C4B5FD",
    desc: "Portfolio Intelligence",
    metric: "6 loans",
    metricLabel: "real-time DSCR",
    delay: 0.7,
  },
  {
    role: "BORROWER",
    color: "#064E3B",
    bg: "rgba(6,78,59,0.12)",
    border: "rgba(6,78,59,0.6)",
    text: "#6EE7B7",
    desc: "Loan Transparency",
    metric: "Live",
    metricLabel: "payment status",
    delay: 0.95,
  },
];

function PortalCard({ role, color, bg, border, text, desc, metric, metricLabel, delay }: (typeof PORTALS)[0]) {
  return (
    <motion.div
      className="relative rounded-xl overflow-hidden flex-1"
      style={{ background: bg, border: `1px solid ${border}` }}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="p-5">
        <div
          className="text-xs font-mono font-bold tracking-[0.2em] mb-3"
          style={{ color: text, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {role}
        </div>
        <div
          className="text-3xl font-bold mb-1"
          style={{ color }}
        >
          {metric}
        </div>
        <div
          className="text-xs font-mono mb-4"
          style={{ color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          {metricLabel}
        </div>
        <div
          style={{ height: "1px", background: border }}
          className="mb-3"
        />
        <div
          className="text-xs font-medium"
          style={{ color: "rgba(245,243,238,0.6)" }}
        >
          {desc}
        </div>
      </div>

      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: "2px", background: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: delay + 0.3, duration: 0.5, ease: "easeOut", transformOrigin: "left" }}
      />

      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{ border: `1px solid ${color}`, opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ delay: delay + 0.4, duration: 1.2, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

export function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12 gap-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      <motion.h2
        className="text-3xl font-bold text-center"
        style={{ color: "var(--cream)" }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.5 }}
      >
        One platform.{" "}
        <span style={{ color: "var(--gold)" }}>Four roles.</span>
      </motion.h2>

      <div className="flex gap-4 w-full max-w-5xl">
        {PORTALS.map((p) => (
          <PortalCard key={p.role} {...p} />
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
        transition={{ delay: 2.4, duration: 0.8 }}
      >
        Role-based access · Audit trail · Immutable ledger
      </motion.p>
    </motion.div>
  );
}
