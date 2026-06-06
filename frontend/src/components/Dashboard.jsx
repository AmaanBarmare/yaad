import { useEffect, useState } from 'react'
import { getCustomers } from '../api/client.js'

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

export default function Dashboard({ refreshKey }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  const counts = customers.reduce(
    (acc, c) => {
      acc[c.risk] = (acc[c.risk] || 0) + 1
      return acc
    },
    { overdue: 0, due_soon: 0, ok: 0 }
  )

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
                  </tr>
                ))}

              {!loading && !error && customers.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="state">
                      <p className="state-title">No customers yet</p>
                      <p>Run <code>python scripts/seed.py</code> to populate demo data.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cust">
                        <span className="avatar">{initials(c.name)}</span>
                        <div>
                          <div className="cust-name">{c.name}</div>
                          {c.phone && <div className="cust-phone tnum">{c.phone}</div>}
                        </div>
                      </div>
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
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
