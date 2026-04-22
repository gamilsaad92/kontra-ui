import { useState, useEffect } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const sceneKeys = Object.keys(durations);

  useEffect(() => {
    // Start recording if available
    if (typeof window !== 'undefined' && (window as any).startRecording) {
      (window as any).startRecording();
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const playScene = (index: number) => {
      if (!isMounted) return;
      setCurrentSceneIndex(index);

      const sceneKey = sceneKeys[index];
      const duration = durations[sceneKey];

      timeoutId = setTimeout(() => {
        if (index === sceneKeys.length - 1) {
          // Stop recording after full pass if available
          if (typeof window !== 'undefined' && (window as any).stopRecording) {
            (window as any).stopRecording();
          }
          // Loop back to start
          playScene(0);
        } else {
          playScene(index + 1);
        }
      }, duration);
    };

    playScene(0);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [JSON.stringify(durations)]); // Stringify to avoid infinite loops if object reference changes

  return { currentScene: currentSceneIndex };
}
