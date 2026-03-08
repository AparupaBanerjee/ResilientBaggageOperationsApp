import { useState, useCallback } from 'react'
import StatusBar           from './components/StatusBar.jsx'
import FlightBoard         from './components/FlightBoard.jsx'

import SimulationControls  from './components/SimulationControls.jsx'
import BeltHeatmap         from './components/BeltHeatmap.jsx'
import DigitalTwin         from './components/DigitalTwin.jsx'
import ROIDashboard        from './components/ROIDashboard.jsx'
import IntegrationsPanel   from './components/IntegrationsPanel.jsx'
import AuditLog            from './components/AuditLog.jsx'
import AlertRail           from './components/AlertRail.jsx'
import ShiftSummary               from './components/ShiftSummary.jsx'
import PassengerBoard             from './components/PassengerBoard.jsx'
import WorkstationView            from './components/WorkstationView.jsx'
import ConveyorScreeningPanel     from './components/ConveyorScreeningPanel.jsx'
import SplitBrainPanel           from './components/SplitBrainPanel.jsx'
import ThroughputChart          from './components/ThroughputChart.jsx'
import BaggageKPIBar            from './components/BaggageKPIBar.jsx'
import BaggageTable             from './components/BaggageTable.jsx'
import { useHealth }              from './hooks/useHealth.js'

export default function App() {
  const { health, error } = useHealth(3000)
  const [alertOpen,   setAlertOpen]   = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [roiOpen,     setRoiOpen]     = useState(false)
  const [simOpen,     setSimOpen]     = useState(false)
  const [activeTab,   setActiveTab]   = useState('ops')

  const refresh = useCallback(() => {}, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#e6edf3',
      padding: '0',
      margin: '0',
      marginLeft: simOpen ? '300px' : '0',
      marginRight: alertOpen ? '276px' : '0',
      transition: 'margin-left 0.2s ease, margin-right 0.2s ease',
    }}>
      {/* ── Fixed header with tabs ── */}
      <StatusBar health={health} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Persistent overlays (any tab) ── */}
      <SimulationControls health={health} onHealthChange={refresh} open={simOpen} onToggle={() => setSimOpen(o => !o)} />
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
        paddingTop: '74px',   /* 64px header + 10px breathing room */
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
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
            <BaggageKPIBar />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px', alignItems: 'stretch' }}>
              <ThroughputChart health={health} />
              <SplitBrainPanel isCloudOnline={health?.online ?? false} health={health} />
            </div>

            {/* FlightBoard + ConveyorScreeningPanel side by side, same height */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', alignItems: 'stretch' }}>
              <FlightBoard />
              <ConveyorScreeningPanel />
            </div>
            <BeltHeatmap />
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2 — BAGGAGE HALL
        ══════════════════════════════════════════════ */}
        {activeTab === 'baggage' && (
          <>
            <PassengerBoard />
            <BaggageTable />
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB 3 — WORKSTATIONS
        ══════════════════════════════════════════════ */}
        {activeTab === 'workstations' && (
          <WorkstationView health={health} />
        )}

        {/* ══════════════════════════════════════════════
            TAB 4 — SYSTEM
        ══════════════════════════════════════════════ */}
        {activeTab === 'system' && (
          <>
            <DigitalTwin />
            <IntegrationsPanel />
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB 5 — AUDIT
        ══════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <AuditLog />
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
