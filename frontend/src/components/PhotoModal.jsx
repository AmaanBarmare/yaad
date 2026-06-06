import { useEffect, useRef, useState } from 'react'
import { detectItems, confirmTransaction } from '../api/client.js'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const CATEGORY_DAYS = {
  dairy: 7, bakery: 5, staples: 30, snacks: 14,
  beverages: 14, personal_care: 30, household: 45,
}

export default function PhotoModal({ open, onClose, onConfirmed, customers, defaultCustomerId }) {
  const [preview, setPreview] = useState(null)
  const [base64, setBase64] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | analysing | detected | confirming | done
  const [items, setItems] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState(200)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (open) {
      setPreview(null); setBase64(null); setPhase('idle'); setItems([])
      setError(null); setAmount(200)
      setCustomerId(defaultCustomerId || customers?.[0]?.id || '')
    }
  }, [open, defaultCustomerId, customers])

  if (!open) return null

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setPreview(URL.createObjectURL(file))
    const b64 = await fileToBase64(file)
    setBase64(b64)
    runDetect(b64)
  }

  const runDetect = async (b64) => {
    setPhase('analysing')
    setItems([])
    try {
      const res = await detectItems(b64)
      setItems(res.items || [])
      setPhase('detected')
      if (!res.items?.length) setError('No items detected — try a clearer photo of the products.')
    } catch (e) {
      setPhase('idle')
      setError(e?.response?.data?.detail || 'Item detection failed. Is the backend running?')
    }
  }

  const updateItem = (i, patch) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const handleConfirm = async () => {
    if (!customerId) { setError('Pick a customer to log this sale against.'); return }
    if (!items.length) { setError('Nothing to confirm.'); return }
    setPhase('confirming')
    setError(null)
    try {
      await confirmTransaction({
        customer_id: customerId,
        amount: Number(amount) || 0,
        items: items.map((it) => ({
          name: it.name,
          quantity: Number(it.quantity) || 1,
          category: it.category || null,
          reorder_days: Number(it.reorder_days) || CATEGORY_DAYS[it.category] || 7,
        })),
      })
      setPhase('done')
      onConfirmed?.(customerId)
      setTimeout(() => onClose?.(), 900)
    } catch (e) {
      setPhase('detected')
      setError(e?.response?.data?.detail || 'Failed to save transaction.')
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Log the sale</h2>
            <p className="modal-sub">Snap the products on the counter — AI reads the items.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Upload / preview */}
          {!preview ? (
            <label
              className={`dropzone ${dragOver ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="6" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M8 6l1.5-2h5L16 6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
              <p className="dz-title">Drop a photo or tap to capture</p>
              <p className="dz-sub">Parle-G, oil bottles, Maggi, soap — anything on the counter</p>
            </label>
          ) : (
            <div className="preview-row">
              <img src={preview} alt="Products" className="preview-img" />
              <div className="preview-state">
                {phase === 'analysing' && (
                  <div className="analysing"><span className="spinner" /> Analysing items…</div>
                )}
                {phase === 'detected' && (
                  <div className="detected-ok">✓ Detected {items.length} item{items.length !== 1 ? 's' : ''}</div>
                )}
                <button className="link-btn" onClick={() => { setPreview(null); setBase64(null); setItems([]); setPhase('idle') }}>
                  Change photo
                </button>
              </div>
            </div>
          )}

          {error && <div className="modal-error">{error}</div>}

          {/* Detected items */}
          {phase !== 'idle' && phase !== 'analysing' && items.length > 0 && (
            <div className="items-review">
              {items.map((it, i) => (
                <div className="review-row" key={i}>
                  <input
                    className="ri-name"
                    value={it.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                  />
                  <span className="ri-cat">{it.category || '—'}</span>
                  <input
                    className="ri-qty tnum"
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                  />
                  <span className="ri-days tnum">{it.reorder_days}d</span>
                  <button className="icon-btn sm" onClick={() => removeItem(i)} aria-label="Remove item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: customer + confirm */}
        {phase !== 'idle' && phase !== 'analysing' && items.length > 0 && (
          <div className="modal-foot">
            <div className="foot-fields">
              <label className="field">
                <span>Customer</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="" disabled>Select customer</option>
                  {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Amount ₹</span>
                <input className="tnum" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            </div>
            <button className="pay-btn" onClick={handleConfirm} disabled={phase === 'confirming' || phase === 'done'}>
              {phase === 'confirming' ? <><span className="spinner" /> Saving…</> : phase === 'done' ? '✓ Logged' : 'Confirm & log sale'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
