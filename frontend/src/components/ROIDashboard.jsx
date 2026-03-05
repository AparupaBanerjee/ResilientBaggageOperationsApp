import { useState, useEffect, useRef } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }
const sans = { fontFamily: 'Inter' }

// ── helpers ───────────────────────────────────────────────────────────────────

function eur(n) {
  return `€${Number(n ?? 0).toLocaleString('en-EU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTs(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('sv-SE', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function KPITile({ label, value, sub, color = '#e6edf3', warn }) {
  return (
    <div style={{
      background: '#0d1117',
      border: `1px solid ${warn ? '#b2222233' : '#21262d'}`,
      borderLeft: `3px solid ${warn ? '#b22222' : color}`,
      borderRadius: '4px',
      padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: '4px',
      flex: 1,
    }}>
      <span style={{ ...mono, fontSize: '9px', color: '#484f58', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ ...mono, fontSize: '26px', fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ ...mono, fontSize: '10px', color: '#7d8590' }}>{sub}</span>
      )}
    </div>
  )
}

// ── SLA bar ───────────────────────────────────────────────────────────────────

function SLABar({ label, actual, target, unit = '%', invert = false, formatVal }) {
  // invert=true means lower is better (e.g. misroute rate)
  const met   = invert ? actual <= target : actual >= target
  const color = met ? '#238636' : '#b22222'
  const pct   = invert
    ? Math.min(100, (target / Math.max(actual, 0.01)) * 100)
    : Math.min(100, (actual / target) * 100)
  const display = formatVal ? formatVal(actual) : `${actual}${unit}`
  const targetDisplay = formatVal ? formatVal(target) : `${target}${unit}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ ...mono, fontSize: '10px', color: '#7d8590', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ ...mono, fontSize: '13px', fontWeight: 700, color }}>
            {display}
          </span>
          <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
            / {targetDisplay} target
          </span>
          <span style={{
            ...mono, fontSize: '9px', fontWeight: 700,
            color: met ? '#238636' : '#b22222',
            border: `1px solid ${met ? '#23863666' : '#b2222266'}`,
            borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.05em',
          }}>
            {met ? 'MET' : 'BREACH'}
          </span>
        </div>
      </div>
      <div style={{ height: '4px', background: '#21262d', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color,
          borderRadius: '2px',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ── Outage row ────────────────────────────────────────────────────────────────

function OutageTable({ outages }) {
  if (!outages?.length) {
    return (
      <div style={{ ...mono, fontSize: '12px', color: '#484f58', padding: '12px 0' }}>
        No outage events recorded. Use "Simulate Outage" then "Restore Connection" to generate data.
      </div>
    )
  }
  return (
    <table className="ops-table">
      <thead>
        <tr>
          <th>Started</th><th>Ended</th><th>Duration</th>
          <th>Bags Offline</th><th>Operator</th><th>Recovery Est.</th>
        </tr>
      </thead>
      <tbody>
        {outages.map((e, i) => (
          <tr key={i}>
            <td style={{ ...mono, fontSize: '11px', color: '#7d8590', whiteSpace: 'nowrap' }}>
              {formatTs(e.started_at)}
            </td>
            <td style={{ ...mono, fontSize: '11px', color: '#7d8590', whiteSpace: 'nowrap' }}>
              {formatTs(e.ended_at)}
            </td>
            <td>
              <span style={{ ...mono, fontSize: '11px', fontWeight: 600, color: '#b22222' }}>
                {e.duration_label ?? `${e.duration_sec}s`}
              </span>
            </td>
            <td style={{ ...mono, fontSize: '11px', color: '#9e6a03', fontWeight: 600 }}>
              {e.bags_offline ?? 0}
            </td>
            <td style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>
              {e.operator ?? 'anonymous'}
            </td>
            <td>
              <span style={{
                ...mono, fontSize: '10px', color: '#238636',
                border: '1px solid #23863666', borderRadius: '3px', padding: '1px 5px',
              }}>
                RECOVERED
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Cost savings card ─────────────────────────────────────────────────────────

const ICON_COLORS = {
  MISROUTE:   '#b22222',
  OFFLINE:    '#9e6a03',
  RECOVERY:   '#1f6feb',
  EFFICIENCY: '#238636',
}
const ICON_LABELS = {
  MISROUTE:   'MIS',
  OFFLINE:    'OFF',
  RECOVERY:   'REC',
  EFFICIENCY: 'EFF',
}

function SavingsCard({ item }) {
  const color = ICON_COLORS[item.icon] ?? '#7d8590'
  return (
    <div style={{
      background: '#0d1117',
      border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '4px',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '4px',
      flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...mono, fontSize: '9px', color: '#484f58', letterSpacing: '0.08em' }}>
          {item.label.toUpperCase()}
        </span>
        <span style={{
          ...mono, fontSize: '9px', fontWeight: 700,
          color, border: `1px solid ${color}66`,
          borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.05em',
        }}>
          {ICON_LABELS[item.icon]}
        </span>
      </div>
      <span style={{ ...mono, fontSize: '22px', fontWeight: 700, color: '#238636', lineHeight: 1 }}>
        {eur(item.savings_eur)}
      </span>
      <span style={{ ...mono, fontSize: '10px', color: '#7d8590' }}>
        {item.description}
      </span>
    </div>
  )
}

// ── Assumptions tooltip ───────────────────────────────────────────────────────

function Assumptions({ data }) {
  const [open, setOpen] = useState(false)
  if (!data) return null
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: '1px solid #30363d', borderRadius: '3px',
          ...mono, fontSize: '10px', color: '#484f58', padding: '2px 8px',
          cursor: 'pointer', letterSpacing: '0.04em',
        }}
      >
        {open ? '▲ ASSUMPTIONS' : '▼ ASSUMPTIONS'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          background: '#161b22', border: '1px solid #30363d', borderRadius: '4px',
          padding: '10px 12px', zIndex: 10, minWidth: '260px',
          display: 'flex', flexDirection: 'column', gap: '5px',
        }}>
          {Object.entries(data).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
                {k.replace(/_/g, ' ')}
              </span>
              <span style={{ ...mono, fontSize: '10px', color: '#e6edf3' }}>
                {typeof v === 'number' ? eur(v) : v}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ROIDashboard({ onClose }) {
  const [summary,  setSummary]  = useState(null)
  const [outages,  setOutages]  = useState([])
  const [roi,      setRoi]      = useState(null)
  const timerRef = useRef(null)

  const fetchAll = () => {
    fetch(`${API}/analytics/summary`).then(r => r.json()).then(setSummary).catch(() => {})
    fetch(`${API}/analytics/outages`).then(r => r.json()).then(setOutages).catch(() => {})
    fetch(`${API}/analytics/roi`).then(r => r.json()).then(setRoi).catch(() => {})
  }

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(fetchAll, 8000)
    return () => clearInterval(timerRef.current)
  }, [])

  const uptimeMet    = summary?.sla?.uptime_met
  const totalSavings = roi?.total_savings_eur ?? 0

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="12" width="4" height="9" rx="1" stroke="#484f58" strokeWidth="1.5"/>
            <rect x="10" y="7" width="4" height="14" rx="1" stroke="#484f58" strokeWidth="1.5"/>
            <rect x="17" y="3" width="4" height="18" rx="1" stroke="#484f58" strokeWidth="1.5"/>
          </svg>
          <span className="label-upper">ROI Dashboard</span>
          <span style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>Metrics · SLA · Savings</span>
          {totalSavings > 0 && (
            <span style={{ ...mono, fontSize: '11px', color: '#238636', fontWeight: 700 }}>
              {eur(totalSavings)} SAVED
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #30363d', borderRadius: '4px',
            color: '#484f58', cursor: 'pointer', padding: '3px 8px',
            ...mono, fontSize: '11px', letterSpacing: '0.04em',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#484f58'; e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#484f58' }}
        >
          ✕ CLOSE
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── KPI row ─────────────────────────────────────────────────── */}
          <div>
            <div style={{ ...mono, fontSize: '10px', color: '#484f58', letterSpacing: '0.07em', marginBottom: '8px' }}>
              KEY PERFORMANCE INDICATORS
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <KPITile
                label="BAGS PROCESSED"
                value={summary?.total_bags ?? '—'}
                sub={`${summary?.delivered_bags ?? 0} delivered`}
                color="#1f6feb"
              />
              <KPITile
                label="SYSTEM UPTIME"
                value={summary?.uptime_pct != null ? `${summary.uptime_pct}%` : '—'}
                sub={`${summary?.total_outage_sec ?? 0}s total outage`}
                color={uptimeMet === false ? '#b22222' : '#238636'}
                warn={uptimeMet === false}
              />
              <KPITile
                label="MISROUTE INCIDENTS"
                value={summary?.misroute_incidents ?? '—'}
                sub={`${summary?.misroute_rate_pct ?? 0}% of bags`}
                color={summary?.misroute_incidents > 0 ? '#b22222' : '#238636'}
                warn={summary?.misroute_incidents > 0}
              />
              <KPITile
                label="BAGS SAVED OFFLINE"
                value={summary?.total_bags_offline ?? '—'}
                sub={`across ${summary?.outage_count ?? 0} outage(s)`}
                color="#9e6a03"
              />
              <KPITile
                label="THROUGHPUT"
                value={`${summary?.throughput_per_min ?? 0}/min`}
                sub={`target: ${20}/min`}
                color="#1f6feb"
              />
            </div>
          </div>

          {/* ── SLA tracking ────────────────────────────────────────────── */}
          <div>
            <div style={{ ...mono, fontSize: '10px', color: '#484f58', letterSpacing: '0.07em', marginBottom: '10px' }}>
              SLA COMPLIANCE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SLABar
                label="UPTIME SLA"
                actual={summary?.sla?.uptime_actual ?? 100}
                target={summary?.sla?.uptime_target ?? 99.5}
                unit="%"
              />
              <SLABar
                label="THROUGHPUT SLA"
                actual={summary?.sla?.throughput_actual ?? 0}
                target={summary?.sla?.throughput_target ?? 20}
                unit=" bags/min"
              />
              <SLABar
                label="MISROUTING RATE"
                actual={summary?.sla?.misroute_actual ?? 0}
                target={summary?.sla?.misroute_target ?? 0.5}
                unit="%"
                invert
              />
            </div>
          </div>

          {/* ── Outage recovery timeline ─────────────────────────────────── */}
          <div>
            <div style={{
              ...mono, fontSize: '10px', color: '#484f58', letterSpacing: '0.07em',
              marginBottom: '8px', display: 'flex', justifyContent: 'space-between',
            }}>
              <span>OUTAGE RECOVERY ANALYTICS</span>
              <span style={{ color: '#7d8590' }}>
                {outages.length} EVENT{outages.length !== 1 ? 'S' : ''}
              </span>
            </div>
            <OutageTable outages={outages} />
          </div>

          {/* ── Cost savings ─────────────────────────────────────────────── */}
          <div>
            <div style={{
              ...mono, fontSize: '10px', color: '#484f58', letterSpacing: '0.07em',
              marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>ESTIMATED COST SAVINGS</span>
              <Assumptions data={roi?.assumptions} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              {(roi?.breakdown ?? []).map((item, i) => (
                <SavingsCard key={i} item={item} />
              ))}
            </div>
            {roi && (
              <div style={{
                background: '#0d1117',
                border: '1px solid #23863633',
                borderLeft: '3px solid #238636',
                borderRadius: '4px',
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ ...mono, fontSize: '11px', color: '#7d8590', letterSpacing: '0.05em' }}>
                  TOTAL ESTIMATED SAVINGS THIS SESSION
                </span>
                <span style={{ ...mono, fontSize: '28px', fontWeight: 700, color: '#238636' }}>
                  {eur(roi.total_savings_eur)}
                </span>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
