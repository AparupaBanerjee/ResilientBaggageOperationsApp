/**
 * AlertRail — fixed right sidebar showing live operational alerts.
 * Pulls from /bags, /integrations/live, and /health to derive alert conditions.
 */
import { useState, useEffect, useRef } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

const SEV = {
  HIGH:   { color: '#b22222', bg: '#3d151522', border: '#b2222244' },
  MEDIUM: { color: '#9e6a03', bg: '#3d280022', border: '#9e6a0344' },
  LOW:    { color: '#1f6feb', bg: '#0d1e3322', border: '#1f6feb44' },
}

function buildAlerts(bags, iot, health) {
  const alerts = []
  const now = Date.now()

  // Misrouted bags
  const misrouted = (bags ?? []).filter(b => b.misrouted && b.status !== 'delivered')
  misrouted.forEach(b => alerts.push({
    id: `mis-${b.bag_id}`,
    sev: 'HIGH',
    title: 'MISROUTED BAG',
    body: `${b.bag_id} on belt ${b.destination_belt} — correct: ${b.correct_belt}`,
    ts: now,
  }))

  // Overweight bags without delivered status
  const heavy = (bags ?? []).filter(b => b.weight_kg > 23 && b.status !== 'delivered')
  if (heavy.length > 0) alerts.push({
    id: 'heavy',
    sev: 'MEDIUM',
    title: 'HEAVY TAG REQUIRED',
    body: `${heavy.length} bag(s) >23 kg pending heavy tag handling`,
    ts: now,
  })

  // Stale bags (>15 min no scan, not delivered)
  const stale = (bags ?? []).filter(b => {
    if (b.status === 'delivered') return false
    try { return (now - new Date(b.last_updated).getTime()) > 15 * 60 * 1000 } catch { return false }
  })
  if (stale.length > 0) alerts.push({
    id: 'stale',
    sev: 'MEDIUM',
    title: 'NO SCAN ALERT',
    body: `${stale.length} bag(s) with no scan >15 min`,
    ts: now,
  })

  // Jammed conveyors
  const jams = (iot?.conveyor_health ?? []).filter(b => b.jam)
  jams.forEach(b => alerts.push({
    id: `jam-${b.belt_id}`,
    sev: 'HIGH',
    title: 'CONVEYOR JAM',
    body: `Belt ${b.belt_id} jammed — speed 0.0 m/s`,
    ts: now,
  }))

  // Faulty conveyors
  const faults = (iot?.conveyor_health ?? []).filter(b => b.status === 'FAULT')
  faults.forEach(b => alerts.push({
    id: `fault-${b.belt_id}`,
    sev: 'MEDIUM',
    title: 'BELT FAULT',
    body: `Belt ${b.belt_id} reporting fault status`,
    ts: now,
  }))

  // Sensor blackout
  if (iot?.chaos?.blackout) alerts.push({
    id: 'blackout',
    sev: 'HIGH',
    title: 'SENSOR BLACKOUT',
    body: 'RFID feeds suppressed — scanner hardware failure simulation active',
    ts: now,
  })

  // Flaky mode
  if (iot?.chaos?.flaky_mode) alerts.push({
    id: 'flaky',
    sev: 'MEDIUM',
    title: 'FLAKY WRITES ACTIVE',
    body: '30% of bag writes failing — intermittent network loss simulation',
    ts: now,
  })

  // Sync divergence
  if (health && !health.online) alerts.push({
    id: 'offline',
    sev: 'HIGH',
    title: 'SYNC PAUSED',
    body: `${health.pending_sync_count ?? 0} bag(s) pending sync to Main`,
    ts: now,
  })

  // Corrupt bags
  const corrupt = (bags ?? []).filter(b => b._corrupt)
  if (corrupt.length > 0) alerts.push({
    id: 'corrupt',
    sev: 'HIGH',
    title: 'CORRUPT RECORDS',
    body: `${corrupt.length} document(s) with invalid data in registry`,
    ts: now,
  })

  return alerts
}

function AlertCard({ alert, onDismiss }) {
  const s = SEV[alert.sev] ?? SEV.LOW
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderLeft: `3px solid ${s.color}`,
      borderRadius: '4px',
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: '3px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ ...mono, fontSize: '10px', fontWeight: 700, color: s.color, letterSpacing: '0.05em' }}>
          {alert.title}
        </span>
        <button
          onClick={() => onDismiss(alert.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            ...mono, fontSize: '10px', color: '#484f58', padding: '0 0 0 6px', lineHeight: 1,
          }}
        >✕</button>
      </div>
      <span style={{ ...mono, fontSize: '10px', color: '#7d8590', lineHeight: 1.4 }}>
        {alert.body}
      </span>
    </div>
  )
}

export default function AlertRail({ health, open, onToggle }) {
  const [bags,      setBags]      = useState([])
  const [iot,       setIot]       = useState(null)
  const [dismissed, setDismissed] = useState(new Set())
  const timerRef = useRef(null)

  const fetchData = () => {
    fetch(`${API}/bags`).then(r => r.json()).then(setBags).catch(() => {})
    fetch(`${API}/integrations/live`).then(r => r.json()).then(setIot).catch(() => {})
  }

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  const rawAlerts = buildAlerts(bags, iot, health)
  const alerts    = rawAlerts.filter(a => !dismissed.has(a.id))
  const count     = alerts.length

  const dismiss = (id) => setDismissed(prev => new Set([...prev, id]))
  const clearAll = () => setDismissed(new Set(rawAlerts.map(a => a.id)))

  return (
    <>
      {/* Toggle button — floats on right edge */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: '68px',
          right: open ? '276px' : '0',
          zIndex: 200,
          background: count > 0 ? '#b22222' : '#161b22',
          border: `1px solid ${count > 0 ? '#b22222' : '#30363d'}`,
          borderRight: 'none',
          borderRadius: '4px 0 0 4px',
          padding: '8px 6px',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          transition: 'right 0.2s ease',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={count > 0 ? '#fff' : '#7d8590'} strokeWidth="1.5"/>
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke={count > 0 ? '#fff' : '#7d8590'} strokeWidth="1.5"/>
        </svg>
        {count > 0 && (
          <span style={{ ...mono, fontSize: '10px', color: '#fff', fontWeight: 700, lineHeight: 1 }}>
            {count}
          </span>
        )}
      </button>

      {/* Rail panel */}
      <div style={{
        position: 'fixed',
        top: '56px',
        right: open ? '0' : '-280px',
        width: '276px',
        height: 'calc(100vh - 56px)',
        background: '#161b22',
        borderLeft: '1px solid #30363d',
        zIndex: 199,
        display: 'flex', flexDirection: 'column',
        transition: 'right 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid #30363d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="label-upper">Alerts</span>
            {count > 0 && (
              <span style={{
                ...mono, fontSize: '10px', fontWeight: 700, color: '#fff',
                background: '#b22222', borderRadius: '3px', padding: '1px 6px',
              }}>{count}</span>
            )}
          </div>
          {count > 0 && (
            <button onClick={clearAll} style={{
              background: 'none', border: '1px solid #30363d', borderRadius: '3px',
              ...mono, fontSize: '9px', color: '#484f58', padding: '2px 6px', cursor: 'pointer',
            }}>CLEAR ALL</button>
          )}
        </div>

        {/* Alert list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {alerts.length === 0 ? (
            <div style={{ ...mono, fontSize: '11px', color: '#484f58', textAlign: 'center', paddingTop: '24px' }}>
              No active alerts.{'\n'}System operating normally.
            </div>
          ) : (
            alerts.map(a => <AlertCard key={a.id} alert={a} onDismiss={dismiss} />)
          )}
        </div>

        {/* Footer — severity legend */}
        <div style={{
          padding: '8px 12px', borderTop: '1px solid #30363d',
          display: 'flex', gap: '12px',
        }}>
          {Object.entries(SEV).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: v.color }} />
              <span style={{ ...mono, fontSize: '9px', color: '#484f58' }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
