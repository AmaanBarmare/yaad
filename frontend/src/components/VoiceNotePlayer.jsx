import { useEffect, useRef, useState } from 'react'

function PlayIcon({ playing }) {
  return playing ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5Z" />
    </svg>
  )
}

// Static waveform bars (animate only while playing).
const BARS = [8, 14, 20, 12, 24, 16, 10, 22, 14, 8, 18, 12, 24, 10, 16, 20, 12, 8]

export default function VoiceNotePlayer({ messageText, audioBase64, audioUrl, customerName }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  const src = audioBase64
    ? `data:audio/wav;base64,${audioBase64}`
    : audioUrl || ''

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onEnd = () => setPlaying(false)
    a.addEventListener('ended', onEnd)
    return () => a.removeEventListener('ended', onEnd)
  }, [])

  // Auto-play once the audio arrives (triggered by the user's Generate click).
  useEffect(() => {
    if (src && audioRef.current) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {})
    }
  }, [src])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  return (
    <div className="wa-bubble">
      <div className="wa-meta">
        <span className="wa-from">{customerName ? `To ${customerName}` : 'Reminder'}</span>
        <span className="wa-tag">Hindi voice note</span>
      </div>

      <p className="wa-text">{messageText}</p>

      <div className="wa-player">
        <button
          className="wa-play"
          onClick={toggle}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          disabled={!src}
        >
          <PlayIcon playing={playing} />
        </button>
        <div className={`wa-wave ${playing ? 'is-playing' : ''}`} aria-hidden="true">
          {BARS.map((h, i) => (
            <span key={i} style={{ height: `${h}px`, animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="auto" />
    </div>
  )
}
