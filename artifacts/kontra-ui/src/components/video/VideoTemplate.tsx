import { useState, useRef, useCallback } from 'react';
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

const TOTAL_DURATION_MS = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);

type RecordState = 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error';

function VideoPlayer({ onRecordingComplete }: { onRecordingComplete?: () => void }) {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <>
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
    </>
  );
}

export default function VideoTemplate() {
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [progress, setProgress] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const supportsCapture = typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getDisplayMedia' in navigator.mediaDevices;

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    setRecordState('requesting');

    let stream: MediaStream;
    try {
      stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30, displaySurface: 'browser' },
        audio: false,
      });
    } catch {
      setRecordState('error');
      setErrorMsg('Screen capture was cancelled or denied. Please try again and select "This Tab".');
      return;
    }

    // Pick best supported codec
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecordState('processing');
      setProgress(0);

      const webmBlob = new Blob(chunksRef.current, { type: mimeType });
      const formData = new FormData();
      formData.append('video', webmBlob, 'recording.webm');

      try {
        const resp = await fetch('/api/convert-video', {
          method: 'POST',
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Conversion failed' }));
          throw new Error(err.error ?? 'Conversion failed');
        }

        const mp4Blob = await resp.blob();
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kontra-pitch.mp4';
        a.click();
        URL.revokeObjectURL(url);
        setRecordState('done');
      } catch (err: any) {
        setErrorMsg(err.message ?? 'Conversion failed');
        setRecordState('error');
      }
    };

    // Hook into window so useVideoPlayer can call them
    (window as any).startRecording = () => {
      if (recorder.state === 'inactive') recorder.start(1000);
    };
    (window as any).stopRecording = stopRecording;

    // Reset video from scene 1 and start recording
    setVideoKey((k) => k + 1);
    setRecordState('recording');
    setProgress(0);

    // Start recorder immediately (video will restart from scene 1)
    setTimeout(() => {
      if (recorder.state === 'inactive') recorder.start(1000);
    }, 300);

    // Progress bar over total duration
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / TOTAL_DURATION_MS) * 100, 99);
      setProgress(pct);
      if (elapsed >= TOTAL_DURATION_MS + 500) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        stopRecording();
      }
    }, 250);
  }, [stopRecording]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0d0d0d] text-white">
      <VideoPlayer key={videoKey} />

      {/* Download MP4 button — always visible when idle */}
      {recordState === 'idle' && (
        <motion.div
          className="absolute bottom-6 right-6 z-50"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          {supportsCapture ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono tracking-wide border border-white/20 bg-black/60 text-white/80 hover:bg-[#800020]/80 hover:border-[#800020] hover:text-white transition-all duration-300 backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download MP4
            </button>
          ) : (
            <div className="px-4 py-2 rounded-full text-xs font-mono border border-white/10 bg-black/60 text-white/40 backdrop-blur-sm">
              Open in a new browser tab to download MP4
            </div>
          )}
        </motion.div>
      )}

      {/* Recording overlay */}
      <AnimatePresence>
        {recordState === 'requesting' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center space-y-4 max-w-sm px-6">
              <div className="w-10 h-10 border-2 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white/80 text-sm font-mono tracking-wide">
                Select <span className="text-white font-bold">"This Tab"</span> in the screen share dialog
              </p>
              <p className="text-white/40 text-xs">The video will restart automatically and record all 8 scenes</p>
            </div>
          </motion.div>
        )}

        {recordState === 'recording' && (
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/70 border border-red-500/50 backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-mono tracking-widest">RECORDING</span>
              <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#800020] rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-white/50 text-xs font-mono">{Math.round(progress)}%</span>
            </div>
          </motion.div>
        )}

        {recordState === 'processing' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center space-y-4">
              <div className="w-10 h-10 border-2 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white font-mono tracking-wide text-sm">Converting to MP4&hellip;</p>
              <p className="text-white/40 text-xs">This takes about 30–60 seconds</p>
            </div>
          </motion.div>
        )}

        {recordState === 'done' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center space-y-5 max-w-xs">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-mono tracking-wide">kontra-pitch.mp4 downloaded</p>
              <button
                onClick={() => { setRecordState('idle'); setProgress(0); }}
                className="px-4 py-2 text-xs font-mono border border-white/20 rounded-full text-white/60 hover:text-white hover:border-white/40 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}

        {recordState === 'error' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center space-y-5 max-w-sm px-6">
              <p className="text-red-400 font-mono text-sm">{errorMsg}</p>
              <button
                onClick={() => { setRecordState('idle'); setErrorMsg(''); }}
                className="px-4 py-2 text-xs font-mono border border-white/20 rounded-full text-white/60 hover:text-white transition-all"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
