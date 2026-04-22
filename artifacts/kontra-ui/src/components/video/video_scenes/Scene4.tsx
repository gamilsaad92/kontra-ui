import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const KPIS = [
  { label: 'LTV', value: '62.4%', color: '#800020' },
  { label: 'DSCR', value: '1.45x', color: '#b83550' },
  { label: 'NOI', value: '$2.4M', color: '#ff4d4d' }
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, y: '10vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-10vh' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-7xl mx-auto grid grid-cols-2 gap-16 px-12">
        <div className="flex flex-col justify-center">
          <motion.div 
            className="px-4 py-1.5 rounded-full border border-[#800020] text-[#800020] text-sm font-mono tracking-wider self-start mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            LENDER PORTAL
          </motion.div>
          <h2 className="text-[3.5vw] font-display leading-[1.1] mb-6">
            AI-powered underwriting.
          </h2>
          <motion.div className="space-y-3" initial="hidden" animate={phase >= 1 ? "visible" : "hidden"} variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}>
            {["Instant risk scoring.", "Automated document extraction.", "Zero blind spots."].map((text, i) => (
              <motion.p 
                key={i}
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
                className="text-xl text-white/70 font-body flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-[#800020]" />
                {text}
              </motion.p>
            ))}
          </motion.div>
        </div>

        <div className="relative flex flex-col justify-center gap-6">
          {KPIS.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              className="bg-black/40 border border-white/10 rounded-xl p-6 backdrop-blur-md flex justify-between items-center relative overflow-hidden"
              initial={{ opacity: 0, x: 50 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
              transition={{ type: 'spring', stiffness: 100, damping: 20, delay: i * 0.1 }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: kpi.color }} />
              <span className="text-white/50 font-mono tracking-widest">{kpi.label}</span>
              <div className="flex flex-col items-end">
                <span className="text-4xl font-display text-white">{kpi.value}</span>
                {/* Simulated live tick */}
                <motion.div 
                  className="w-16 h-1 mt-2 rounded-full"
                  style={{ backgroundColor: kpi.color }}
                  animate={{ scaleX: [1, 1.2, 0.8, 1.1, 1] }}
                  transition={{ duration: 2 + i, repeat: Infinity }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
