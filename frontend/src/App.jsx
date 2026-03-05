import { useState, useCallback } from 'react'
import StatusBar           from './components/StatusBar.jsx'
import ThroughputChart     from './components/ThroughputChart.jsx'
import FlightBoard         from './components/FlightBoard.jsx'
import FlightCountdown     from './components/FlightCountdown.jsx'
import SimulationControls  from './components/SimulationControls.jsx'
import BaggageTable        from './components/BaggageTable.jsx'
import BeltHeatmap         from './components/BeltHeatmap.jsx'
import DigitalTwin         from './components/DigitalTwin.jsx'
import ROIDashboard        from './components/ROIDashboard.jsx'
import IntegrationsPanel   from './components/IntegrationsPanel.jsx'
import AuditLog            from './components/AuditLog.jsx'
import AlertRail           from './components/AlertRail.jsx'
import ShiftSummary               from './components/ShiftSummary.jsx'
import HybridArchitectureStatus   from './components/HybridArchitectureStatus.jsx'
import { useHealth }              from './hooks/useHealth.js'

const TABS = [
  { id: 'ops',     label: 'LIVE OPS',     desc: 'Simulation & real-time sync' },
  { id: 'baggage', label: 'BAGGAGE HALL', desc: 'Bag registry' },
  { id: 'system',  label: 'SYSTEM',       desc: 'Digital twin, integrations & audit log' },
]

export default function App() {
  const { health, error } = useHealth(3000)
  const [alertOpen,   setAlertOpen]   = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [roiOpen,     setRoiOpen]     = useState(false)
  const [activeTab,   setActiveTab]   = useState('ops')


  const refresh = useCallback(() => {}, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#e6edf3',
      padding: '0',
      margin: '0',
      marginRight: alertOpen ? '276px' : '0',
      transition: 'margin-right 0.2s ease',
    }}>
      {/* ── Fixed header ── */}
      <StatusBar health={health} />

      {/* ── Fixed tab bar ── */}
      <div style={{
        position: 'fixed',
        top: '64px',
        left: 0,
        right: alertOpen ? '276px' : 0,
        height: '40px',
        background: '#0d1117',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'stretch',
        paddingLeft: '24px',
        gap: '0',
        zIndex: 90,
        transition: 'right 0.2s ease',
      }}>
        {TABS.map(tab => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid #388bfd' : '2px solid transparent',
                color: active ? '#e6edf3' : '#484f58',
                fontFamily: 'IBM Plex Mono',
                fontSize: '11px',
                fontWeight: active ? 700 : 400,
                letterSpacing: '0.08em',
                padding: '0 20px',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#7d8590' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#484f58' }}
            >
              {tab.label}
            </button>
          )
        })}

        {/* Active tab descriptor */}
        <span style={{
          fontFamily: 'IBM Plex Mono',
          fontSize: '10px',
          color: '#30363d',
          alignSelf: 'center',
          paddingLeft: '16px',
          letterSpacing: '0.04em',
        }}>
          {TABS.find(t => t.id === activeTab)?.desc}
        </span>
      </div>

      {/* ── Modals ── */}
      <AlertRail health={health} open={alertOpen} onToggle={() => setAlertOpen(o => !o)} />
      <ShiftSummary open={summaryOpen} onClose={() => setSummaryOpen(false)} />

      {roiOpen && (
        <div
          onClick={() => setRoiOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: '#0d111799',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(900px, 92vw)', maxHeight: '85vh', overflowY: 'auto', borderRadius: '8px' }}
          >
            <ROIDashboard onClose={() => setRoiOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      <div style={{
        paddingTop: '104px',   /* 64px header + 40px tab bar */
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingBottom: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>

        {error && (
          <div style={{
            background: '#3d1515', border: '1px solid #b22222',
            borderRadius: '4px', padding: '8px 14px',
            fontSize: '12px', fontFamily: 'IBM Plex Mono', color: '#b22222',
          }}>
            Backend unreachable: {error} — is docker-compose running?
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB 1 — LIVE OPS
        ══════════════════════════════════════════════ */}
        {activeTab === 'ops' && (
          <>
            {/* Flight countdown strip */}
            <FlightCountdown />

            {/* Hybrid architecture + Throughput */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
              <HybridArchitectureStatus isCloudOnline={health?.online ?? false} health={health} />
              <ThroughputChart health={health} />
            </div>

            {/* FlightBoard + SimulationControls */}
            <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: '16px' }}>
              <div style={{ minHeight: '260px' }}>
                <FlightBoard />
              </div>
              <div style={{ minHeight: '260px' }}>
                <SimulationControls health={health} onHealthChange={refresh} />
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2 — BAGGAGE HALL
        ══════════════════════════════════════════════ */}
        {activeTab === 'baggage' && (
          <>
            <BaggageTable />
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB 3 — SYSTEM
        ══════════════════════════════════════════════ */}
        {activeTab === 'system' && (
          <>
            <DigitalTwin />
            <BeltHeatmap />
            <IntegrationsPanel />
            <AuditLog />
          </>
        )}

        <div style={{
          textAlign: 'center', fontSize: '11px',
          color: '#30363d', fontFamily: 'IBM Plex Mono', paddingTop: '8px',
        }}>
          Swedavia Resilient Baggage Operations · Hackathon Demo ·{' '}
          Edge: localhost:8091 · Main: localhost:8092 · SGW: localhost:4984
        </div>
      </div>
    </div>
  )
}
