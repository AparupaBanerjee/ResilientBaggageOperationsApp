import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_COLORS = {
  scheduled: '#e6edf3',
  boarding:  '#9e6a03',
  delayed:   '#d29922',
  departed:  '#7d8590',
  arrived:   '#3fb950',
  cancelled: '#b22222',
}

function formatDep(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function formatArr(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  } catch { return null }
}

export default function FlightBoard() {
  const [flights,        setFlights]        = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
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

  return (
    <div className="card" style={{ overflow: 'hidden', position: 'relative', height: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#0d1117',
      }}>
        <span className="label-upper">Flight Information</span>
        <span style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search flight / dest…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#e6edf3',
            fontFamily: 'IBM Plex Mono',
            fontSize: '11px',
            padding: '3px 8px',
            outline: 'none',
            width: '160px',
          }}
        />
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7d8590' }}>
          ARN / STOCKHOLM ARLANDA
        </span>
      </div>

      <div>
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
                <th>ORIG</th>
                <th>DEST</th>
                <th>Dep.</th>
                <th>Arr.</th>
                <th>Gate</th>
                <th>Belt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
              {flights
                .filter(f => {
                  if (!search.trim()) return true
                  const q = search.trim().toLowerCase()
                  return f.flight_id.toLowerCase().includes(q) || f.destination.toLowerCase().includes(q)
                })
                .map(f => {
                const isCancelled = f.status === 'cancelled'
                const isDeparted  = f.status === 'departed'
                const isArrived   = f.status === 'arrived'

                return (
                  <motion.tr
                    key={f.flight_id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: isCancelled ? 0.45 : 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                  >
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 500 }}>
                      {f.flight_id}
                    </td>
                    <td style={{
                      fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: (f.origin ?? 'ARN') === 'ARN' ? '#3fb950' : '#e6edf3',
                    }}>
                      {f.origin ?? 'ARN'}
                    </td>
                    <td style={{
                      fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: (f.destination ?? '') === 'ARN' ? '#3fb950' : '#e6edf3',
                    }}>
                      {f.destination}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      {formatDep(f.departure_time)}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px',
                      color: isArrived ? '#3fb950' : '#484f58' }}>
                      {(isDeparted || isArrived) && formatArr(f.arrival_time)
                        ? formatArr(f.arrival_time)
                        : <span style={{ color: '#484f58' }}>—</span>}
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
                  </motion.tr>
                )
              })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
