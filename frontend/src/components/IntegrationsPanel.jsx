import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTs(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString('sv-SE', { month: '2-digit', day: '2-digit' })
    const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    return `${date} ${time}`
  } catch { return iso }
}

function Badge({ label, color }) {
  return (
    <span style={{
      ...mono, fontSize: '10px', fontWeight: 600,
      color, border: `1px solid ${color}66`,
      borderRadius: '3px', padding: '1px 6px',
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

// ── Unified DCS + ACRIS panel ─────────────────────────────────────────────────

const ACRIS_COLORS = {
  ON_SCHEDULE: '#238636', BOARDING: '#1f6feb', FINAL_CALL: '#9e6a03',
  DELAYED: '#b22222',     GATE_CLOSED: '#484f58',
}

function FlightStatusPanel({ dcs, acris }) {
  // Build a merged row per flight_id
  const dcsMap   = Object.fromEntries((dcs   ?? []).map(f => [f.flight_id, f]))
  const acrisMap = Object.fromEntries((acris ?? []).map(f => [f.flight_id, f]))
  const flightIds = [...new Set([...Object.keys(dcsMap), ...Object.keys(acrisMap)])]

  if (!flightIds.length) return <Empty text="No flight status data" />

  return (
    <table className="ops-table">
      <thead>
        <tr>
          <th>Flight</th><th>Dest</th><th>Gate</th>
          <th>Sched Dep</th><th>Checked In</th><th>Bags</th><th>Load</th>
          <th>Delay</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {flightIds.map(fid => {
          const d = dcsMap[fid]   ?? {}
          const a = acrisMap[fid] ?? {}
          const loadColor = (d.load_factor ?? 0) >= 95 ? '#b22222'
                          : (d.load_factor ?? 0) >= 80 ? '#9e6a03' : '#238636'
          const acrisStatus = a.acris_status ?? ''
          return (
            <tr key={fid}>
              <td style={{ ...mono, fontSize: '11px', color: '#e6edf3', fontWeight: 600 }}>{fid}</td>
              <td style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>{d.destination ?? a.destination ?? '—'}</td>
              <td style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>{d.gate ?? '—'}</td>
              <td style={{ ...mono, fontSize: '11px', color: '#7d8590', whiteSpace: 'nowrap' }}>
                {a.scheduled_departure ? formatTs(a.scheduled_departure) : '—'}
              </td>
              <td style={{ ...mono, fontSize: '11px', color: '#e6edf3' }}>
                {d.checked_in != null ? `${d.checked_in} / ${d.capacity}` : '—'}
              </td>
              <td style={{ ...mono, fontSize: '11px', color: '#e6edf3' }}>{d.bags_checked ?? '—'}</td>
              <td>
                {d.load_factor != null
                  ? <span style={{ ...mono, fontSize: '11px', fontWeight: 600, color: loadColor }}>{d.load_factor}%</span>
                  : <span style={{ ...mono, fontSize: '11px', color: '#484f58' }}>—</span>}
              </td>
              <td style={{ ...mono, fontSize: '11px', color: (a.delay_min ?? 0) > 0 ? '#b22222' : '#484f58' }}>
                {(a.delay_min ?? 0) > 0 ? `+${a.delay_min}m` : '—'}
              </td>
              <td>
                {acrisStatus
                  ? <Badge label={acrisStatus.replace(/_/g, ' ')} color={ACRIS_COLORS[acrisStatus] ?? '#7d8590'} />
                  : <span style={{ ...mono, fontSize: '11px', color: '#484f58' }}>—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── RFID panel ────────────────────────────────────────────────────────────────

function RFIDPanel({ events }) {
  if (!events?.length) return <Empty text="Awaiting RFID scans..." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {events.map((e, i) => (
        <div key={i} style={{
          display: 'flex', gap: '8px', alignItems: 'center',
          padding: '3px 0',
          borderBottom: i < events.length - 1 ? '1px solid #21262d' : 'none',
        }}>
          <span style={{ ...mono, fontSize: '10px', color: '#484f58', whiteSpace: 'nowrap' }}>
            {formatTs(e.ts)}
          </span>
          <span style={{ ...mono, fontSize: '11px', color: '#1f6feb', whiteSpace: 'nowrap' }}>
            {e.reader_id}
          </span>
          <span style={{ ...mono, fontSize: '11px', color: '#7d8590', whiteSpace: 'nowrap' }}>
            {e.bag_tag}
          </span>
          <span style={{ ...mono, fontSize: '11px', color: e.overweight ? '#9e6a03' : '#484f58', whiteSpace: 'nowrap' }}>
            {e.weight_kg} kg
          </span>
          {e.overweight && <Badge label="HEAVY TAG" color="#9e6a03" />}
          <span style={{ ...mono, fontSize: '10px', color: '#484f58', marginLeft: 'auto' }}>
            {e.read_strength}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Conveyor health panel ─────────────────────────────────────────────────────

function ConveyorPanel({ belts, onJam, onClear, working }) {
  if (!belts?.length) return <Empty text="No conveyor data" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
      {belts.map(b => {
        const isJam   = b.jam
        const isFault = b.status === 'FAULT'
        const borderColor = isJam ? '#b22222' : isFault ? '#9e6a03' : '#30363d'
        const statusColor = isJam ? '#b22222' : isFault ? '#9e6a03' : '#238636'
        return (
          <div key={b.belt_id} style={{
            background: '#0d1117',
            border: `1px solid ${borderColor}`,
            borderLeft: `3px solid ${borderColor}`,
            borderRadius: '4px',
            padding: '8px',
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...mono, fontSize: '12px', fontWeight: 700, color: '#e6edf3' }}>
                {b.belt_id}
              </span>
              <span style={{ ...mono, fontSize: '10px', fontWeight: 600, color: statusColor }}>
                {b.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <MetricRow label="SPD" value={`${b.speed_mps} m/s`} dim={isJam} />
              <MetricRow label="LOAD" value={`${b.load_pct}%`} warn={b.load_pct > 85} dim={isJam} />
              <MetricRow label="TEMP" value={`${b.temp_c}°C`} warn={b.temp_c > 35} dim={isJam} />
            </div>

            <button
              onClick={() => isJam ? onClear(b.belt_id) : onJam(b.belt_id)}
              disabled={working}
              style={{
                marginTop: '4px',
                background: isJam ? '#238636' : '#3d1515',
                border: `1px solid ${isJam ? '#23863699' : '#b2222299'}`,
                borderRadius: '3px',
                color: isJam ? '#238636' : '#b22222',
                ...mono, fontSize: '10px', fontWeight: 600,
                padding: '3px 0', cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {isJam ? 'CLEAR JAM' : 'INJECT JAM'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

function MetricRow({ label, value, warn, dim }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ ...mono, fontSize: '9px', color: '#484f58', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ ...mono, fontSize: '10px', color: dim ? '#484f58' : warn ? '#9e6a03' : '#7d8590' }}>
        {value}
      </span>
    </div>
  )
}

function Empty({ text }) {
  return (
    <div style={{ ...mono, fontSize: '12px', color: '#484f58', padding: '12px 0' }}>{text}</div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHead({ label, badge, color = '#1f6feb' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span style={{
        ...mono, fontSize: '10px', fontWeight: 700,
        color, letterSpacing: '0.08em',
      }}>{label}</span>
      {badge && (
        <span style={{ ...mono, fontSize: '10px', color: '#7d8590' }}>{badge}</span>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function IntegrationsPanel() {
  const [data, setData]       = useState(null)
  const [working, setWorking] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const timerRef = useRef(null)

  const fetchData = () => {
    fetch(`${API}/integrations/live`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, 4000)
    return () => clearInterval(timerRef.current)
  }, [])

  const handleJam = async (beltId) => {
    setWorking(true)
    await fetch(`${API}/integrations/iot/jam/${beltId}`, { method: 'POST' }).catch(() => {})
    fetchData()
    setWorking(false)
  }

  const handleClear = async (beltId) => {
    setWorking(true)
    await fetch(`${API}/integrations/iot/clear/${beltId}`, { method: 'POST' }).catch(() => {})
    fetchData()
    setWorking(false)
  }

  const jammCount  = data?.conveyor_health?.filter(b => b.jam).length ?? 0
  const faultCount = data?.conveyor_health?.filter(b => b.status === 'FAULT').length ?? 0
  const alertCount = jammCount + faultCount

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
          {/* Plug icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M7 2v5M17 2v5M7 7h10l-1 8H8L7 7z" stroke="#484f58" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M10 15v5M14 15v5" stroke="#484f58" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="label-upper">Integrations</span>
          <span style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>
            DCS · ACRIS · IoT
          </span>
          {alertCount > 0 && (
            <span style={{ ...mono, fontSize: '10px', color: '#b22222', fontWeight: 600 }}>
              {alertCount} ALERT{alertCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
          {collapsed ? '▶ EXPAND' : '▼ COLLAPSE'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Row 1: Unified DCS + ACRIS table */}
          <div>
            <SectionHead label="DEPARTURE CONTROL · FLIGHT STATUS" badge="DCS + ACRIS" color="#1f6feb" />
            <FlightStatusPanel dcs={data?.dcs} acris={data?.acris} />
          </div>

          {/* Row 2: RFID live feed */}
          <div>
            <SectionHead
              label="RFID · LIVE SCAN FEED"
              badge={`${data?.rfid_events?.length ?? 0} recent reads`}
              color="#9e6a03"
            />
            <div style={{
              background: '#0d1117', border: '1px solid #21262d',
              borderRadius: '4px', padding: '8px 10px',
              maxHeight: '180px', overflowY: 'auto',
            }}>
              <RFIDPanel events={data?.rfid_events} />
            </div>
          </div>

          {/* Row 3: Conveyor health */}
          <div>
            <SectionHead
              label="CONVEYOR · BELT HEALTH"
              badge={jammCount > 0 ? `${jammCount} JAM${jammCount > 1 ? 'S' : ''}` : 'All belts nominal'}
              color={jammCount > 0 ? '#b22222' : '#238636'}
            />
            <ConveyorPanel
              belts={data?.conveyor_health}
              onJam={handleJam}
              onClear={handleClear}
              working={working}
            />
          </div>

        </div>
      )}
    </div>
  )
}
