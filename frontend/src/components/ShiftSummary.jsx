/**
 * ShiftSummary — modal overlay with session/shift statistics.
 * Triggered by a button in the status bar or floating action.
 */
import { useState, useEffect } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

function eur(n) {
  return `€${Number(n ?? 0).toLocaleString('en-EU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Stat({ label, value, sub, color = '#e6edf3' }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d', borderRadius: '4px',
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '3px',
    }}>
      <span style={{ ...mono, fontSize: '9px', color: '#484f58', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ ...mono, fontSize: '22px', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ ...mono, fontSize: '10px', color: '#7d8590' }}>{sub}</span>}
    </div>
  )
}

function SLARow({ label, met, actual, target, unit = '%' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #21262d' }}>
      <span style={{ ...mono, fontSize: '11px', color: '#7d8590' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ ...mono, fontSize: '12px', fontWeight: 600, color: met ? '#238636' : '#b22222' }}>
          {actual}{unit}
        </span>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>/ {target}{unit} target</span>
        <span style={{
          ...mono, fontSize: '9px', fontWeight: 700,
          color: met ? '#238636' : '#b22222',
          border: `1px solid ${met ? '#23863666' : '#b2222266'}`,
          borderRadius: '3px', padding: '1px 5px',
        }}>
          {met ? 'MET' : 'BREACH'}
        </span>
      </div>
    </div>
  )
}

export default function ShiftSummary({ open, onClose }) {
  const [summary, setSummary] = useState(null)
  const [roi,     setRoi]     = useState(null)

  useEffect(() => {
    if (!open) return
    fetch(`${API}/analytics/summary`).then(r => r.json()).then(setSummary).catch(() => {})
    fetch(`${API}/analytics/roi`).then(r => r.json()).then(setRoi).catch(() => {})
  }, [open])

  if (!open) return null

  const s = summary
  const sessionMin = s ? Math.round(s.session_sec / 60) : 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: '#0d111799',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: '8px',
        width: '640px', maxHeight: '80vh', overflowY: 'auto',
        padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="label-upper" style={{ marginBottom: '4px' }}>Shift Summary</div>
            <div style={{ ...mono, fontSize: '12px', color: '#7d8590' }}>
              Session duration: {sessionMin}m · {new Date().toLocaleString('sv-SE')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid #30363d', borderRadius: '3px',
            ...mono, fontSize: '12px', color: '#7d8590', padding: '4px 10px', cursor: 'pointer',
          }}>✕ CLOSE</button>
        </div>

        {/* KPI grid */}
        {s && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <Stat label="BAGS PROCESSED" value={s.total_bags} sub={`${s.delivered_bags} delivered`} color="#1f6feb" />
            <Stat label="SYSTEM UPTIME" value={`${s.uptime_pct}%`} sub={`${s.total_outage_sec}s downtime`} color={s.uptime_pct >= 99.5 ? '#238636' : '#b22222'} />
            <Stat label="MISROUTE INCIDENTS" value={s.misroute_incidents} sub={`${s.misroute_rate_pct}% rate`} color={s.misroute_incidents > 0 ? '#b22222' : '#238636'} />
            <Stat label="BAGS OFFLINE" value={s.total_bags_offline} sub={`during ${s.outage_count} outage(s)`} color="#9e6a03" />
            <Stat label="THROUGHPUT PEAK" value={`${s.throughput_per_min}/min`} sub="bags per minute" color="#1f6feb" />
            <Stat label="TOTAL SAVINGS" value={eur(roi?.total_savings_eur)} sub="estimated session ROI" color="#238636" />
          </div>
        )}

        {/* SLA compliance */}
        {s && (
          <div>
            <div style={{ ...mono, fontSize: '10px', color: '#484f58', letterSpacing: '0.07em', marginBottom: '8px' }}>
              SLA COMPLIANCE
            </div>
            <SLARow label="Uptime SLA" met={s.sla.uptime_met} actual={s.sla.uptime_actual} target={s.sla.uptime_target} />
            <SLARow label="Throughput SLA" met={s.sla.throughput_met} actual={s.sla.throughput_actual} target={s.sla.throughput_target} unit=" bags/min" />
            <SLARow label="Misrouting Rate" met={s.sla.misroute_met} actual={s.sla.misroute_actual} target={s.sla.misroute_target} />
          </div>
        )}

        {/* Cost savings breakdown */}
        {roi && (
          <div>
            <div style={{ ...mono, fontSize: '10px', color: '#484f58', letterSpacing: '0.07em', marginBottom: '8px' }}>
              COST SAVINGS BREAKDOWN
            </div>
            {roi.breakdown.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid #21262d',
              }}>
                <div>
                  <div style={{ ...mono, fontSize: '11px', color: '#e6edf3' }}>{item.label}</div>
                  <div style={{ ...mono, fontSize: '10px', color: '#484f58' }}>{item.description}</div>
                </div>
                <span style={{ ...mono, fontSize: '13px', fontWeight: 700, color: '#238636' }}>
                  {eur(item.savings_eur)}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: '10px', marginTop: '4px',
            }}>
              <span style={{ ...mono, fontSize: '12px', color: '#7d8590', letterSpacing: '0.05em' }}>
                TOTAL ESTIMATED SAVINGS
              </span>
              <span style={{ ...mono, fontSize: '22px', fontWeight: 700, color: '#238636' }}>
                {eur(roi.total_savings_eur)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
