import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ACTION_COLORS = {
  bag_create:        '#238636',
  bag_status_update: '#1f6feb',
  bag_delete:        '#b22222',
  sim_outage:        '#b22222',
  sim_restore:       '#238636',
  sim_misroute:      '#b22222',
  sim_load:          '#9e6a03',
  sim_seed:          '#1f6feb',
}

const ACTION_LABELS = {
  bag_create:        'BAG CREATE',
  bag_status_update: 'STATUS UPDATE',
  bag_delete:        'BAG DELETE',
  sim_outage:        'SIM OUTAGE',
  sim_restore:       'SIM RESTORE',
  sim_misroute:      'MISROUTE INJ',
  sim_load:          'LOAD TEST',
  sim_seed:          'SEED DATA',
}

function formatTs(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('sv-SE', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const timerRef = useRef(null)

  const fetchAudit = () => {
    fetch(`${API}/audit?limit=25`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchAudit()
    timerRef.current = setInterval(fetchAudit, 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  const mono = { fontFamily: 'IBM Plex Mono' }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: '10px 16px',
          borderBottom: collapsed ? 'none' : '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Shield icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
              stroke="#484f58" strokeWidth="1.5" fill="none"/>
            <path d="M9 12l2 2 4-4" stroke="#484f58" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="label-upper">Audit Log</span>
          <span style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>
            {entries.length} ENTRIES
          </span>
        </div>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
          {collapsed ? '▶ EXPAND' : '▼ COLLAPSE'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '16px', ...mono, fontSize: '12px', color: '#7d8590' }}>
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: '16px', ...mono, fontSize: '12px', color: '#484f58' }}>
              No audit entries yet. Perform an action to generate the first entry.
            </div>
          ) : (
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Document</th>
                  <th>Detail</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const color  = ACTION_COLORS[e.action] ?? '#7d8590'
                  const label  = ACTION_LABELS[e.action] ?? e.action?.toUpperCase()
                  const isErr  = e.result === 'error'
                  return (
                    <tr key={e.id ?? i}>
                      <td style={{ ...mono, fontSize: '11px', color: '#7d8590', whiteSpace: 'nowrap' }}>
                        {formatTs(e.ts)}
                      </td>
                      <td style={{ ...mono, fontSize: '11px', color: '#e6edf3', whiteSpace: 'nowrap' }}>
                        {e.operator ?? 'anonymous'}
                      </td>
                      <td>
                        <span style={{
                          ...mono,
                          fontSize: '10px',
                          fontWeight: 600,
                          color,
                          border: `1px solid ${color}66`,
                          borderRadius: '3px',
                          padding: '1px 6px',
                          letterSpacing: '0.04em',
                          whiteSpace: 'nowrap',
                        }}>
                          {label}
                        </span>
                      </td>
                      <td style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>
                        {e.doc_id ?? '—'}
                      </td>
                      <td style={{ ...mono, fontSize: '11px', color: '#7d8590', maxWidth: '280px' }}>
                        <span style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {e.detail ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          ...mono,
                          fontSize: '10px',
                          fontWeight: 500,
                          color: isErr ? '#b22222' : '#238636',
                          letterSpacing: '0.04em',
                        }}>
                          {isErr ? 'ERROR' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
