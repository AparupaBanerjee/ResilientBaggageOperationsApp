/**
 * BaggageKPIBar — 5-tile at-a-glance stats strip for the Live Ops tab.
 * Derives all counts from a single /bags fetch — no extra endpoints needed.
 */
import { useState, useEffect, useRef } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

const TILES = [
  {
    key:    'total',
    label:  'TOTAL BAGS',
    color:  '#58a6ff',
    filter: () => true,
  },
  {
    key:    'check_in',
    label:  'CHECK-IN',
    color:  '#7d8590',
    filter: b => b.status === 'check_in',
  },
  {
    key:    'in_transit',
    label:  'IN TRANSIT',
    color:  '#1f6feb',
    filter: b => b.status === 'in_transit',
  },
  {
    key:    'loaded',
    label:  'LOADED',
    color:  '#238636',
    filter: b => b.status === 'loaded',
  },
  {
    key:    'on_hold',
    label:  'ON HOLD',
    color:  '#d29922',
    filter: b => b.status === 'on_hold',
  },
]

function KPITile({ label, value, color, pulse }) {
  return (
    <div style={{
      flex: 1,
      background: '#161b22',
      border: `1px solid ${color}33`,
      borderTop: `2px solid ${color}`,
      borderRadius: '6px',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      minWidth: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* subtle ambient glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <span style={{
        ...mono,
        fontSize: '32px',
        fontWeight: 700,
        lineHeight: 1,
        color,
        letterSpacing: '-0.02em',
        position: 'relative',
      }}>
        {value ?? '—'}
        {pulse && value > 0 && (
          <span style={{
            display: 'inline-block',
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: color,
            marginLeft: '6px',
            verticalAlign: 'middle',
            animation: 'kpi-pulse 1.4s ease-in-out infinite',
          }} />
        )}
      </span>

      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: '#7d8590',
        textTransform: 'uppercase',
        position: 'relative',
      }}>
        {label}
      </span>
    </div>
  )
}

export default function BaggageKPIBar() {
  const [bags,    setBags]    = useState([])
  const [tick,    setTick]    = useState(0)   // flip to animate on refresh
  const timerRef = useRef(null)

  const fetchBags = () =>
    fetch(`${API}/bags`)
      .then(r => r.json())
      .then(data => { setBags(Array.isArray(data) ? data : []); setTick(t => t + 1) })
      .catch(() => {})

  useEffect(() => {
    fetchBags()
    timerRef.current = setInterval(fetchBags, 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  const counts = TILES.reduce((acc, t) => {
    acc[t.key] = t.key === 'total' ? bags.length : bags.filter(t.filter).length
    return acc
  }, {})

  return (
    <>
      <style>{`
        @keyframes kpi-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>

      <div style={{ display: 'flex', gap: '8px' }}>
        {TILES.map(t => (
          <KPITile
            key={t.key}
            label={t.label}
            value={counts[t.key]}
            color={t.color}
            pulse={t.key === 'on_hold'}
          />
        ))}
      </div>
    </>
  )
}
