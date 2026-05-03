import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene7() {
  const [phase, setPhase] = useState(0);
  const [textIndex, setTextIndex] = useState(0);

  const question = "What is the DSCR trend on LN-2847?";
  const answer = "The DSCR for LN-2847 has trended down from 1.45x to 1.38x over the last 3 quarters due to increased operating expenses. The covenant requirement is 1.25x. Action: Recommend adding to watchlist.";

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),  // question
      setTimeout(() => setPhase(2), 2000), // answering
      setTimeout(() => setPhase(3), 6000), // cards
      setTimeout(() => setPhase(4), 8500), // exit
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  useEffect(() => {
    if (phase === 2) {
      const words = answer.split(" ");
      let i = 0;
      const interval = setInterval(() => {
        setTextIndex(i);
        i++;
        if (i > words.length) clearInterval(interval);
      }, 80);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const agents = ["Portfolio Analyst", "Compliance Agent", "Market Intelligence"];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
    >
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.2) 0%, transparent 60%)",
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="w-full max-w-4xl flex flex-col relative z-10 px-8">
        <motion.div 
          className="text-[#7C5CFF] font-mono tracking-widest uppercase font-bold mb-12 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 4 ? { opacity: 0 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          AI Copilot
        </motion.div>

        {/* Chat Interface */}
        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto mb-16 h-48">
          {phase >= 1 && (
            <motion.div 
              className="self-end bg-white/10 text-white rounded-xl rounded-tr-sm px-5 py-3 max-w-[80%]"
              initial={{ opacity: 0, scale: 0.9, transformOrigin: "bottom right" }}
              animate={phase >= 4 ? { opacity: 0 } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: "spring" }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              >
                {question}
              </motion.span>
            </motion.div>
          )}

          {phase >= 2 && (
            <motion.div 
              className="self-start bg-[#7C5CFF]/20 border border-[#7C5CFF]/40 text-white rounded-xl rounded-tl-sm px-5 py-4 max-w-[90%]"
              initial={{ opacity: 0, y: 10 }}
              animate={phase >= 4 ? { opacity: 0 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {answer.split(" ").slice(0, textIndex).join(" ")}
              {textIndex < answer.split(" ").length && (
                <motion.span 
                  className="inline-block w-2 h-4 bg-[#7C5CFF] ml-1 align-middle"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </motion.div>
          )}
        </div>

        {/* Agent Cards */}
        <div className="flex justify-center gap-6">
          {agents.map((agent, i) => (
            <motion.div
              key={agent}
              className="px-6 py-3 rounded-lg border border-[#7C5CFF]/30 bg-[#7C5CFF]/5 text-white/80 font-mono text-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 4 ? { opacity: 0 } : phase >= 3 ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#7C5CFF] shadow-[0_0_8px_#7C5CFF]" />
                {agent}
              </div>
            </motion.div>
          ))}
        </div>

      </div>

      <motion.div 
        className="absolute bottom-12 px-8 py-3 bg-[var(--gold)]/10 backdrop-blur border border-[var(--gold)]/30 rounded-full text-[var(--gold)] tracking-widest font-mono text-sm shadow-[0_0_30px_rgba(201,168,76,0.15)] z-20"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 4 ? { opacity: 0, y: 20 } : phase >= 1 ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: phase >= 4 ? 0 : 0.6, duration: 0.6 }}
      >
        NATURAL LANGUAGE INTELLIGENCE ACROSS EVERY PORTAL
      </motion.div>
    </motion.div>
  );
}
