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
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
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
    <div className="card" style={{ overflow: 'hidden', height: '100%' }}>
      {/* FIDS header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#0d1117',
      }}>
        <span className="label-upper">Flight Information</span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: 'IBM Plex Mono',
          fontSize: '11px',
          color: '#7d8590',
        }}>
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
              </tr>
            </thead>
            <tbody>
              {flights.map(f => (
                <tr key={f.flight_id}>
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
                    {f.belt}
                  </td>
                  <td style={{
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    color: STATUS_COLORS[f.status] ?? '#e6edf3',
                    letterSpacing: '0.05em',
                  }}>
                    {f.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
