import { motion } from "framer-motion";

const TOKENS = [
  {
    id: "KTRA-2847",
    name: "300 Mission Street",
    type: "MULTIFAMILY",
    tvl: "$141.2M",
    holders: "4,218",
    yield: "7.4%",
    color: "#C4B5FD",
    border: "rgba(76,29,149,0.6)",
    bg: "rgba(76,29,149,0.1)",
    delay: 0.6,
  },
  {
    id: "KTRA-5544",
    name: "Pacific Industrial Park",
    type: "INDUSTRIAL",
    tvl: "$84.2M",
    holders: "2,891",
    yield: "6.1%",
    color: "#6EE7B7",
    border: "rgba(6,78,59,0.6)",
    bg: "rgba(6,78,59,0.1)",
    delay: 1.0,
  },
];

const WATERFALL = [
  { label: "Gross Rent", pct: 100, color: "#C9A84C" },
  { label: "Servicer Fee (3%)", pct: 97, color: "#FCD34D" },
  { label: "Reserve (5%)", pct: 92, color: "#FB923C" },
  { label: "Token Distribution", pct: 87, color: "#C4B5FD" },
];

function TokenCard({ id, name, type, tvl, holders, yield: yld, color, border, bg, delay }: (typeof TOKENS)[0]) {
  return (
    <motion.div
      className="rounded-xl overflow-hidden flex-1"
      style={{ background: bg, border: `1px solid ${border}` }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-xs font-mono font-bold tracking-widest"
            style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {id}
          </span>
          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded-full"
            style={{ color, border: `1px solid ${border}`, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {type}
          </span>
        </div>
        <div className="text-sm font-semibold mb-3" style={{ color: "var(--cream)" }}>
          {name}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "TVL", val: tvl },
            { label: "HOLDERS", val: holders },
            { label: "YIELD", val: yld },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-base font-bold" style={{ color }}>{item.val}</div>
              <div
                className="text-[8px] font-mono tracking-widest"
                style={{ color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
      <motion.div
        className="h-[2px]"
        style={{ background: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: delay + 0.4, duration: 0.6, ease: "easeOut", transformOrigin: "left" }}
      />
    </motion.div>
  );
}

function WaterfallBar({ label, pct, color, delay }: (typeof WATERFALL)[0] & { delay: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="text-[9px] font-mono tracking-wide text-right shrink-0"
        style={{ color: "var(--muted)", width: 130, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
      <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div
        className="text-[9px] font-mono shrink-0"
        style={{ color, width: 32, fontFamily: "'JetBrains Mono', monospace" }}
      >
        {pct}%
      </div>
    </div>
  );
}

export function Scene8() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12 gap-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
    >
      <div className="text-center">
        <motion.p
          className="text-xs font-mono tracking-[0.3em] uppercase mb-2"
          style={{ color: "var(--gold)", fontFamily: "'JetBrains Mono', monospace" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          ERC-1400 Token Registry · Reg D / Reg S
        </motion.p>
        <motion.h2
          className="text-3xl font-bold"
          style={{ color: "var(--cream)" }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          $225.4M tokenized.{" "}
          <span style={{ color: "var(--gold)" }}>On-chain. Compliant.</span>
        </motion.h2>
      </div>

      <div className="flex gap-4 w-full max-w-3xl">
        {TOKENS.map((t) => (
          <TokenCard key={t.id} {...t} />
        ))}
      </div>

      <motion.div
        className="w-full max-w-3xl rounded-xl p-4"
        style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.5 }}
      >
        <div
          className="text-[10px] font-mono font-bold tracking-[0.25em] uppercase mb-3"
          style={{ color: "var(--gold)", fontFamily: "'JetBrains Mono', monospace" }}
        >
          Cash Flow Waterfall
        </div>
        <div className="flex flex-col gap-2">
          {WATERFALL.map((w, i) => (
            <WaterfallBar key={w.label} {...w} delay={1.7 + i * 0.15} />
          ))}
        </div>
      </motion.div>

      <motion.div
        className="flex gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.2, duration: 0.6 }}
      >
        {[
          { label: "ERC-1400 compliant", color: "#C4B5FD" },
          { label: "Reg D + Reg S layer", color: "#C9A84C" },
          { label: "10,290 whitelisted investors", color: "#6EE7B7" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span style={{ color: item.color, fontSize: 10 }}>◆</span>
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--muted)", fontFamily: "'JetBrains Mono', monospace" }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
