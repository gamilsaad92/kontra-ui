import { motion } from "framer-motion";

const LETTERS = "KONTRA".split("");

export function Scene2() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      <div className="relative flex flex-col items-center">
        <div
          className="flex items-end leading-none select-none"
          style={{ fontSize: "clamp(72px, 14vw, 160px)", letterSpacing: "-0.02em" }}
        >
          {LETTERS.map((char, i) => (
            <motion.span
              key={i}
              className="font-extrabold"
              style={{ color: "var(--cream)" }}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.2 + i * 0.07,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.div
          style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
            transformOrigin: "center",
          }}
          className="w-full mt-2"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.p
          className="mt-6 text-sm tracking-[0.28em] uppercase font-medium"
          style={{ color: "var(--gold)" }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
        >
          Data infrastructure for CRE loan servicing
        </motion.p>

        <motion.p
          className="mt-3 text-base font-light"
          style={{ color: "rgba(245,243,238,0.55)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.8 }}
        >
          From document to decision.
        </motion.p>

        <motion.div
          className="mt-10 flex gap-2 items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.6 }}
        >
          {["Lender", "Servicer", "Investor", "Borrower"].map((role, i) => (
            <motion.span
              key={role}
              className="text-xs font-mono px-3 py-1 rounded-full border tracking-widest uppercase"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                borderColor: [
                  "rgba(124,29,53,0.6)",
                  "rgba(146,64,14,0.6)",
                  "rgba(76,29,149,0.6)",
                  "rgba(6,78,59,0.6)",
                ][i],
                color: [
                  "rgba(252,165,165,0.7)",
                  "rgba(253,186,116,0.7)",
                  "rgba(196,181,253,0.7)",
                  "rgba(110,231,183,0.7)",
                ][i],
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.4 + i * 0.1, duration: 0.4, ease: "backOut" }}
            >
              {role}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          className="absolute -z-10 rounded-full"
          style={{
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)",
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}
