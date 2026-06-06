import { useEffect, useRef, useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import PhotoModal from './components/PhotoModal.jsx'
import CustomerDetail from './components/CustomerDetail.jsx'
import { simulatePayment, getCustomers } from './api/client.js'
import './App.css'

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8Z" fill="currentColor" />
    </svg>
  )
}

function LeafMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12c0-4 3-7.5 7-8 4 .5 7 4 7 8 0 4-3 7.5-7 8-4-.5-7-4-7-8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 5v14M8.5 9.5 12 12M15.5 9.5 12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  const [paying, setPaying] = useState(false)
  const [toast, setToast] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [customers, setCustomers] = useState([])
  const audioRef = useRef(null)

  // Customers for the photo-modal selector + detail drawer.
  useEffect(() => {
    getCustomers().then(setCustomers).catch(() => {})
  }, [refreshKey])

  const handleSimulate = async () => {
    setPaying(true)
    try {
      const res = await simulatePayment()
      // Play the Bulbul-generated soundbox clip ("Do sau rupaye prapt hue").
      if (res.audio_base64 && audioRef.current) {
        audioRef.current.src = `data:audio/wav;base64,${res.audio_base64}`
        audioRef.current.play().catch(() => {})
      }
      setToast({ title: `₹${res.amount?.toFixed?.(0) ?? '200'} received`, sub: 'Tap to log the items sold' })
      setTimeout(() => setPhotoOpen(true), 700) // let the soundbox play, then open camera
    } catch (e) {
      setToast({ title: 'Payment simulation failed', sub: 'Is the backend running?' })
    } finally {
      setPaying(false)
      setTimeout(() => setToast(null), 4000)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><LeafMark /></span>
          <div>
            <div className="brand-name">Yaad</div>
            <div className="brand-sub">Reorder engine for your dukaan</div>
          </div>
        </div>

        <button className="pay-btn" onClick={handleSimulate} disabled={paying} aria-label="Simulate a 200 rupee payment">
          <BoltIcon />
          {paying ? 'Simulating…' : 'Simulate Payment ₹200'}
        </button>
      </header>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="brand-mark" style={{ width: 34, height: 34 }}><BoltIcon /></span>
          <div>
            <div className="toast-title">{toast.title}</div>
            <div className="toast-sub">{toast.sub}</div>
          </div>
        </div>
      )}

      <main className="main">
        <Dashboard refreshKey={refreshKey} onOpenCustomer={setDetailId} />
      </main>

      <PhotoModal
        open={photoOpen}
        customers={customers}
        onClose={() => setPhotoOpen(false)}
        onConfirmed={() => {
          setRefreshKey((k) => k + 1)
          setToast({ title: 'Sale logged', sub: 'Items saved — reorder dates set' })
          setTimeout(() => setToast(null), 4000)
        }}
      />

      <CustomerDetail customerId={detailId} onClose={() => setDetailId(null)} />

      {/* hidden audio element for the soundbox clip */}
      <audio ref={audioRef} hidden />
    </div>
  )
}
