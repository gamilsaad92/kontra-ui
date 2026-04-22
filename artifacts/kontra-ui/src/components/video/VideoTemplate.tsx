import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';

const SCENE_DURATIONS = {
  s1: 3000,
  s2: 4000,
  s3: 5000,
  s4: 4000,
  s5: 4000,
  s6: 4000,
  s7: 4000,
  s8: 4000
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0d0d0d] text-white">
      {/* Persistent Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            scale: [1, 1.05, 1],
            opacity: currentScene >= 6 ? 0 : 0.3,
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/grid-texture.png`} 
            className="w-full h-full object-cover" 
            alt="" 
          />
        </motion.div>
        
        <motion.div
          className="absolute inset-0 mix-blend-screen opacity-20"
          animate={{ opacity: currentScene === 1 ? 0.4 : 0.2 }}
          transition={{ duration: 1 }}
        >
          <video 
            src={`${import.meta.env.BASE_URL}videos/bg-network.mp4`} 
            autoPlay loop muted playsInline 
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Ambient gradients */}
        <motion.div 
          className="absolute w-[800px] h-[800px] rounded-full blur-[100px] opacity-20"
          style={{ background: 'radial-gradient(circle, #800020, transparent)' }}
          animate={{
            x: ['-20%', '80%', '10%'],
            y: ['10%', '60%', '-10%'],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Dynamic persistent line */}
        <motion.div
          className="absolute h-[2px] bg-gradient-to-r from-transparent via-[#800020] to-transparent"
          animate={{
            left: ['-50%', '0%', '20%', '0%', '10%', '-10%', '10%', '-50%'][currentScene] || '0%',
            width: ['200%', '100%', '60%', '100%', '80%', '120%', '80%', '200%'][currentScene] || '100%',
            top: ['50%', '80%', '20%', '15%', '85%', '30%', '70%', '50%'][currentScene] || '50%',
            opacity: currentScene === 0 || currentScene === 7 ? 0 : 0.5,
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="s1" />}
        {currentScene === 1 && <Scene2 key="s2" />}
        {currentScene === 2 && <Scene3 key="s3" />}
        {currentScene === 3 && <Scene4 key="s4" />}
        {currentScene === 4 && <Scene5 key="s5" />}
        {currentScene === 5 && <Scene6 key="s6" />}
        {currentScene === 6 && <Scene7 key="s7" />}
        {currentScene === 7 && <Scene8 key="s8" />}
      </AnimatePresence>
    </div>
  );
}
