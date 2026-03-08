import { useState, useEffect } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

function nowHMS() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const SCENARIOS = [
  {
    id: 'flaky',
    label: 'Flaky Writes',
    description: '30% of bag writes randomly fail — simulates intermittent network loss',
    endpoint: '/simulate/flaky',
    color: '#9e6a03',
    toggle: true,
  },
  {
    id: 'blackout',
    label: 'Sensor Blackout',
    description: 'RFID scanners offline for 30s — simulates scanner hardware failure',
    endpoint: '/simulate/blackout',
    color: '#b22222',
    toggle: false,
  },
  {
    id: 'corrupt',
    label: 'Corrupt Document',
    description: 'Inject bag with null flight_id, invalid status, negative weight',
    endpoint: '/simulate/corrupt',
    color: '#b22222',
    toggle: false,
  },
  {
    id: 'storm',
    label: 'Write Storm',
    description: 'Burst 50 bags in rapid succession — stress-tests write throughput',
    endpoint: '/simulate/storm',
    color: '#1f6feb',
    toggle: false,
  },
]

export default function ChaosPanel({ chaosState }) {
  const [logs,    setLogs]    = useState([])
  const [working, setWorking] = useState(null)
  const [flaky,   setFlaky]   = useState(false)

  useEffect(() => {
    if (chaosState?.flaky_mode !== undefined) setFlaky(chaosState.flaky_mode)
  }, [chaosState?.flaky_mode])

  const addLog = (msg, color = '#7d8590') =>
    setLogs(prev => [{ ts: nowHMS(), msg, color }, ...prev].slice(0, 6))

  const run = async (scenario) => {
    setWorking(scenario.id)
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const r = await fetch(`${API}${scenario.endpoint}`, {
        method: 'POST',
        headers: { 'X-Operator-Id': operatorId },
      })
      const data = await r.json()
      if (r.ok) {
        if (scenario.id === 'flaky') setFlaky(data.flaky_mode)
        addLog(data.message ?? `${scenario.label} triggered`, scenario.color)
      } else {
        addLog(`ERROR: ${data.detail ?? 'unknown'}`, '#b22222')
      }
    } catch (err) {
      addLog(`ERROR: ${err.message}`, '#b22222')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Radiation / chaos icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="2" stroke="#b22222" strokeWidth="1.5"/>
          <path d="M12 10V4M8.5 11.5L3.5 7.5M15.5 11.5L20.5 7.5" stroke="#b22222" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M10.5 13.5L6 20M13.5 13.5L18 20" stroke="#b22222" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="label-upper" style={{ color: '#b22222' }}>Chaos Lab</span>
        {(flaky || chaosState?.blackout) && (
          <span style={{ ...mono, fontSize: '10px', color: '#b22222', fontWeight: 700 }}>
            {flaky ? '⚡ FLAKY' : ''}{flaky && chaosState?.blackout ? ' · ' : ''}{chaosState?.blackout ? '📡 BLACKOUT' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {SCENARIOS.map(s => {
          const active = s.id === 'flaky' ? flaky : false
          return (
            <button
              key={s.id}
              onClick={() => run(s)}
              disabled={!!working}
              title={s.description}
              style={{
                background: active ? `${s.color}22` : 'transparent',
                border: `1px solid ${active ? s.color : '#30363d'}`,
                borderRadius: '4px',
                padding: '7px 10px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                opacity: working && working !== s.id ? 0.5 : 1,
              }}
            >
              <span style={{
                ...mono, fontSize: '9px', fontWeight: 700,
                color: active ? s.color : '#484f58',
                border: `1px solid ${active ? s.color : '#30363d'}`,
                borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.05em',
                minWidth: '60px', textAlign: 'center',
              }}>
                {s.toggle ? (active ? 'ACTIVE' : 'OFF') : 'INJECT'}
              </span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ ...mono, fontSize: '11px', color: s.color, fontWeight: 600 }}>
                  {s.label}
                </div>
                <div style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
                  {s.description}
                </div>
              </div>
              {working === s.id && (
                <span style={{ ...mono, fontSize: '10px', color: '#484f58', marginLeft: 'auto' }}>
                  ...
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Log */}
      <div style={{
        background: '#0d1117', border: '1px solid #21262d',
        borderRadius: '4px', padding: '6px 8px',
        minHeight: '52px', maxHeight: '100px', overflowY: 'auto',
      }}>
        {logs.length === 0
          ? <span style={{ ...mono, fontSize: '11px', color: '#484f58' }}>No chaos events yet...</span>
          : logs.map((l, i) => (
            <div key={i} style={{ ...mono, fontSize: '11px', color: l.color, lineHeight: 1.7 }}>
              <span style={{ color: '#484f58' }}>[{l.ts}]  </span>{l.msg}
            </div>
          ))
        }
      </div>
    </div>
  )
}
