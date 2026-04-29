import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

const KPIS = [
  { value: 284, suffix: "M", prefix: "$", label: "Portfolio AUM", color: "#C9A84C", delay: 0.4 },
  { value: 1.38, suffix: "×", prefix: "", label: "Avg DSCR", color: "#6EE7B7", delay: 0.65 },
  { value: 100, suffix: "%", prefix: "", label: "Compliance rate", color: "#C4B5FD", delay: 0.9 },
];

function TickerNumber({
  value,
  suffix,
  prefix,
  color,
  delay,
}: {
  value: number;
  suffix: string;
  prefix: string;
  color: string;
  delay: number;
}) {
  const mv = useMotionValue(0);

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 2.5,
      delay,
      ease: "easeOut",
    });
    return controls.stop;
  }, []);

  return (
    <motion.span style={{ color }} className="tabular-nums">
      {prefix}
      <motion.span>
        {useTransform(mv, (v) =>
          value % 1 === 0 ? Math.round(v).toString() : v.toFixed(2),
        )}
      </motion.span>
      {suffix}
    </motion.span>
  );
}

const CHART_POINTS = [
  { x: 0, y: 80 },
  { x: 10, y: 72 },
  { x: 20, y: 68 },
  { x: 35, y: 55 },
  { x: 50, y: 50 },
  { x: 62, y: 42 },
  { x: 75, y: 35 },
  { x: 88, y: 28 },
  { x: 100, y: 20 },
];

function toSvgPath(pts: { x: number; y: number }[]) {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

export function Scene6() {
  const pathD = toSvgPath(CHART_POINTS);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-16"
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
        Real-time.{" "}
        <span style={{ color: "var(--gold)" }}>Auditable.</span>
        {" "}Immutable.
      </motion.h2>

      <div className="flex gap-16 items-start">
        <div className="flex flex-col gap-6">
          {KPIS.map((kpi) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: kpi.delay, duration: 0.5 }}
            >
              <div
                className="text-4xl font-extrabold font-mono"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <TickerNumber {...kpi} />
              </div>
              <div
                className="text-xs font-mono tracking-widest uppercase mt-1"
                style={{
                  color: "var(--muted)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {kpi.label}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex-1">
          <motion.svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: "360px", height: "180px" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(201,168,76,0.2)" />
                <stop offset="100%" stopColor="rgba(201,168,76,0)" />
              </linearGradient>
            </defs>
            <motion.path
              d={`${pathD} L 100 100 L 0 100 Z`}
              fill="url(#chartGrad)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 1.0, duration: 2.5, ease: "easeInOut" }}
            />
            <motion.path
              d={pathD}
              fill="none"
              stroke="var(--gold)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 1.0, duration: 2.5, ease: "easeInOut" }}
            />
            {CHART_POINTS.map((pt, i) => (
              <motion.circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r="1.2"
                fill="var(--gold)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5 + i * 0.2, duration: 0.2 }}
              />
            ))}
          </motion.svg>

          <motion.p
            className="text-xs font-mono mt-2"
            style={{
              color: "var(--muted)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.5, duration: 0.5 }}
          >
            Portfolio DSCR trend — 6 active loans
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
