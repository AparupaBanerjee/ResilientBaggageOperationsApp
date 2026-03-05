import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_COLORS = {
  scheduled: '#e6edf3',
  boarding:  '#9e6a03',
  departed:  '#7d8590',
  cancelled: '#b22222',
}

function formatDep(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export default function FlightBoard() {
  const [flights,    setFlights]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [toast,      setToast]      = useState(null)
  const timerRef = useRef(null)

  const fetchFlights = () => {
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => { setFlights(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchFlights()
    timerRef.current = setInterval(fetchFlights, 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const handleCancel = (flight_id) => {
    setCancelling(flight_id)
    setConfirming(null)
    const operator = localStorage.getItem('operator_id') || 'anonymous'

    fetch(`${API}/flights/${flight_id}/cancel`, {
      method: 'POST',
      headers: { 'x-operator-id': operator },
    })
      .then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.detail || 'Cancel failed')
        return body
      })
      .then(body => {
        const parts = []
        if (body.rerouted_bags)  parts.push(`${body.rerouted_bags} rerouted→${body.alternate_flight}`)
        if (body.on_hold_bags)   parts.push(`${body.on_hold_bags} on hold`)
        if (body.offloaded_bags) parts.push(`${body.offloaded_bags} to RCL`)
        const summary = parts.length ? parts.join(' · ') : 'no bags affected'
        showToast(`${flight_id} cancelled — ${summary}`, true)
        fetchFlights()
      })
      .catch(err => showToast(err.message, false))
      .finally(() => setCancelling(null))
  }

  return (
    <div className="card" style={{ overflow: 'hidden', height: '100%', position: 'relative' }}>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'absolute', top: '10px', left: '50%',
          transform: 'translateX(-50%)',
          background: toast.ok ? '#0d2a18' : '#3d1515',
          border: `1px solid ${toast.ok ? '#238636' : '#b22222'}`,
          borderRadius: '4px', padding: '6px 14px',
          fontFamily: 'IBM Plex Mono', fontSize: '11px',
          color: toast.ok ? '#3fb950' : '#f85149',
          zIndex: 10, whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#0d1117',
      }}>
        <span className="label-upper">Flight Information</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7d8590' }}>
          ARN / STOCKHOLM ARLANDA
        </span>
      </div>

      <div style={{ overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px', color: '#7d8590', fontSize: '12px' }}>
            <span className="mono">Loading...</span>
          </div>
        ) : flights.length === 0 ? (
          <div style={{ padding: '16px', color: '#7d8590', fontSize: '12px' }}>
            No flights. Click SEED TEST DATA.
          </div>
        ) : (
          <table className="ops-table">
            <thead>
              <tr>
                <th>Flight</th>
                <th>Destination</th>
                <th>Dep.</th>
                <th>Gate</th>
                <th>Belt</th>
                <th>Status</th>
                <th style={{ width: '110px' }}></th>
              </tr>
            </thead>
            <tbody>
              {flights.map(f => {
                const isCancelled  = f.status === 'cancelled'
                const isConfirming = confirming === f.flight_id
                const isCancelling = cancelling === f.flight_id

                return (
                  <tr key={f.flight_id} style={{ opacity: isCancelled ? 0.45 : 1, transition: 'opacity 0.3s' }}>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 500 }}>
                      {f.flight_id}
                    </td>
                    <td style={{ fontSize: '12px', color: '#e6edf3' }}>
                      {f.destination}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      {formatDep(f.departure_time)}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      {f.gate}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      {isCancelled
                        ? <span style={{ color: '#484f58' }}>—</span>
                        : f.belt}
                    </td>
                    <td style={{
                      fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 500,
                      textTransform: 'uppercase',
                      color: STATUS_COLORS[f.status] ?? '#e6edf3',
                      letterSpacing: '0.05em',
                    }}>
                      {f.status}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: '10px' }}>
                      {isCancelled ? (
                        <span style={{
                          fontFamily: 'IBM Plex Mono', fontSize: '10px',
                          color: '#484f58', letterSpacing: '0.04em',
                        }}>
                          OFFLOADED
                        </span>
                      ) : isConfirming ? (
                        <span style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleCancel(f.flight_id)}
                            style={{
                              fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
                              background: '#3d1515', border: '1px solid #b22222',
                              color: '#f85149', borderRadius: '3px',
                              padding: '2px 7px', cursor: 'pointer', letterSpacing: '0.04em',
                            }}
                          >
                            CONFIRM
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            style={{
                              fontFamily: 'IBM Plex Mono', fontSize: '10px',
                              background: 'none', border: '1px solid #30363d',
                              color: '#484f58', borderRadius: '3px',
                              padding: '2px 7px', cursor: 'pointer',
                            }}
                          >
                            ABORT
                          </button>
                        </span>
                      ) : (
                        <button
                          disabled={isCancelling}
                          onClick={() => setConfirming(f.flight_id)}
                          style={{
                            fontFamily: 'IBM Plex Mono', fontSize: '10px',
                            background: 'none', border: '1px solid #30363d',
                            color: isCancelling ? '#30363d' : '#7d8590',
                            borderRadius: '3px', padding: '2px 8px',
                            cursor: isCancelling ? 'default' : 'pointer',
                            letterSpacing: '0.04em',
                            transition: 'border-color 0.15s, color 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isCancelling) {
                              e.currentTarget.style.borderColor = '#b22222'
                              e.currentTarget.style.color = '#f85149'
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#30363d'
                            e.currentTarget.style.color = '#7d8590'
                          }}
                        >
                          {isCancelling ? 'CANCELLING…' : 'CANCEL FLT'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
