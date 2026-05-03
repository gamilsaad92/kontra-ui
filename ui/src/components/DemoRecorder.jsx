import React, { useState, useRef, useCallback } from 'react'

const STATES = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  RECORDING: 'recording',
  PROCESSING: 'processing',
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function DemoRecorder() {
  const [state, setState] = useState(STATES.IDLE)
  const [elapsed, setElapsed] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  const startRecording = useCallback(async () => {
    setError(null)
    setDownloadUrl(null)
    setState(STATES.REQUESTING)

    try {
      const displayMediaOptions = {
        video: { frameRate: { ideal: 30 }, displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
      streamRef.current = stream

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording(false)
      })

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm'

      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        setState(STATES.PROCESSING)
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setDownloadUrl(url)
        setState(STATES.IDLE)
        clearInterval(timerRef.current)
        streamRef.current?.getTracks().forEach((t) => t.stop())
      }

      recorder.start(500)
      setState(STATES.RECORDING)
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= 179) {
            stopRecording(true)
            return 179
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      setState(STATES.IDLE)
      if (err.name !== 'NotAllowedError') {
        setError('Recording unavailable in this browser.')
      }
    }
  }, [])

  const stopRecording = useCallback((fromTimer = false) => {
    clearInterval(timerRef.current)
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (!fromTimer) setState(STATES.IDLE)
  }, [])

  const triggerDownload = useCallback(() => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `kontra-demo-${new Date().toISOString().slice(0, 10)}.webm`
    a.click()
  }, [downloadUrl])

  if (!navigator.mediaDevices?.getDisplayMedia) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {error && (
        <div className="rounded-lg bg-red-900/80 px-3 py-2 text-xs text-red-200 border border-red-700 max-w-[220px] text-center">
          {error}
        </div>
      )}

      {downloadUrl && (
        <button
          onClick={triggerDownload}
          className="flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all active:scale-95"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12l-5-5h3V2h4v5h3l-5 5z" />
            <path d="M2 14h12v1.5H2z" />
          </svg>
          Download Recording
        </button>
      )}

      {state === STATES.RECORDING ? (
        <button
          onClick={() => stopRecording(false)}
          className="flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all active:scale-95"
        >
          <span className="h-2 w-2 rounded-sm bg-white" />
          Stop — {formatTime(elapsed)}
        </button>
      ) : state === STATES.REQUESTING ? (
        <button
          disabled
          className="flex items-center gap-2 rounded-full bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 shadow-lg cursor-not-allowed"
        >
          <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
          Waiting…
        </button>
      ) : state === STATES.PROCESSING ? (
        <button
          disabled
          className="flex items-center gap-2 rounded-full bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 shadow-lg cursor-not-allowed"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Processing…
        </button>
      ) : (
        <button
          onClick={startRecording}
          title="Record a screen capture of this demo and download it as a video"
          className="flex items-center gap-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg transition-all active:scale-95"
        >
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Record Demo
        </button>
      )}
    </div>
  )
}
