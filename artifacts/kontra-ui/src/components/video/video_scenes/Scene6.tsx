import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, rotateY: 90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      exit={{ opacity: 0, x: '-100vw' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1200 }}
    >
      <div className="w-full max-w-7xl mx-auto grid grid-cols-2 gap-16 px-12 items-center">
        
        {/* Token Cards Stack */}
        <div className="relative h-[60vh] flex items-center justify-center" style={{ perspective: 1000 }}>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-64 h-96 rounded-2xl border border-white/20 bg-black/60 backdrop-blur-xl p-6 flex flex-col justify-between shadow-[0_0_30px_rgba(124,58,237,0.2)]"
              initial={{ 
                rotateX: 60, 
                rotateY: 20, 
                z: -500, 
                y: -100,
                opacity: 0 
              }}
              animate={phase >= 2 ? {
                rotateX: 10 + (i * 5),
                rotateY: -20 + (i * 10),
                z: -i * 100,
                y: i * 40,
                x: i * 30,
                opacity: 1 - (i * 0.2)
              } : {}}
              transition={{ type: 'spring', stiffness: 80, damping: 20, delay: i * 0.15 }}
            >
              <div className="flex justify-between items-start">
                <div className="text-[#7C3AED] font-mono text-sm">KNTR-A</div>
                <div className="w-8 h-8 rounded-full border border-white/20 bg-white/5 flex items-center justify-center">
                   <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-xs text-white/40 font-mono">LIVE NAV</div>
                  <div className="text-3xl font-display">$1,042.85</div>
                </div>
                <div className="h-[1px] bg-white/10 w-full" />
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-white/40">YIELD</span>
                  <span className="text-[#7C3AED]">8.4% APY</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col justify-center">
          <motion.div 
            className="px-4 py-1.5 rounded-full border border-[#7C3AED] text-[#7C3AED] text-sm font-mono tracking-wider self-start mb-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            INVESTOR PORTAL
          </motion.div>
          <h2 className="text-[3.5vw] font-display leading-[1.1] mb-6">
            Token-native access.
          </h2>
          <motion.p 
            className="text-xl text-white/60 font-body mb-8 max-w-md"
            initial={{ opacity: 0 }}
            animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          >
            Live NAV pricing. Distribution waterfalls. Secondary market ready.
          </motion.p>
          
          {/* Simulated order book feed */}
          <div className="space-y-2 font-mono text-sm">
            {[
              { t: '14:02:11', act: 'BUY', amt: '250 KNTR-A', px: '1042.85' },
              { t: '14:02:08', act: 'BUY', amt: '100 KNTR-A', px: '1042.80' },
              { t: '14:01:55', act: 'SELL', amt: '50 KNTR-A', px: '1042.90' },
            ].map((row, i) => (
              <motion.div 
                key={i}
                className="flex gap-4 p-2 bg-white/5 rounded"
                initial={{ opacity: 0, x: 20 }}
                animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <span className="text-white/40">{row.t}</span>
                <span className={row.act === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{row.act}</span>
                <span className="flex-1 text-right text-white/80">{row.amt}</span>
                <span className="text-white">@{row.px}</span>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
