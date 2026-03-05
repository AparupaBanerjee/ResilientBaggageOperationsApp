/**
 * BeltHeatmap — shows bag density and status breakdown per conveyor belt.
 */
import { useState, useEffect, useRef } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

const STATUS_COLOR = {
  check_in:   '#1f6feb',
  in_transit: '#9e6a03',
  loaded:     '#238636',
  delivered:  '#484f58',
}

const BELTS   = ['A1', 'A2', 'B1', 'B2', 'C1']
const FLIGHTS = { A1: 'SK101', A2: 'SK202', B1: 'SK303', B2: 'SK404', C1: 'SK505' }

function buildBeltData(bags, conveyors) {
  const map = {}
  BELTS.forEach(b => {
    map[b] = { total: 0, byStatus: {}, misrouted: 0, heavy: 0 }
  })
  ;(bags ?? []).forEach(bag => {
    const belt = bag.destination_belt
    if (!map[belt]) return
    map[belt].total++
    const s = bag.status ?? 'check_in'
    map[belt].byStatus[s] = (map[belt].byStatus[s] ?? 0) + 1
    if (bag.misrouted)     map[belt].misrouted++
    if (bag.weight_kg > 23) map[belt].heavy++
  })
  ;(conveyors ?? []).forEach(c => {
    if (map[c.belt_id]) {
      map[c.belt_id].speed  = c.speed_mps
      map[c.belt_id].load   = c.load_pct
      map[c.belt_id].status = c.status
      map[c.belt_id].jam    = c.jam
    }
  })
  return map
}

function BeltCell({ beltId, data }) {
  const max      = 10   // bags before "full"
  const fillPct  = Math.min(100, (data.total / max) * 100)
  const isJam    = data.jam
  const isFault  = data.status === 'FAULT'
  const hasMis   = data.misrouted > 0

  const borderColor = isJam   ? '#b22222'
                    : isFault ? '#9e6a03'
                    : hasMis  ? '#b22222'
                    :           '#21262d'

  return (
    <div style={{
      background: '#0d1117',
      border: `1px solid ${borderColor}`,
      borderRadius: '4px',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      flex: 1, minWidth: '100px',
    }}>
      {/* Belt ID + flight */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ ...mono, fontSize: '14px', fontWeight: 700, color: '#e6edf3' }}>{beltId}</span>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>{FLIGHTS[beltId] ?? '—'}</span>
      </div>

      {/* Bag count */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ ...mono, fontSize: '24px', fontWeight: 700, color: isJam ? '#b22222' : '#e6edf3', lineHeight: 1 }}>
          {data.total}
        </span>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>bags</span>
      </div>

      {/* Density bar */}
      <div style={{ height: '4px', background: '#21262d', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${fillPct}%`,
          background: isJam ? '#b22222' : fillPct > 80 ? '#b22222' : fillPct > 50 ? '#9e6a03' : '#238636',
          borderRadius: '2px',
        }} />
      </div>

      {/* Status breakdown dots */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLOR).map(([s, col]) => {
          const n = data.byStatus[s] ?? 0
          if (!n) return null
          return (
            <span key={s} style={{
              ...mono, fontSize: '9px', color: col,
              border: `1px solid ${col}55`, borderRadius: '2px',
              padding: '0 4px', whiteSpace: 'nowrap',
            }}>
              {n} {s.replace('_', ' ')}
            </span>
          )
        })}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {isJam && <span style={{ ...mono, fontSize: '9px', color: '#b22222', fontWeight: 700 }}>JAM</span>}
        {isFault && !isJam && <span style={{ ...mono, fontSize: '9px', color: '#9e6a03', fontWeight: 700 }}>FAULT</span>}
        {hasMis && <span style={{ ...mono, fontSize: '9px', color: '#b22222' }}>⚠ {data.misrouted} MISROUTED</span>}
        {data.heavy > 0 && <span style={{ ...mono, fontSize: '9px', color: '#9e6a03' }}>⚖ {data.heavy} HEAVY</span>}
        {data.speed !== undefined && (
          <span style={{ ...mono, fontSize: '9px', color: '#484f58' }}>{data.speed} m/s</span>
        )}
      </div>
    </div>
  )
}

export default function BeltHeatmap() {
  const [bags,       setBags]       = useState([])
  const [conveyors,  setConveyors]  = useState([])
  const [collapsed,  setCollapsed]  = useState(false)
  const timerRef = useRef(null)

  const fetchAll = () => {
    fetch(`${API}/bags`).then(r => r.json()).then(setBags).catch(() => {})
    fetch(`${API}/integrations/live`).then(r => r.json()).then(d => setConveyors(d?.conveyor_health ?? [])).catch(() => {})
  }

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(fetchAll, 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  const beltData   = buildBeltData(bags, conveyors)
  const totalBags  = bags.length
  const jamCount   = conveyors.filter(c => c.jam).length

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: '10px 16px',
          borderBottom: collapsed ? 'none' : '1px solid #30363d',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="14" width="4" height="7" rx="1" stroke="#484f58" strokeWidth="1.5"/>
            <rect x="7" y="9" width="4" height="12" rx="1" stroke="#484f58" strokeWidth="1.5"/>
            <rect x="12" y="5" width="4" height="16" rx="1" stroke="#484f58" strokeWidth="1.5"/>
            <rect x="17" y="2" width="4" height="19" rx="1" stroke="#484f58" strokeWidth="1.5"/>
          </svg>
          <span className="label-upper">Belt Heatmap</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#7d8590' }}>
            {totalBags} bags · {BELTS.length} belts
          </span>
          {jamCount > 0 && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#b22222', fontWeight: 700 }}>
              {jamCount} JAM{jamCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58' }}>
          {collapsed ? '▶ EXPAND' : '▼ COLLAPSE'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 16px', display: 'flex', gap: '10px' }}>
          {BELTS.map(b => <BeltCell key={b} beltId={b} data={beltData[b] ?? { total: 0, byStatus: {} }} />)}
        </div>
      )}
    </div>
  )
}
