import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 1600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#0d0d0d]"
      initial={{ clipPath: 'circle(0% at center)' }}
      animate={{ clipPath: 'circle(150% at center)' }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}images/cre-building.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
        alt=""
        animate={{ scale: [1.1, 1], y: [0, -20] }}
        transition={{ duration: 4, ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/80 to-transparent" />

      <div className="relative z-10 text-center w-full max-w-5xl px-12">
        <h2 className="text-[4vw] font-display mb-16 leading-tight">
          Built for the <span className="text-[#800020]">$4.5T</span><br/>
          CRE debt market.
        </h2>

        <div className="grid grid-cols-4 gap-8">
          {[
            { val: '6', label: 'Active Loans' },
            { val: '4', label: 'Role Portals' },
            { val: 'AI', label: 'Underwriting' },
            { val: 'ENT', label: 'Grade Security' }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="flex flex-col items-center border-t border-white/20 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="text-4xl font-display font-bold text-white mb-2">{stat.val}</div>
              <div className="text-sm font-mono tracking-widest text-white/50 uppercase">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
