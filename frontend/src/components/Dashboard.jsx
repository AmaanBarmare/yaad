import { useEffect, useState } from 'react'
import { getCustomers, generateReminder } from '../api/client.js'
import VoiceNotePlayer from './VoiceNotePlayer.jsx'

const RISK_LABEL = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  ok: 'On track',
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function relativeDays(iso) {
  if (!iso) return '—'
  const then = new Date(iso)
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

function RiskBadge({ risk }) {
  const cls = RISK_LABEL[risk] ? risk : 'ok'
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {RISK_LABEL[cls]}
    </span>
  )
}

const RISK_ORDER = { overdue: 0, due_soon: 1, ok: 2 }

const PROGRESS_LABEL = {
  generating_message: 'Generating message…',
  synthesising_audio: 'Synthesising voice…',
}

export default function Dashboard({ refreshKey, onOpenCustomer }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // reminder generation state
  const [progress, setProgress] = useState({}) // { [customerId]: 'generating_message' | 'synthesising_audio' }
  const [reminder, setReminder] = useState(null) // { customerName, messageText, audioBase64, audioUrl }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getCustomers()
      .then((data) => {
        if (!active) return
        const sorted = [...data].sort(
          (a, b) => (RISK_ORDER[a.risk] ?? 3) - (RISK_ORDER[b.risk] ?? 3)
        )
        setCustomers(sorted)
      })
      .catch((e) => {
        if (!active) return
        setError(
          e?.response?.data?.detail ||
            'Could not reach the backend. Start it with `uvicorn main:app --reload`.'
        )
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [refreshKey])

  const handleGenerate = async (cust) => {
    setReminder(null)
    setProgress((p) => ({ ...p, [cust.id]: 'generating_message' }))
    try {
      await generateReminder(cust.id, (event, data) => {
        if (event === 'generating_message' || event === 'synthesising_audio') {
          setProgress((p) => ({ ...p, [cust.id]: event }))
        } else if (event === 'ready') {
          setProgress((p) => ({ ...p, [cust.id]: null }))
          setReminder({
            customerName: cust.name,
            messageText: data.message_text,
            audioBase64: data.audio_base64,
            audioUrl: data.audio_url,
          })
        } else if (event === 'error') {
          setProgress((p) => ({ ...p, [cust.id]: null }))
          setError(`Voice note failed: ${data.detail || 'unknown error'}`)
        }
      })
    } catch (e) {
      setProgress((p) => ({ ...p, [cust.id]: null }))
      setError(`Voice note failed: ${e.message}`)
    }
  }

  const counts = customers.reduce(
    (acc, c) => {
      acc[c.risk] = (acc[c.risk] || 0) + 1
      return acc
    },
    { overdue: 0, due_soon: 0, ok: 0 }
  )

  // Which customer (if any) is currently generating, for the floating panel.
  const genEntry = Object.entries(progress).find(([, v]) => v)
  const genStatus = genEntry ? genEntry[1] : null
  const genName = genEntry ? customers.find((c) => c.id === genEntry[0])?.name : null
  const showPanel = !!reminder || !!genStatus

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Customers at a glance</h1>
        <p className="page-desc">
          Who's due for a reorder reminder, ranked by urgency.
        </p>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="stat-value tnum">{customers.length}</div>
          <div className="stat-label">Total customers</div>
        </div>
        <div className="stat">
          <div className="stat-value danger tnum">{counts.overdue}</div>
          <div className="stat-label">Overdue for reorder</div>
        </div>
        <div className="stat">
          <div className="stat-value warn tnum">{counts.due_soon}</div>
          <div className="stat-label">Due soon</div>
        </div>
        <div className="stat">
          <div className="stat-value ok tnum">{counts.ok}</div>
          <div className="stat-label">On track</div>
        </div>
      </div>

      <div className="card">
          <div className="card-head">
            <h2>Reorder watchlist</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Recent items</th>
                  <th>Last purchase</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="skeleton-row">
                      <td><div style={{ width: '60%' }} /></td>
                      <td><div style={{ width: '80%' }} /></td>
                      <td><div style={{ width: '50%' }} /></td>
                      <td><div style={{ width: '40%' }} /></td>
                      <td><div style={{ width: '60%' }} /></td>
                    </tr>
                  ))}

                {!loading && !error && customers.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="state">
                        <p className="state-title">No customers yet</p>
                        <p>Run <code>python scripts/seed.py</code> to populate demo data.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  customers.map((c) => {
                    const busy = progress[c.id]
                    return (
                      <tr key={c.id}>
                        <td>
                          <button className="cust cust-link" onClick={() => onOpenCustomer?.(c.id)} title="View purchase history">
                            <span className="avatar">{initials(c.name)}</span>
                            <div>
                              <div className="cust-name">{c.name}</div>
                              {c.phone && <div className="cust-phone tnum">{c.phone}</div>}
                            </div>
                          </button>
                        </td>
                        <td>
                          {c.recent_items?.length ? (
                            <div className="items-cell">
                              {c.recent_items.map((item, i) => (
                                <span className="chip" key={i}>{item}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="tnum muted">{relativeDays(c.last_purchase_at)}</td>
                        <td><RiskBadge risk={c.risk} /></td>
                        <td>
                          <button
                            className="gen-btn"
                            onClick={() => handleGenerate(c)}
                            disabled={!!busy}
                          >
                            {busy ? (
                              <>
                                <span className="spinner" />
                                {PROGRESS_LABEL[busy]}
                              </>
                            ) : (
                              <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6 6 4 4M18 18l2 2M6 18l-2 2M18 6l2-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                  <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                                </svg>
                                Generate reminder
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

      {showPanel && (
        <aside className="reminder-panel floating" role="status" aria-live="polite">
          <div className="panel-head">
            <span>Voice reminder</span>
            {reminder && (
              <button className="icon-btn sm" onClick={() => setReminder(null)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          {reminder ? (
            <VoiceNotePlayer
              customerName={reminder.customerName}
              messageText={reminder.messageText}
              audioBase64={reminder.audioBase64}
              audioUrl={reminder.audioUrl}
            />
          ) : (
            <div className="panel-empty">
              <span className="spinner" />
              <p>{PROGRESS_LABEL[genStatus] || 'Working…'}{genName ? ` — ${genName}` : ''}</p>
            </div>
          )}
        </aside>
      )}
    </>
  )
}
