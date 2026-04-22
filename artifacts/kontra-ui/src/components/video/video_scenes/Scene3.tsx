import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const PORTALS = [
  { name: 'Lender', color: '#800020', delay: 0 },
  { name: 'Servicer', color: '#D97706', delay: 0.1 },
  { name: 'Investor', color: '#7C3AED', delay: 0.2 },
  { name: 'Borrower', color: '#059669', delay: 0.3 }
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800), // Pills appear
      setTimeout(() => setPhase(2), 2200), // Morph
      setTimeout(() => setPhase(3), 3200), // UI details
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute top-[15%] text-center">
        <motion.h2 
          className="text-[3vw] font-display"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Kontra unifies every stakeholder
        </motion.h2>
        <motion.p 
          className="text-xl text-[#b83550] tracking-widest uppercase font-mono mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          On a single platform
        </motion.p>
      </div>

      {/* The Morphing UI */}
      <div className="relative w-[70vw] h-[50vh] mt-[10vh]">
        {/* Phase 1: Separate Pills */}
        <div className="absolute inset-0 flex items-center justify-center gap-6">
          {PORTALS.map((portal, i) => (
            <motion.div
              key={portal.name}
              className="px-8 py-4 rounded-full font-body font-bold text-xl border border-white/20 backdrop-blur-md"
              style={{ backgroundColor: `${portal.color}40` }}
              initial={{ opacity: 0, scale: 0, y: 50 }}
              animate={
                phase >= 2 
                  ? { opacity: 0, scale: 0.5, y: 0 } // Morph away
                  : phase >= 1 
                    ? { opacity: 1, scale: 1, y: 0 } // Visible
                    : { opacity: 0, scale: 0, y: 50 } // Hidden
              }
              transition={{ 
                type: 'spring', stiffness: 300, damping: 25, 
                delay: phase >= 2 ? 0 : portal.delay 
              }}
            >
              {portal.name}
            </motion.div>
          ))}
        </div>

        {/* Phase 2: Unified UI */}
        <motion.div
          className="absolute inset-0 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl shadow-[#800020]/20"
          initial={{ opacity: 0, scale: 0.8, borderRadius: '100px' }}
          animate={
            phase >= 2 
              ? { opacity: 1, scale: 1, borderRadius: '16px' } 
              : { opacity: 0, scale: 0.8, borderRadius: '100px' }
          }
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* UI Header */}
          <div className="h-12 border-b border-white/10 flex items-center px-6 gap-4">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="ml-4 flex gap-4">
              {PORTALS.map((p, i) => (
                <motion.div 
                  key={p.name} 
                  className="w-16 h-2 rounded-full" 
                  style={{ backgroundColor: p.color }}
                  initial={{ scaleX: 0 }}
                  animate={phase >= 3 ? { scaleX: 1 } : { scaleX: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                />
              ))}
            </div>
          </div>
          
          {/* UI Body */}
          <div className="flex-1 p-8 grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              {[...Array(3)].map((_, i) => (
                <motion.div 
                  key={i} 
                  className="h-16 bg-white/5 rounded-lg border border-white/5"
                  initial={{ opacity: 0, x: -20 }}
                  animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, delay: 0.2 + (i * 0.1) }}
                />
              ))}
            </div>
            <div className="col-span-1 border border-white/5 bg-white/5 rounded-lg relative overflow-hidden">
               {/* Abstract chart */}
               <motion.svg viewBox="0 0 100 100" className="absolute bottom-0 w-full h-1/2 opacity-50" preserveAspectRatio="none">
                  <motion.path 
                    d="M0,100 L0,50 Q25,20 50,60 T100,30 L100,100 Z" 
                    fill="#800020"
                    initial={{ y: 100 }}
                    animate={phase >= 3 ? { y: 0 } : { y: 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
               </motion.svg>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
