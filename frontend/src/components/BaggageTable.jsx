import { useState, useEffect, useRef, useMemo } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_COLORS = {
  check_in:   '#7d8590',
  in_transit: '#1f6feb',
  loaded:     '#9e6a03',
  delivered:  '#238636',
  offloaded:  '#b22222',
  on_hold:    '#d29922',
  rerouted:   '#58a6ff',
}

const STATUS_LABELS = {
  check_in:   'Check-in',
  in_transit: 'In Transit',
  loaded:     'Loaded',
  delivered:  'Delivered',
  offloaded:  'Offloaded',
  on_hold:    'On Hold',
  rerouted:   'Rerouted',
}

function formatTs(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}


function SortIcon({ active, dir }) {
  if (!active) return <span style={{ color: '#30363d', marginLeft: '3px' }}>⇅</span>
  return <span style={{ color: '#e6edf3', marginLeft: '3px' }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

const STATUSES = ['check_in', 'in_transit', 'loaded', 'delivered', 'offloaded', 'on_hold', 'rerouted']

export default function BaggageTable() {
  const [bags, setBags]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [flightTab, setFlightTab] = useState('ALL')
  const [search, setSearch]       = useState('')
  const [sortCol, setSortCol]     = useState('last_updated')
  const [sortDir, setSortDir]     = useState('desc')
  const [editingBag, setEditingBag] = useState(null)   // bag_id being status-edited
  const [updating, setUpdating]   = useState(false)
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

  // Unique flight IDs derived from data
  const flights = useMemo(() => (
    [...new Set(bags.map(b => b.flight_id).filter(Boolean))].sort()
  ), [bags])

  // Filter + sort pipeline
  const visible = useMemo(() => {
    let out = bags
    if (flightTab !== 'ALL') out = out.filter(b => b.flight_id === flightTab)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(b =>
        (b.bag_id ?? '').toLowerCase().includes(q) ||
        (b.passenger_name ?? '').toLowerCase().includes(q) ||
        (b.flight_id ?? '').toLowerCase().includes(q)
      )
    }
    out = [...out].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (av == null) av = ''
      if (bv == null) bv = ''
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      av = String(av); bv = String(bv)
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return out
  }, [bags, flightTab, search, sortCol, sortDir])

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const thStyle = (col) => ({
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    color: sortCol === col ? '#e6edf3' : undefined,
  })

  const updateStatus = async (bagId, newStatus) => {
    setUpdating(true)
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    try {
      await fetch(`${API}/bags/${bagId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Operator-Id': operatorId },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchBags()
    } catch {}
    setEditingBag(null)
    setUpdating(false)
  }

  const overweightCount = visible.filter(b => (b.weight_kg ?? 0) > 23).length

  return (
    <div className="card" style={{ overflow: 'hidden' }}>

      {/* Header row */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="label-upper">Baggage Registry</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7d8590' }}>
            {visible.length}/{bags.length} RECORDS
          </span>
          {overweightCount > 0 && (
            <span style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: '10px',
              fontWeight: 600,
              color: '#9e6a03',
              border: '1px solid #9e6a03',
              borderRadius: '3px',
              padding: '1px 6px',
              letterSpacing: '0.04em',
            }}>
              ⚠ {overweightCount} HEAVY TAG REQ
            </span>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search bag ID, passenger, flight…"
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#e6edf3',
            fontFamily: 'IBM Plex Mono',
            fontSize: '11px',
            padding: '4px 10px',
            outline: 'none',
            width: '270px',
          }}
        />
      </div>

      {/* Flight filter tabs */}
      {flights.length > 0 && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #21262d',
          padding: '0 16px',
          overflowX: 'auto',
        }}>
          {['ALL', ...flights].map(f => (
            <button
              key={f}
              onClick={() => setFlightTab(f)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: flightTab === f ? '2px solid #238636' : '2px solid transparent',
                color: flightTab === f ? '#238636' : '#7d8590',
                fontFamily: 'IBM Plex Mono',
                fontSize: '11px',
                fontWeight: flightTab === f ? 600 : 400,
                padding: '8px 14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                letterSpacing: '0.04em',
              }}
            >
              {f}
              {f !== 'ALL' && (
                <span style={{ marginLeft: '5px', color: '#484f58' }}>
                  {bags.filter(b => b.flight_id === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '20px', color: '#7d8590', fontSize: '12px' }}>
            <span className="mono">Loading...</span>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '20px', color: '#7d8590', fontSize: '12px' }}>
            {bags.length === 0
              ? 'No bags found. Click SEED TEST DATA to populate.'
              : 'No bags match the current filter.'}
          </div>
        ) : (
          <table className="ops-table">
            <thead>
              <tr>
                <th style={thStyle('bag_id')} onClick={() => handleSort('bag_id')}>
                  Bag ID <SortIcon active={sortCol === 'bag_id'} dir={sortDir} />
                </th>
                <th style={thStyle('flight_id')} onClick={() => handleSort('flight_id')}>
                  Flight <SortIcon active={sortCol === 'flight_id'} dir={sortDir} />
                </th>
                <th style={thStyle('passenger_name')} onClick={() => handleSort('passenger_name')}>
                  Passenger <SortIcon active={sortCol === 'passenger_name'} dir={sortDir} />
                </th>
                <th style={thStyle('status')} onClick={() => handleSort('status')}>
                  Status <SortIcon active={sortCol === 'status'} dir={sortDir} />
                </th>
                <th style={thStyle('destination_belt')} onClick={() => handleSort('destination_belt')}>
                  Belt <SortIcon active={sortCol === 'destination_belt'} dir={sortDir} />
                </th>
                <th style={thStyle('weight_kg')} onClick={() => handleSort('weight_kg')}>
                  Weight (kg) <SortIcon active={sortCol === 'weight_kg'} dir={sortDir} />
                </th>
                <th style={thStyle('last_updated')} onClick={() => handleSort('last_updated')}>
                  Last Updated <SortIcon active={sortCol === 'last_updated'} dir={sortDir} />
                </th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(bag => {
                const heavy       = (bag.weight_kg ?? 0) > 23
                const isOffloaded = bag.status === 'offloaded'
                const isOnHold    = bag.status === 'on_hold'
                const isRerouted  = bag.status === 'rerouted'
                const isLocked    = isOffloaded || isOnHold || isRerouted

                const rowBg = isOffloaded ? { background: 'rgba(178,34,34,0.06)', opacity: 0.6 }
                            : isOnHold    ? { background: 'rgba(210,153,34,0.06)' }
                            : isRerouted  ? { background: 'rgba(88,166,255,0.06)' }
                            : undefined

                return (
                  <tr
                    key={bag.bag_id}
                    className={bag.source === 'edge_only' ? 'edge-only' : ''}
                    style={rowBg}
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
                      {isOffloaded ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="status-dot" style={{ background: '#b22222' }} />
                          <span style={{ fontSize: '12px', color: '#b22222', fontFamily: 'IBM Plex Mono' }}>
                            Offloaded
                          </span>
                          <span style={{
                            fontFamily: 'IBM Plex Mono', fontSize: '9px',
                            color: '#b22222', border: '1px solid #b2222266',
                            borderRadius: '2px', padding: '0 4px', letterSpacing: '0.04em',
                          }}>
                            AWAIT COLLECT
                          </span>
                        </div>
                      ) : isOnHold ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="status-dot" style={{ background: '#d29922' }} />
                          <span style={{ fontSize: '12px', color: '#d29922', fontFamily: 'IBM Plex Mono' }}>
                            On Hold
                          </span>
                          <span style={{
                            fontFamily: 'IBM Plex Mono', fontSize: '9px',
                            color: '#d29922', border: '1px solid #d2992266',
                            borderRadius: '2px', padding: '0 4px', letterSpacing: '0.04em',
                          }}>
                            RETRIEVE
                          </span>
                        </div>
                      ) : isRerouted ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="status-dot" style={{ background: '#58a6ff' }} />
                          <span style={{ fontSize: '12px', color: '#58a6ff', fontFamily: 'IBM Plex Mono' }}>
                            Rerouted
                          </span>
                          <span style={{
                            fontFamily: 'IBM Plex Mono', fontSize: '9px',
                            color: '#58a6ff', border: '1px solid #58a6ff66',
                            borderRadius: '2px', padding: '0 4px', letterSpacing: '0.04em',
                          }}>
                            ALT FLT
                          </span>
                        </div>
                      ) : editingBag === bag.bag_id ? (
                        <select
                          autoFocus
                          defaultValue={bag.status}
                          disabled={updating}
                          onChange={e => updateStatus(bag.bag_id, e.target.value)}
                          onBlur={() => setEditingBag(null)}
                          style={{
                            background: '#161b22', border: '1px solid #1f6feb',
                            borderRadius: '3px', color: '#e6edf3',
                            fontFamily: 'IBM Plex Mono', fontSize: '11px',
                            padding: '2px 4px', outline: 'none', cursor: 'pointer',
                          }}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          onClick={() => !isLocked && setEditingBag(bag.bag_id)}
                          title={isLocked ? undefined : "Click to update status"}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isLocked ? 'default' : 'pointer' }}
                        >
                          <span className="status-dot" style={{ background: STATUS_COLORS[bag.status] ?? '#7d8590' }} />
                          <span style={{ fontSize: '12px', color: STATUS_COLORS[bag.status] ?? '#7d8590' }}>
                            {STATUS_LABELS[bag.status] ?? bag.status}
                          </span>
                          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#30363d' }}>✎</span>
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      <span style={{ color: bag.misrouted ? '#b22222' : undefined }}>
                        {bag.destination_belt ?? '—'}
                      </span>
                      {bag.misrouted && (
                        <span style={{
                          marginLeft: '6px',
                          fontFamily: 'IBM Plex Mono',
                          fontSize: '9px',
                          color: '#b22222',
                          border: '1px solid #b22222',
                          borderRadius: '2px',
                          padding: '0 4px',
                          letterSpacing: '0.04em',
                        }}>MISROUTED→{bag.correct_belt}</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      <span style={{ color: heavy ? '#9e6a03' : undefined }}>
                        {bag.weight_kg?.toFixed(1)}
                      </span>
                      {heavy && (
                        <span style={{
                          marginLeft: '6px',
                          fontFamily: 'IBM Plex Mono',
                          fontSize: '9px',
                          color: '#9e6a03',
                          border: '1px solid #9e6a03',
                          borderRadius: '2px',
                          padding: '0 4px',
                          letterSpacing: '0.04em',
                        }}>HEAVY TAG</span>
                      )}
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
