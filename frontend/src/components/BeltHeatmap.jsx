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

const BELTS   = ['A1', 'A2', 'B1', 'B2']
const FLIGHTS = { A1: 'SK101', A2: 'SK202', B1: 'SK303', B2: 'SK404' }
const DEMO_COLOR  = { A1: '#238636', A2: '#ca8a04', B1: '#ea580c', B2: '#b22222' }
const DEMO_BG     = { A1: '#0d2e1a', A2: '#3d3200', B1: '#3d1800', B2: '#2e0d0d' }
const DEMO_TEXT   = { A1: '#3fb950', A2: '#eab308', B1: '#f97316', B2: '#f87171' }
const DEMO_COUNTS = { A1: 2, A2: 4, B1: 8, B2: 12 }  // visual placeholder for demo

function loadLabel(fillPct) {
  if (fillPct > 75) return 'NEAR CAPACITY'
  if (fillPct > 45) return 'HIGH LOAD'
  if (fillPct > 20) return 'MODERATE'
  return 'LOW LOAD'
}

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

const COLOR_LABEL = {
  A1: 'GREEN — Low load',
  A2: 'YELLOW — Moderate',
  B1: 'ORANGE — High load',
  B2: 'RED — Near capacity',
}

// kept separate so TEAM_GUIDE stays in sync

function BeltCell({ beltId, data }) {
  const max        = 15
  const displayCount = DEMO_COUNTS[beltId] ?? data.total
  const fillPct    = Math.min(100, (displayCount / max) * 100)
  const isJam      = data.jam
  const isFault  = data.status === 'FAULT'
  const hasMis   = data.misrouted > 0

  const accentColor = isJam || hasMis ? '#b22222' : (DEMO_COLOR[beltId] ?? '#484f58')
  const textColor   = isJam ? '#f87171' : (DEMO_TEXT[beltId] ?? '#e6edf3')
  const bgColor     = DEMO_BG[beltId] ?? '#0d1117'
  const colorLabel  = isJam ? 'JAM' : hasMis ? 'MISROUTED' : (COLOR_LABEL[beltId] ?? loadLabel(fillPct))

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${accentColor}`,
      borderRadius: '6px',
      padding: '8px 12px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '4px', flex: 1, minWidth: '120px', textAlign: 'center',
    }}>
      {/* Belt ID */}
      <div style={{ ...mono, fontSize: '18px', fontWeight: 700, color: textColor, lineHeight: 1 }}>
        {beltId}
      </div>

      {/* Flight */}
      <div style={{ ...mono, fontSize: '10px', color: '#64748b' }}>
        {FLIGHTS[beltId] ?? '—'}
      </div>

      {/* Bag count */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ ...mono, fontSize: '24px', fontWeight: 700, color: isJam ? '#f87171' : '#e6edf3', lineHeight: 1 }}>
          {displayCount}
        </span>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>bags</span>
      </div>

      {/* Density bar */}
      <div style={{ width: '100%', height: '4px', background: '#0d111780', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${fillPct}%`,
          background: accentColor, borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Color label */}
      <div style={{ ...mono, fontSize: '10px', fontWeight: 600, color: accentColor }}>
        ● {colorLabel}
      </div>

      {/* Alert badges */}
      {(isFault || hasMis || data.heavy > 0) && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' }}>
          {isFault && !isJam && <span style={{ ...mono, fontSize: '9px', color: '#9e6a03', background: '#3d280066', border: '1px solid #9e6a0344', padding: '1px 5px', borderRadius: '3px' }}>FAULT</span>}
          {hasMis && <span style={{ ...mono, fontSize: '9px', color: '#f87171', background: '#2e0d0d', border: '1px solid #b2222244', padding: '1px 5px', borderRadius: '3px' }}>⚠ {data.misrouted} MISROUTED</span>}
          {data.heavy > 0 && <span style={{ ...mono, fontSize: '9px', color: '#9e6a03', background: '#3d280066', border: '1px solid #9e6a0344', padding: '1px 5px', borderRadius: '3px' }}>⚖ {data.heavy} HEAVY</span>}
        </div>
      )}

      {/* Status breakdown — only render if there's something to show */}
      {Object.values(data.byStatus).some(n => n > 0) && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {Object.entries(STATUS_COLOR).map(([s, col]) => {
            const n = data.byStatus[s] ?? 0
            if (!n) return null
            return (
              <span key={s} style={{
                ...mono, fontSize: '9px', color: col,
                background: `${col}15`, border: `1px solid ${col}44`,
                borderRadius: '3px', padding: '1px 4px', whiteSpace: 'nowrap',
              }}>
                {n} {s.replace('_', ' ')}
              </span>
            )
          })}
        </div>
      )}
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
        <div style={{ padding: '8px 16px', display: 'flex', gap: '10px' }}>
          {BELTS.map(b => <BeltCell key={b} beltId={b} data={beltData[b] ?? { total: 0, byStatus: {} }} />)}
        </div>
      )}
    </div>
  )
}
