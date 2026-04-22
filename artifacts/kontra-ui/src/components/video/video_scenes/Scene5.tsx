import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-7xl mx-auto px-12 text-center flex flex-col items-center">
        <motion.div 
          className="px-4 py-1.5 rounded-full border border-[#D97706] text-[#D97706] text-sm font-mono tracking-wider mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          SERVICER PORTAL
        </motion.div>
        
        <h2 className="text-[4vw] font-display leading-[1.1] mb-12">
          Real-time servicing. <br/>
          <span className="text-white/40">Draw management.</span>
        </h2>

        {/* Draw Flow Animation */}
        <div className="flex items-center justify-center gap-4 w-full max-w-4xl relative">
          
          {/* Background connecting line */}
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/10 -translate-y-1/2 -z-10" />
          
          <motion.div 
            className="absolute top-1/2 left-0 h-[2px] bg-[#D97706] -translate-y-1/2 -z-10 origin-left"
            initial={{ scaleX: 0 }}
            animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 2, ease: "linear" }}
          />

          {[
            { step: 'Request', icon: '📝' },
            { step: 'Inspection', icon: '🏗️' },
            { step: 'Approval', icon: '✅' },
            { step: 'Disbursement', icon: '💸' }
          ].map((item, i) => (
            <motion.div
              key={item.step}
              className="flex flex-col items-center gap-4 flex-1"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: i * 0.5 + 0.5 }} // Cascade effect aligned with line drawing
            >
              <div className="w-16 h-16 rounded-full bg-black border-2 border-[#D97706] flex items-center justify-center text-2xl relative z-10 shadow-[0_0_20px_rgba(217,119,6,0.3)]">
                {item.icon}
                <motion.div 
                  className="absolute inset-0 rounded-full border border-[#D97706]"
                  animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                />
              </div>
              <span className="font-mono text-sm tracking-wider text-white/80">{item.step}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
