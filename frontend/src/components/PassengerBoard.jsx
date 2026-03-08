import { useState, useEffect, useRef, useMemo } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PAX_STATUS_STYLE = {
  checked_in: { color: '#7d8590', label: 'CHECKED IN' },
  boarded:    { color: '#3fb950', label: 'BOARDED' },
  no_show:    { color: '#f85149', label: 'NO SHOW' },
}

const BAG_STATUS_COLORS = {
  check_in:   '#7d8590',
  in_transit: '#1f6feb',
  loaded:     '#9e6a03',
  delivered:  '#238636',
  offloaded:  '#b22222',
  on_hold:    '#d29922',
  rerouted:   '#58a6ff',
}

const BAG_STATUS_LABELS = {
  check_in:   'Check-in',
  in_transit: 'In Transit',
  loaded:     'Loaded',
  delivered:  'Delivered',
  offloaded:  'Offloaded',
  on_hold:    'On Hold',
  rerouted:   'Rerouted',
}

const BAG_STATUSES = ['check_in', 'in_transit', 'loaded', 'delivered', 'offloaded', 'on_hold', 'rerouted']

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ color: '#30363d', marginLeft: '3px' }}>⇅</span>
  return <span style={{ color: '#e6edf3', marginLeft: '3px' }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function holdDuration(holdSince) {
  if (!holdSince) return null
  try {
    const diffMs = Date.now() - new Date(holdSince).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return '<1 min'
    if (mins < 60) return `${mins} min`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  } catch { return null }
}

export default function PassengerBoard() {
  const [passengers,  setPassengers]  = useState([])
  const [flights,     setFlights]     = useState([])
  const [bags,        setBags]        = useState([])
  const [flightTab,   setFlightTab]   = useState('ALL')
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [confirming,  setConfirming]  = useState(null)
  const [processing,  setProcessing]  = useState(null)
  const [editingBag,  setEditingBag]  = useState(null)
  const [updating,    setUpdating]    = useState(false)
  const [sortCol,     setSortCol]     = useState('flight_id')
  const [sortDir,     setSortDir]     = useState('asc')
  const [toast,       setToast]       = useState(null)
  const timerRef = useRef(null)

  const fetchPassengers = () => {
    const url = flightTab === 'ALL'
      ? `${API}/passengers`
      : `${API}/passengers?flight_id=${encodeURIComponent(flightTab)}`
    fetch(url)
      .then(r => r.json())
      .then(data => { setPassengers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const fetchFlights = () => {
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => setFlights(data.filter(f => f.status !== 'cancelled')))
      .catch(() => {})
  }

  const fetchBags = () => {
    fetch(`${API}/bags`)
      .then(r => r.json())
      .then(setBags)
      .catch(() => {})
  }

  useEffect(() => {
    fetchFlights()
    fetchPassengers()
    fetchBags()
    timerRef.current = setInterval(() => { fetchPassengers(); fetchFlights(); fetchBags() }, 5000)
    return () => clearInterval(timerRef.current)
  }, [flightTab])

  // Lookup: "passenger_name::flight_id" -> bag
  const bagByPax = useMemo(() => {
    const map = {}
    bags.forEach(b => {
      const key = `${b.passenger_name}::${b.flight_id}`
      if (!map[key]) map[key] = b
    })
    return map
  }, [bags])

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const handleBoard = (pax_id) => {
    setProcessing(pax_id)
    const op = localStorage.getItem('operator_id') || 'anonymous'
    fetch(`${API}/passengers/${pax_id}/board`, {
      method: 'PUT',
      headers: { 'x-operator-id': op },
    })
      .then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.detail || 'Board failed')
        return body
      })
      .then(body => {
        showToast(`${body.passenger_name} — BOARDED ✓`, true)
        fetchPassengers()
      })
      .catch(err => showToast(err.message, false))
      .finally(() => setProcessing(null))
  }

  const handleNoShow = (pax_id) => {
    setProcessing(pax_id)
    setConfirming(null)
    const op = localStorage.getItem('operator_id') || 'anonymous'
    fetch(`${API}/passengers/${pax_id}/no-show`, {
      method: 'POST',
      headers: { 'x-operator-id': op },
    })
      .then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.detail || 'No-show failed')
        return body
      })
      .then(body => {
        const bagsMsg = body.bags_put_on_hold > 0
          ? ` — ${body.bags_put_on_hold} bag(s) HELD FOR OFFLOAD`
          : ' — no active bags'
        showToast(`NO SHOW: ${body.passenger_name}${bagsMsg}`, false)
        fetchPassengers()
      })
      .catch(err => showToast(err.message, false))
      .finally(() => setProcessing(null))
  }

  const updateBagStatus = async (bagId, newStatus) => {
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

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const thStyle = (col) => ({
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    color: sortCol === col ? '#e6edf3' : undefined,
  })

  // Count per flight for tab badges
  const flightCounts = useMemo(() => {
    const counts = {}
    passengers.forEach(p => { counts[p.flight_id] = (counts[p.flight_id] || 0) + 1 })
    return counts
  }, [passengers])

  // Filter + sort
  const visible = useMemo(() => {
    let out = passengers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(p =>
        p.passenger_name?.toLowerCase().includes(q) ||
        p.flight_id?.toLowerCase().includes(q) ||
        p.passenger_id?.toLowerCase().includes(q) ||
        bagByPax[`${p.passenger_name}::${p.flight_id}`]?.bag_id?.toLowerCase().includes(q)
      )
    }
    return [...out].sort((a, b) => {
      let av, bv
      if (sortCol === 'bag_status') {
        av = bagByPax[`${a.passenger_name}::${a.flight_id}`]?.status ?? ''
        bv = bagByPax[`${b.passenger_name}::${b.flight_id}`]?.status ?? ''
      } else if (sortCol === 'boarding_status') {
        av = a.boarding_status ?? ''; bv = b.boarding_status ?? ''
      } else {
        av = a[sortCol] ?? ''; bv = b[sortCol] ?? ''
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }, [passengers, search, sortCol, sortDir, bagByPax])

  const noShowCount  = passengers.filter(p => p.boarding_status === 'no_show').length
  const boardedCount = passengers.filter(p => p.boarding_status === 'boarded').length

  return (
    <div className="card" style={{ overflow: 'hidden', position: 'relative' }}>

      {/* Toast */}
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
          {toast.ok ? '✓' : '⚠'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        background: '#0d1117',
      }}>
        <span className="label-upper">Passenger &amp; Baggage</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7d8590' }}>
          {passengers.length} PAX
        </span>
        {boardedCount > 0 && (
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#3fb950',
            border: '1px solid #238636', borderRadius: '3px', padding: '1px 6px',
          }}>
            {boardedCount} BOARDED
          </span>
        )}
        {noShowCount > 0 && (
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
            color: '#f85149', border: '1px solid #b22222',
            borderRadius: '3px', padding: '1px 6px', letterSpacing: '0.04em',
          }}>
            ⚠ {noShowCount} NO SHOW
          </span>
        )}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, flight, bag…"
          style={{
            marginLeft: 'auto',
            background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px',
            color: '#e6edf3', fontFamily: 'IBM Plex Mono', fontSize: '11px',
            padding: '4px 10px', outline: 'none', width: '220px',
          }}
        />
      </div>

      {/* Flight tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #21262d', padding: '0 16px', overflowX: 'auto' }}>
        {['ALL', ...flights.map(f => f.flight_id)].map(fid => (
          <button
            key={fid}
            onClick={() => setFlightTab(fid)}
            style={{
              background: 'none', border: 'none',
              borderBottom: flightTab === fid ? '2px solid #388bfd' : '2px solid transparent',
              color: flightTab === fid ? '#388bfd' : '#7d8590',
              fontFamily: 'IBM Plex Mono', fontSize: '11px',
              fontWeight: flightTab === fid ? 600 : 400,
              padding: '8px 14px', cursor: 'pointer',
              whiteSpace: 'nowrap', letterSpacing: '0.04em',
            }}
          >
            {fid}
            {fid !== 'ALL' && flightCounts[fid] && (
              <span style={{ marginLeft: '5px', color: '#484f58' }}>{flightCounts[fid]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px', color: '#7d8590', fontSize: '12px', fontFamily: 'IBM Plex Mono' }}>
            Loading...
          </div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '20px', color: '#7d8590', fontSize: '12px', fontFamily: 'IBM Plex Mono' }}>
            {passengers.length === 0 ? 'No passengers found. Click SEED TEST DATA to populate.' : 'No results match the search.'}
          </div>
        ) : (
          <table className="ops-table">
            <thead>
              <tr>
                <th style={thStyle('passenger_name')} onClick={() => handleSort('passenger_name')}>
                  Passenger <SortIcon active={sortCol === 'passenger_name'} dir={sortDir} />
                </th>
                <th style={thStyle('flight_id')} onClick={() => handleSort('flight_id')}>
                  Flight <SortIcon active={sortCol === 'flight_id'} dir={sortDir} />
                </th>
                <th style={thStyle('boarding_status')} onClick={() => handleSort('boarding_status')}>
                  Boarding <SortIcon active={sortCol === 'boarding_status'} dir={sortDir} />
                </th>
                <th>Bag ID</th>
                <th style={thStyle('bag_status')} onClick={() => handleSort('bag_status')}>
                  Bag Status <SortIcon active={sortCol === 'bag_status'} dir={sortDir} />
                </th>
                <th>Belt</th>
                <th>kg</th>
                <th>Sync</th>
                <th style={{ width: '160px' }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(pax => {
                const isConfirming = confirming === pax.passenger_id
                const isProcessing = processing === pax.passenger_id
                const isPaxLocked  = pax.boarding_status === 'boarded' || pax.boarding_status === 'no_show'
                const paxSt        = PAX_STATUS_STYLE[pax.boarding_status] ?? PAX_STATUS_STYLE.checked_in
                const bag          = bagByPax[`${pax.passenger_name}::${pax.flight_id}`]

                const isOffloaded  = bag?.status === 'offloaded'
                const isOnHold     = bag?.status === 'on_hold'
                const isRerouted   = bag?.status === 'rerouted'
                const isBagLocked  = isOffloaded || isOnHold || isRerouted
                const heavy        = (bag?.weight_kg ?? 0) > 23

                const rowBg = pax.boarding_status === 'no_show'
                  ? { background: 'rgba(178,34,34,0.06)' }
                  : pax.boarding_status === 'boarded'
                  ? { background: 'rgba(35,134,54,0.05)' }
                  : undefined

                return (
                  <tr key={pax.passenger_id} style={rowBg}>
                    {/* Passenger name */}
                    <td style={{ fontSize: '12px', color: '#e6edf3' }}>
                      {pax.passenger_name}
                    </td>

                    {/* Flight */}
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 500 }}>
                      {pax.flight_id}
                    </td>

                    {/* Boarding status */}
                    <td>
                      <span style={{
                        fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
                        color: paxSt.color, letterSpacing: '0.06em',
                      }}>
                        {pax.boarding_status === 'no_show' ? '⚠ ' : ''}{paxSt.label}
                      </span>
                    </td>

                    {/* Bag ID */}
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>
                      {bag ? (
                        <span style={{ color: isOnHold ? '#d29922' : '#e6edf3', fontWeight: isOnHold ? 700 : 400 }}>
                          {bag.bag_id}
                          {Array.isArray(bag.checkpoint_log) && bag.checkpoint_log.length > 1 && (
                            <span style={{
                              marginLeft: '5px', fontSize: '9px', color: '#484f58',
                              border: '1px solid #30363d', borderRadius: '2px', padding: '0 3px',
                            }}>
                              {bag.checkpoint_log.length}✓
                            </span>
                          )}
                          {isOnHold && (
                            <span style={{
                              marginLeft: '4px', fontSize: '8px', color: '#d29922',
                              border: '1px solid #d2992244', borderRadius: '2px', padding: '0 3px',
                            }}>HOLD</span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#30363d' }}>—</span>
                      )}
                    </td>

                    {/* Bag Status (click-to-edit) */}
                    <td>
                      {!bag ? (
                        <span style={{ color: '#30363d', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>—</span>
                      ) : editingBag === bag.bag_id ? (
                        <select
                          autoFocus
                          defaultValue={bag.status}
                          disabled={updating}
                          onChange={e => updateBagStatus(bag.bag_id, e.target.value)}
                          onBlur={() => setEditingBag(null)}
                          style={{
                            background: '#161b22', border: '1px solid #1f6feb',
                            borderRadius: '3px', color: '#e6edf3',
                            fontFamily: 'IBM Plex Mono', fontSize: '11px',
                            padding: '2px 4px', outline: 'none', cursor: 'pointer',
                          }}
                        >
                          {BAG_STATUSES.map(s => (
                            <option key={s} value={s}>{BAG_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          onClick={() => !isBagLocked && setEditingBag(bag.bag_id)}
                          title={isBagLocked ? undefined : 'Click to update bag status'}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: isBagLocked ? 'default' : 'pointer' }}
                        >
                          <span className="status-dot" style={{ background: BAG_STATUS_COLORS[bag.status] ?? '#7d8590' }} />
                          <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: BAG_STATUS_COLORS[bag.status] ?? '#7d8590' }}>
                            {BAG_STATUS_LABELS[bag.status] ?? bag.status}
                          </span>
                          {isOnHold && bag.hold_since && (
                            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#9e6a03' }}>
                              {holdDuration(bag.hold_since)}
                            </span>
                          )}
                          {!isBagLocked && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#30363d' }}>✎</span>}
                        </div>
                      )}
                    </td>

                    {/* Belt */}
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      {bag ? (
                        <span style={{ color: bag.misrouted ? '#b22222' : undefined }}>
                          {bag.destination_belt ?? '—'}
                          {bag.misrouted && (
                            <span style={{
                              marginLeft: '5px', fontSize: '9px', color: '#b22222',
                              border: '1px solid #b22222', borderRadius: '2px', padding: '0 3px',
                            }}>→{bag.correct_belt}</span>
                          )}
                        </span>
                      ) : <span style={{ color: '#30363d' }}>—</span>}
                    </td>

                    {/* Weight */}
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                      {bag ? (
                        <span style={{ color: heavy ? '#9e6a03' : undefined }}>
                          {bag.weight_kg?.toFixed(1)}
                          {heavy && (
                            <span style={{
                              marginLeft: '4px', fontSize: '9px', color: '#9e6a03',
                              border: '1px solid #9e6a03', borderRadius: '2px', padding: '0 3px',
                            }}>HVY</span>
                          )}
                        </span>
                      ) : <span style={{ color: '#30363d' }}>—</span>}
                    </td>

                    {/* Sync */}
                    <td>
                      {bag ? (
                        <span style={{
                          fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 500,
                          color: bag.source === 'edge_only' ? '#9e6a03' : '#238636',
                          letterSpacing: '0.04em',
                        }}>
                          {bag.source === 'edge_only' ? 'EDGE' : 'SYNC'}
                        </span>
                      ) : <span style={{ color: '#30363d', fontFamily: 'IBM Plex Mono', fontSize: '11px' }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right', paddingRight: '10px' }}>
                      {isPaxLocked ? null : isConfirming ? (
                        <span style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleNoShow(pax.passenger_id)}
                            style={{
                              fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
                              background: '#3d1515', border: '1px solid #b22222',
                              color: '#f85149', borderRadius: '3px',
                              padding: '2px 7px', cursor: 'pointer', letterSpacing: '0.04em',
                            }}
                          >CONFIRM</button>
                          <button
                            onClick={() => setConfirming(null)}
                            style={{
                              fontFamily: 'IBM Plex Mono', fontSize: '10px',
                              background: 'none', border: '1px solid #30363d',
                              color: '#484f58', borderRadius: '3px',
                              padding: '2px 7px', cursor: 'pointer',
                            }}
                          >ABORT</button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            disabled={isProcessing}
                            onClick={() => handleBoard(pax.passenger_id)}
                            style={{
                              fontFamily: 'IBM Plex Mono', fontSize: '10px',
                              background: 'none', border: '1px solid #30363d',
                              color: isProcessing ? '#30363d' : '#7d8590',
                              borderRadius: '3px', padding: '2px 7px',
                              cursor: isProcessing ? 'default' : 'pointer',
                              letterSpacing: '0.04em', transition: 'border-color 0.15s, color 0.15s',
                            }}
                            onMouseEnter={e => { if (!isProcessing) { e.currentTarget.style.borderColor = '#238636'; e.currentTarget.style.color = '#3fb950' }}}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#7d8590' }}
                          >BOARD</button>
                          <button
                            disabled={isProcessing}
                            onClick={() => setConfirming(pax.passenger_id)}
                            style={{
                              fontFamily: 'IBM Plex Mono', fontSize: '10px',
                              background: 'none', border: '1px solid #30363d',
                              color: isProcessing ? '#30363d' : '#7d8590',
                              borderRadius: '3px', padding: '2px 7px',
                              cursor: isProcessing ? 'default' : 'pointer',
                              letterSpacing: '0.04em', transition: 'border-color 0.15s, color 0.15s',
                            }}
                            onMouseEnter={e => { if (!isProcessing) { e.currentTarget.style.borderColor = '#b22222'; e.currentTarget.style.color = '#f85149' }}}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#7d8590' }}
                          >NO SHOW</button>
                        </span>
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
