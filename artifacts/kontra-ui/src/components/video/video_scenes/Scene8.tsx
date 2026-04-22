import { motion } from 'framer-motion';

export function Scene8() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#800020]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          className="w-16 h-16 bg-white mb-8"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.5 }}
          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} // diamond shape logo
        />
        
        <motion.h1 
          className="text-[6vw] font-black text-white tracking-tighter uppercase mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          KONTRA
        </motion.h1>

        <motion.p 
          className="text-2xl text-white/90 font-display italic mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          Command your entire portfolio.
        </motion.p>

        <motion.div 
          className="px-6 py-2 border border-white/30 rounded-full text-white font-mono tracking-widest"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.6 }}
        >
          KONTRAUI.COM
        </motion.div>
      </div>
      
      {/* Ambient closing glow */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-tr from-black/80 to-transparent pointer-events-none"
        animate={{ opacity: [0, 0.5] }}
        transition={{ duration: 3 }}
      />
    </motion.div>
  );
}
