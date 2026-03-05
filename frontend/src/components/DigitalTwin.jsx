/**
 * DigitalTwin — live SVG top-down view of the baggage hall.
 * Shows 5 conveyor belts with bags as animated dots moving left→right.
 * Bag position derived from status: check_in→in_transit→loaded→delivered
 */
import { useState, useEffect, useRef } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

// Layout constants
const W          = 760
const H          = 260
const BELT_IDS   = ['A1', 'A2', 'B1', 'B2', 'C1']
const BELT_Y     = [30, 78, 126, 174, 222]
const BELT_H     = 22
const BELT_X0    = 100   // start x
const BELT_X1    = 620   // end x (gate end)
const GATE_X     = 640
const CHECKIN_X  = 70

const STATUS_X_PCT = {
  check_in:   0.08,
  in_transit: 0.42,
  loaded:     0.72,
  delivered:  0.93,
}

const STATUS_COLOR = {
  check_in:   '#1f6feb',
  in_transit: '#9e6a03',
  loaded:     '#238636',
  delivered:  '#484f58',
}

const FLIGHT_IDS = { A1: 'SK101', A2: 'SK202', B1: 'SK303', B2: 'SK404', C1: 'SK505' }

// Deterministic jitter per bag so dots on same belt don't stack
function jitter(bagId, range) {
  let h = 0
  for (let i = 0; i < bagId.length; i++) h = (h * 31 + bagId.charCodeAt(i)) & 0xffff
  return (h / 0xffff) * range - range / 2
}

function bagX(bag) {
  const pct = STATUS_X_PCT[bag.status] ?? 0.08
  const belt_len = BELT_X1 - BELT_X0
  return BELT_X0 + pct * belt_len + jitter(bag.bag_id ?? bag.flight_id ?? '', 28)
}

function bagY(bag, beltIdx) {
  const cy = BELT_Y[beltIdx] + BELT_H / 2
  return cy + jitter((bag.bag_id ?? '') + 'y', 10)
}

export default function DigitalTwin() {
  const [bags,      setBags]      = useState([])
  const [conveyors, setConveyors] = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const timerRef = useRef(null)

  const fetchAll = () => {
    fetch(`${API}/bags`).then(r => r.json()).then(data => setBags(Array.isArray(data) ? data : [])).catch(() => {})
    fetch(`${API}/integrations/live`).then(r => r.json()).then(d => setConveyors(d?.conveyor_health ?? [])).catch(() => {})
  }

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(fetchAll, 4000)
    return () => clearInterval(timerRef.current)
  }, [])

  const convMap = {}
  conveyors.forEach(c => { convMap[c.belt_id] = c })

  // Group bags by belt
  const beltBags = {}
  BELT_IDS.forEach(b => { beltBags[b] = [] })
  bags.forEach(bag => {
    const b = bag.destination_belt
    if (beltBags[b]) beltBags[b].push(bag)
  })

  const totalBags = bags.length

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
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
            <rect x="2" y="2" width="20" height="20" rx="3" stroke="#484f58" strokeWidth="1.5"/>
            <path d="M7 12h10M12 7v10" stroke="#484f58" strokeWidth="1" strokeOpacity="0.5"/>
            <circle cx="8" cy="9" r="1.5" fill="#1f6feb"/>
            <circle cx="16" cy="15" r="1.5" fill="#238636"/>
            <circle cx="12" cy="12" r="1.5" fill="#9e6a03"/>
          </svg>
          <span className="label-upper">Digital Twin</span>
          <span style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>
            Live Baggage Hall View · {totalBags} bags
          </span>
        </div>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
          {collapsed ? '▶ EXPAND' : '▼ COLLAPSE'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            aria-label="Digital twin baggage hall"
          >
            {/* Background */}
            <rect width={W} height={H} fill="#0d1117" rx="4"/>

            {/* Zone labels */}
            <text x={CHECKIN_X} y={14} fill="#30363d" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">CHECK-IN</text>
            <text x={(BELT_X0 + BELT_X1) / 2} y={14} fill="#30363d" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">SORT · TRANSIT</text>
            <text x={GATE_X + 20} y={14} fill="#30363d" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">GATES</text>

            {/* Divider lines */}
            <line x1={BELT_X0 - 10} y1={20} x2={BELT_X0 - 10} y2={H - 10} stroke="#21262d" strokeWidth="1"/>
            <line x1={BELT_X1 + 10} y1={20} x2={BELT_X1 + 10} y2={H - 10} stroke="#21262d" strokeWidth="1"/>

            {BELT_IDS.map((beltId, idx) => {
              const cy      = BELT_Y[idx]
              const conv    = convMap[beltId] ?? {}
              const isJam   = conv.jam
              const isFault = conv.status === 'FAULT'
              const bColor  = isJam ? '#b22222' : isFault ? '#9e6a03' : '#1e2a1e'
              const trackColor = isJam ? '#b2222244' : '#238636'
              const beltBagList = beltBags[beltId] ?? []

              return (
                <g key={beltId}>
                  {/* Belt track */}
                  <rect
                    x={BELT_X0} y={cy}
                    width={BELT_X1 - BELT_X0} height={BELT_H}
                    fill={bColor} rx="3"
                    stroke={isJam ? '#b22222' : isFault ? '#9e6a03' : '#21262d'}
                    strokeWidth="1"
                  />

                  {/* Motion dashes (simplified belt texture) */}
                  {!isJam && [0.2, 0.4, 0.6, 0.8].map(pct => (
                    <line
                      key={pct}
                      x1={BELT_X0 + (BELT_X1 - BELT_X0) * pct}
                      y1={cy + 2}
                      x2={BELT_X0 + (BELT_X1 - BELT_X0) * pct}
                      y2={cy + BELT_H - 2}
                      stroke="#21262d" strokeWidth="1" strokeDasharray="2,2"
                    />
                  ))}

                  {/* Belt ID label */}
                  <text
                    x={CHECKIN_X} y={cy + BELT_H / 2 + 4}
                    fill={isJam ? '#b22222' : '#7d8590'}
                    fontSize="11" fontFamily="IBM Plex Mono" fontWeight="700" textAnchor="middle"
                  >{beltId}</text>

                  {/* Flight label */}
                  <text
                    x={CHECKIN_X} y={cy + BELT_H / 2 + 15}
                    fill="#484f58" fontSize="8" fontFamily="IBM Plex Mono" textAnchor="middle"
                  >{FLIGHT_IDS[beltId]}</text>

                  {/* Gate box */}
                  <rect
                    x={GATE_X} y={cy + 2}
                    width={44} height={BELT_H - 4}
                    fill={isJam ? '#3d1515' : '#0d1e12'} rx="2"
                    stroke={isJam ? '#b22222' : '#238636'} strokeWidth="1"
                  />
                  <text
                    x={GATE_X + 22} y={cy + BELT_H / 2 + 4}
                    fill={isJam ? '#b22222' : '#238636'}
                    fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle" fontWeight="600"
                  >
                    {isJam ? 'JAM' : `${beltBagList.filter(b => b.status === 'delivered').length} DEL`}
                  </text>

                  {/* JAM label overlay */}
                  {isJam && (
                    <text
                      x={(BELT_X0 + BELT_X1) / 2} y={cy + BELT_H / 2 + 4}
                      fill="#b22222" fontSize="10" fontFamily="IBM Plex Mono"
                      textAnchor="middle" fontWeight="700"
                    >── JAM ──</text>
                  )}

                  {/* Bag dots */}
                  {!isJam && beltBagList.map(bag => {
                    const x     = bagX(bag)
                    const y     = bagY(bag, idx)
                    const color = bag.misrouted ? '#b22222' : STATUS_COLOR[bag.status] ?? '#484f58'
                    const r     = bag.weight_kg > 23 ? 5.5 : 4
                    return (
                      <g key={bag.bag_id ?? bag.passenger_name}>
                        <circle cx={x} cy={y} r={r} fill={color} opacity="0.85">
                          <title>{bag.bag_id} · {bag.passenger_name} · {bag.status} · {bag.weight_kg}kg{bag.misrouted ? ' · MISROUTED' : ''}</title>
                        </circle>
                        {bag.misrouted && (
                          <circle cx={x} cy={y} r={r + 2.5} fill="none" stroke="#b22222" strokeWidth="1.5" opacity="0.7"/>
                        )}
                        {bag.weight_kg > 23 && (
                          <circle cx={x} cy={y} r={r + 2} fill="none" stroke="#9e6a03" strokeWidth="1" opacity="0.6"/>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* Legend */}
            {[['check_in', 'Check-in'], ['in_transit', 'In Transit'], ['loaded', 'Loaded'], ['delivered', 'Delivered']].map(([s, label], i) => (
              <g key={s} transform={`translate(${100 + i * 155}, ${H - 10})`}>
                <circle cx="5" cy="-3" r="4" fill={STATUS_COLOR[s]}/>
                <text x="13" y="0" fill="#484f58" fontSize="9" fontFamily="IBM Plex Mono">{label}</text>
              </g>
            ))}
            <g transform={`translate(${100 + 4 * 155}, ${H - 10})`}>
              <circle cx="5" cy="-3" r="4" fill="none" stroke="#b22222" strokeWidth="1.5"/>
              <circle cx="5" cy="-3" r="2" fill="#b22222"/>
              <text x="13" y="0" fill="#484f58" fontSize="9" fontFamily="IBM Plex Mono">Misrouted</text>
            </g>
          </svg>

          {/* Speed strip */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {BELT_IDS.map(b => {
              const c = convMap[b] ?? {}
              return (
                <div key={b} style={{
                  flex: 1, ...mono, fontSize: '9px', color: c.jam ? '#b22222' : '#484f58',
                  textAlign: 'center',
                }}>
                  {b}: {c.jam ? 'JAM' : `${c.speed_mps ?? '—'} m/s · ${c.load_pct ?? '—'}%`}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
