import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "@/lib/video";
import { useEffect } from "react";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";
import { Scene6 } from "./video_scenes/Scene6";
import { Scene7 } from "./video_scenes/Scene7";
import { Scene8 } from "./video_scenes/Scene8";
import { Scene9 } from "./video_scenes/Scene9";
import { Scene10 } from "./video_scenes/Scene10";

export const SCENE_DURATIONS: Record<string, number> = {
  scene1: 6000,
  scene2: 7000,
  scene3: 9000,
  scene4: 11000,
  scene5: 9000,
  scene6: 11000,
  scene7: 9000,
  scene8: 9000,
  scene9: 8000,
  scene10: 7000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  scene1: Scene1,
  scene2: Scene2,
  scene3: Scene3,
  scene4: Scene4,
  scene5: Scene5,
  scene6: Scene6,
  scene7: Scene7,
  scene8: Scene8,
  scene9: Scene9,
  scene10: Scene10,
};

function GridBackground() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
      animate={{
        backgroundPosition: ["0px 0px", "60px 60px"],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, "");
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{
        background: "var(--bg)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <GridBackground />

      <motion.div
        className="absolute bottom-0 left-0 h-[1px]"
        style={{ background: "var(--gold)", width: "100%" }}
        animate={{ opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <AnimatePresence initial={false} mode="wait">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
