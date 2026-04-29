import { motion } from "framer-motion";

const STAGES = [
  { label: "PERFORMING", color: "#6EE7B7", sub: "Current" },
  { label: "WATCHLIST", color: "#FCD34D", sub: "Monitoring" },
  { label: "SPECIAL SVC", color: "#FB923C", sub: "Exception" },
  { label: "DEFAULT", color: "#F87171", sub: "Critical" },
  { label: "RESOLVED", color: "#C4B5FD", sub: "Closed" },
];

function Arrow({ delay }: { delay: number }) {
  return (
    <motion.div
      className="flex-shrink-0 flex items-center"
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay, duration: 0.3, ease: "easeOut", transformOrigin: "left" }}
    >
      <div style={{ width: "20px", height: "1px", background: "rgba(201,168,76,0.4)" }} />
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "4px solid transparent",
          borderBottom: "4px solid transparent",
          borderLeft: "6px solid rgba(201,168,76,0.4)",
        }}
      />
    </motion.div>
  );
}

export function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-12 px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      <div className="text-center">
        <motion.p
          className="text-xs font-mono tracking-[0.3em] uppercase mb-3"
          style={{
            color: "var(--gold)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          Freddie Mac PMC Workflow
        </motion.p>
        <motion.h2
          className="text-3xl font-bold"
          style={{ color: "var(--cream)" }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Compliance-first.{" "}
          <span style={{ color: "var(--gold)" }}>From day one.</span>
        </motion.h2>
      </div>

      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => (
          <div key={stage.label} className="flex items-center">
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.5 + i * 0.25,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <motion.div
                className="w-[90px] rounded-lg py-3 px-2 text-center"
                style={{
                  background: `${stage.color}18`,
                  border: `1px solid ${stage.color}60`,
                }}
                animate={{ borderColor: [`${stage.color}40`, `${stage.color}90`, `${stage.color}40`] }}
                transition={{ delay: 1 + i * 0.3, duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div
                  className="text-[9px] font-mono font-bold tracking-widest mb-1"
                  style={{
                    color: stage.color,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stage.label}
                </div>
                <div
                  className="text-[8px] font-mono"
                  style={{
                    color: "var(--muted)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {stage.sub}
                </div>
              </motion.div>
            </motion.div>
            {i < STAGES.length - 1 && <Arrow delay={0.7 + i * 0.25} />}
          </div>
        ))}
      </div>

      <div className="flex gap-8 items-center">
        {[
          { label: "Immutable audit log", icon: "✓" },
          { label: "Downstream blocking", icon: "⬡" },
          { label: "5-doc PMC bundle", icon: "◻" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 + i * 0.15, duration: 0.5 }}
          >
            <span style={{ color: "var(--gold)", fontSize: "14px" }}>{item.icon}</span>
            <span
              className="text-xs font-mono"
              style={{
                color: "var(--muted)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
