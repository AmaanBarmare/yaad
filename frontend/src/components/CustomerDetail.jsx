import { useEffect, useState } from 'react'
import { getCustomer } from '../api/client.js'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dueState(iso) {
  if (!iso) return { label: '—', cls: 'muted' }
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (days <= 0) return { label: `overdue ${Math.abs(days)}d`, cls: 'due-over' }
  if (days <= 2) return { label: `due in ${days}d`, cls: 'due-soon' }
  return { label: `${days}d left`, cls: 'due-ok' }
}

export default function CustomerDetail({ customerId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!customerId) return
    setLoading(true); setError(null); setData(null)
    getCustomer(customerId)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.detail || 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [customerId])

  if (!customerId) return null

  return (
    <div className="drawer-scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2>{data?.name || 'Customer'}</h2>
            {data?.phone && <p className="modal-sub tnum">{data.phone}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="drawer-body">
          {loading && <div className="state"><span className="spinner" /> Loading history…</div>}
          {error && <div className="modal-error">{error}</div>}

          {data && !loading && (
            <>
              <h3 className="drawer-section">Purchase history</h3>
              {data.history?.length ? (
                data.history.map((txn) => (
                  <div className="hist-txn" key={txn.transaction_id}>
                    <div className="hist-meta">
                      <span className="hist-date tnum">{fmtDate(txn.purchased_at)}</span>
                      {txn.amount != null && <span className="hist-amt tnum">₹{Number(txn.amount).toFixed(0)}</span>}
                    </div>
                    <div className="hist-items">
                      {txn.items.map((it) => {
                        const d = dueState(it.reorder_due_at)
                        return (
                          <div className="hist-item" key={it.id}>
                            <span className="hi-name">{it.name} <span className="muted tnum">×{it.quantity}</span></span>
                            <span className={`due-pill ${d.cls}`}>{d.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">No purchases yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
