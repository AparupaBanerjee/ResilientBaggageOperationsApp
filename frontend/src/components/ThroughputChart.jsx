import { useState, useEffect } from 'react'

const MAX_POINTS = 30
const W = 600
const H = 56
const PAD_TOP = 8
const PAD_LEFT = 0
const PAD_RIGHT = 0

export default function ThroughputChart({ health }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (health == null) return
    const val = health.throughput_per_min ?? 0
    setHistory(prev => {
      const next = [...prev, val]
      if (next.length > MAX_POINTS) next.shift()
      return next
    })
  }, [health])

  const current = health?.throughput_per_min ?? 0
  const peak    = Math.max(...history, 1)
  const padded  = [...Array(MAX_POINTS - history.length).fill(0), ...history]

  const pts = padded.map((val, i) => {
    const x = PAD_LEFT + (i / (MAX_POINTS - 1)) * (W - PAD_LEFT - PAD_RIGHT)
    const y = PAD_TOP + (1 - val / peak) * (H - PAD_TOP)
    return [x, y]
  })

  const linePath = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x},${y}`
    const [px, py] = pts[i - 1]
    const cx = (px + x) / 2
    return `${acc} C ${cx},${py} ${cx},${y} ${x},${y}`
  }, '')

  const areaPath = `${linePath} L ${W},${H} L 0,${H} Z`

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0d1117 60%, #071e26 100%)',
      border: '1px solid #1e2d3d',
      borderRadius: '12px',
      padding: '10px 16px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#22d3ee',
            textTransform: 'uppercase',
          }}>
            Throughput
          </span>
          <span style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: '#4b6a7a',
            textTransform: 'uppercase',
          }}>
            — Bags / Min
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '16px',
            fontWeight: 600,
            color: current > 0 ? '#22d3ee' : '#4b6a7a',
            textShadow: current > 0 ? '0 0 12px rgba(34,211,238,0.4)' : 'none',
          }}>
            {current}
          </span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#4b6a7a' }}>
            Last 30 intervals
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: 'block', overflow: 'visible' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <filter id="cyanGlow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal grid lines */}
          {[0, 0.5, 1].map(frac => (
            <line
              key={frac}
              x1={0} y1={PAD_TOP + frac * (H - PAD_TOP)}
              x2={W} y2={PAD_TOP + frac * (H - PAD_TOP)}
              stroke="#1e2d3d"
              strokeWidth={1}
            />
          ))}

          {/* Area fill */}
          {history.length > 1 && (
            <path d={areaPath} fill="url(#cyanAreaGrad)" />
          )}

          {/* Cyan line with glow */}
          {history.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#cyanGlow)"
            />
          )}
        </svg>

        {/* X-axis labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#2a3f4f' }}>90s ago</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#2a3f4f' }}>45s ago</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#2a3f4f' }}>now</span>
        </div>
      </div>

      {/* Footer: peak */}
      <div style={{
        borderTop: '1px solid #1e2d3d',
        paddingTop: '5px',
        display: 'flex',
        gap: '16px',
      }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#4b6a7a' }}>
          PEAK&nbsp;
          <span style={{ color: '#7dd3e8' }}>{peak === 1 ? 0 : peak}</span>
          &nbsp;bags/min
        </span>
      </div>
    </div>
  )
}
