import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, x: '10vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-10vw' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-7xl mx-auto grid grid-cols-2 gap-16 px-12">
        <div className="flex flex-col justify-center">
          <motion.div 
            className="w-12 h-1 bg-[#b83550] mb-8 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
          <h2 className="text-[4vw] font-display leading-[1.1] mb-6">
            <span className="block overflow-hidden">
              <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}>CRE lending</motion.span>
            </span>
            <span className="block overflow-hidden text-white/50">
              <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}>is still stuck in</motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}>the past.</motion.span>
            </span>
          </h2>
          <motion.p 
            className="text-xl text-white/60 font-body max-w-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            Fragmented data. Spreadsheets. Email chains. Slow closings.
          </motion.p>
        </div>

        <div className="relative flex items-center justify-center">
          {/* Chaos visual representation */}
          <div className="relative w-full aspect-square border border-white/10 rounded-2xl overflow-hidden bg-black/40 backdrop-blur-md">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute bg-white/5 border border-white/10 rounded p-4 text-xs font-mono text-white/40"
                style={{
                  top: `${Math.random() * 80}%`,
                  left: `${Math.random() * 60}%`,
                  width: '200px',
                  zIndex: i
                }}
                initial={{ opacity: 0, y: 20, rotate: -10 + Math.random() * 20 }}
                animate={phase >= 1 ? { 
                  opacity: [0, 1, 0.5], 
                  y: [20, 0, -20],
                  rotate: [-10 + Math.random() * 20, 0 + Math.random() * 5, 10 + Math.random() * 20]
                } : { opacity: 0 }}
                transition={{ 
                  duration: 4, 
                  delay: i * 0.2, 
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                ERR_SYNC_FAILED<br/>
                Wait for wire...<br/>
                v12_FINAL_final.xlsx
              </motion.div>
            ))}
            
            <motion.div 
              className="absolute inset-0 bg-[#800020]/20 mix-blend-overlay"
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
