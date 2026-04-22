import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
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
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-20 flex flex-col items-center">
        {/* Logo Slam */}
        <div className="relative flex items-center justify-center mb-8">
          <motion.div
            className="absolute w-64 h-64 bg-[#800020] rounded-full blur-[80px] opacity-40"
            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3, ease: 'easeInOut' }}
          />
          <motion.h1 
            className="text-[8vw] font-black text-white tracking-tighter uppercase relative z-10"
            initial={{ scale: 3, opacity: 0, filter: 'blur(20px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            KONTRA
          </motion.h1>
        </div>

        {/* Subtitle */}
        <div className="overflow-hidden">
          <motion.p 
            className="text-[2vw] text-white/80 font-body uppercase tracking-widest text-center max-w-[60vw]"
            initial={{ y: "100%" }}
            animate={phase >= 1 ? { y: 0 } : { y: "100%" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            The infrastructure CRE lending has been waiting for
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
