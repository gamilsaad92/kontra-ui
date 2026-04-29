import { motion } from "framer-motion";

const LETTERS = "KONTRA".split("");

export function Scene7() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.5 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col items-center z-10">
        <motion.div
          className="text-xs font-mono tracking-[0.35em] uppercase mb-8"
          style={{
            color: "var(--gold)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          Institutional-grade CRE data infrastructure
        </motion.div>

        <div
          className="flex items-end leading-none select-none"
          style={{ fontSize: "clamp(80px, 16vw, 180px)", letterSpacing: "-0.02em" }}
        >
          {LETTERS.map((char, i) => (
            <motion.span
              key={i}
              className="font-extrabold"
              style={{ color: "var(--cream)" }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.5 + i * 0.06,
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.div
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, var(--gold) 30%, var(--gold) 70%, transparent 100%)",
          }}
          className="w-full mt-3"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.p
          className="mt-6 text-base tracking-[0.18em] uppercase font-light"
          style={{ color: "rgba(245,243,238,0.7)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          Built for the institutional stack.
        </motion.p>

        <motion.p
          className="mt-3 text-lg font-mono"
          style={{
            color: "var(--gold)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.0, duration: 0.8 }}
        >
          kontraplatform.com
        </motion.p>

        <motion.div
          className="mt-10 flex gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.8, duration: 0.8 }}
        >
          {["YC F25", "Series Seed", "CRE × AI"].map((badge) => (
            <span
              key={badge}
              className="text-xs font-mono px-3 py-1 rounded-full"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                border: "1px solid rgba(201,168,76,0.3)",
                color: "rgba(201,168,76,0.7)",
              }}
            >
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
