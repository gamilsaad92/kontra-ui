import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

function Counter({ from, to, delay }: { from: number, to: number, delay: number }) {
  const val = useMotionValue(from);
  
  useEffect(() => {
    const controls = animate(val, to, {
      duration: 2,
      delay: delay,
      ease: "easeOut"
    });
    return controls.stop;
  }, [val, to, delay]);

  const display = useTransform(val, v => `$${v.toFixed(1)}M`);
  
  return <motion.span>{display}</motion.span>;
}

export function Scene8() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 8500), // Exiting
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const tokens = [
    { id: "KTRA-2847", nav: "$1.02", yield: "7.4%" },
    { id: "KTRA-2741", nav: "$0.98", yield: "8.1%" },
  ];

  const bids = [
    { size: "25k", price: "1.018" },
    { size: "10k", price: "1.015" },
    { size: "100k", price: "1.012" },
  ];
  
  const asks = [
    { size: "50k", price: "1.021" },
    { size: "15k", price: "1.022" },
    { size: "200k", price: "1.025" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px",
          perspective: "1000px"
        }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-full max-w-5xl flex gap-12 items-center relative z-10 px-8">
        
        {/* Left Side: Total & Tokens */}
        <div className="flex-1 flex flex-col gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= 4 ? { opacity: 0 } : phase >= 1 ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="text-white/50 text-sm font-mono uppercase tracking-widest mb-2">Total Tokenized</div>
            <div className="text-6xl font-light text-white font-mono tracking-tight">
              {phase >= 1 ? <Counter from={0} to={225.4} delay={0.5} /> : "$0.0M"}
            </div>
          </motion.div>

          <div className="flex gap-4">
            {tokens.map((t, i) => (
              <motion.div 
                key={t.id}
                className="bg-white/5 border border-white/10 rounded-lg p-5 flex-1 backdrop-blur-md relative overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                animate={phase >= 4 ? { opacity: 0 } : phase >= 2 ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-[var(--gold)]/50" />
                <div className="text-white font-bold mb-4">{t.id}</div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-white/40 text-xs mb-1">NAV</div>
                    <div className="text-xl text-white font-mono">{t.nav}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/40 text-xs mb-1">Yield</div>
                    <div className="text-green-400 font-mono">{t.yield}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Side: Order Book */}
        <motion.div 
          className="flex-1 bg-black/40 border border-white/10 rounded-xl p-6 backdrop-blur-xl"
          initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
          animate={phase >= 4 ? { opacity: 0 } : phase >= 3 ? { opacity: 1, scale: 1, rotateY: 0 } : {}}
          transition={{ duration: 0.6, type: "spring" }}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="text-white font-medium mb-6 flex justify-between items-center">
            <span>Secondary Market</span>
            <span className="text-xs text-white/40 font-mono">KTRA-2847</span>
          </div>

          <div className="flex text-xs text-white/40 font-mono uppercase border-b border-white/10 pb-2 mb-2">
            <div className="flex-1">Size</div>
            <div className="flex-1 text-center">Price</div>
            <div className="flex-1 text-right text-white/20">Ask/Bid</div>
          </div>

          {/* Asks (Red) */}
          <div className="flex flex-col gap-1 mb-4">
            {asks.map((a, i) => (
              <div key={i} className="flex text-sm font-mono relative py-1">
                <div className="absolute right-0 top-0 h-full bg-red-500/10 rounded-sm" style={{ width: `${Math.random() * 40 + 20}%` }} />
                <div className="flex-1 text-white/60 relative z-10">{a.size}</div>
                <div className="flex-1 text-center text-red-400 relative z-10">{a.price}</div>
                <div className="flex-1 relative z-10"></div>
              </div>
            ))}
          </div>

          {/* Current Price */}
          <div className="text-center py-2 text-xl font-mono text-white border-y border-white/5 my-2">
            1.019
          </div>

          {/* Bids (Green) */}
          <div className="flex flex-col gap-1 mt-4">
            {bids.map((b, i) => (
              <div key={i} className="flex text-sm font-mono relative py-1">
                <div className="absolute right-0 top-0 h-full bg-green-500/10 rounded-sm" style={{ width: `${Math.random() * 50 + 30}%` }} />
                <div className="flex-1 text-white/60 relative z-10">{b.size}</div>
                <div className="flex-1 text-center text-green-400 relative z-10">{b.price}</div>
                <div className="flex-1 relative z-10"></div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center text-white/50 text-xs font-mono">
            $124.2M trades settled YTD
          </div>
        </motion.div>

      </div>

      <motion.div 
        className="absolute bottom-12 px-8 py-3 bg-[var(--gold)]/10 backdrop-blur border border-[var(--gold)]/30 rounded-full text-[var(--gold)] tracking-widest font-mono text-sm shadow-[0_0_30px_rgba(201,168,76,0.15)] z-20"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 4 ? { opacity: 0, y: 20 } : phase >= 1 ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: phase >= 4 ? 0 : 0.6, duration: 0.6 }}
      >
        ERC-1400 · REG D/S · SECONDARY TRADING
      </motion.div>
    </motion.div>
  );
}
