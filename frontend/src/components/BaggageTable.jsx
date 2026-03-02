import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_COLORS = {
  check_in:   '#7d8590',
  in_transit: '#1f6feb',
  loaded:     '#9e6a03',
  delivered:  '#238636',
}

const STATUS_LABELS = {
  check_in:   'Check-in',
  in_transit: 'In Transit',
  loaded:     'Loaded',
  delivered:  'Delivered',
}

function formatTs(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

export default function BaggageTable() {
  const [bags, setBags]     = useState([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const fetchBags = () => {
    fetch(`${API}/bags`)
      .then(r => r.json())
      .then(data => { setBags(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchBags()
    timerRef.current = setInterval(fetchBags, 3000)
    return () => clearInterval(timerRef.current)
  }, [])

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span className="label-upper">Baggage Registry</span>
        <span style={{
          fontFamily: 'IBM Plex Mono',
          fontSize: '11px',
          color: '#7d8590',
        }}>
          {bags.length} RECORDS
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '20px', color: '#7d8590', fontSize: '12px' }}>
            <span className="mono">Loading...</span>
          </div>
        ) : bags.length === 0 ? (
          <div style={{ padding: '20px', color: '#7d8590', fontSize: '12px' }}>
            No bags found. Click SEED TEST DATA to populate.
          </div>
        ) : (
          <table className="ops-table">
            <thead>
              <tr>
                <th>Bag ID</th>
                <th>Flight</th>
                <th>Passenger</th>
                <th>Status</th>
                <th>Belt</th>
                <th>Weight (kg)</th>
                <th>Last Updated</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {bags.map(bag => (
                <tr
                  key={bag.bag_id}
                  className={bag.source === 'edge_only' ? 'edge-only' : ''}
                >
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#e6edf3' }}>
                    {bag.bag_id}
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 500 }}>
                    {bag.flight_id}
                  </td>
                  <td style={{ color: '#e6edf3', fontSize: '12px' }}>
                    {bag.passenger_name}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        className="status-dot"
                        style={{ background: STATUS_COLORS[bag.status] ?? '#7d8590' }}
                      />
                      <span style={{ fontSize: '12px', color: STATUS_COLORS[bag.status] ?? '#7d8590' }}>
                        {STATUS_LABELS[bag.status] ?? bag.status}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                    {bag.destination_belt ?? '—'}
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                    {bag.weight_kg?.toFixed(1)}
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7d8590' }}>
                    {formatTs(bag.last_updated)}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'IBM Plex Mono',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: bag.source === 'edge_only' ? '#9e6a03' : '#238636',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {bag.source === 'edge_only' ? 'EDGE ONLY' : 'SYNCED'}
                    </span>
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
