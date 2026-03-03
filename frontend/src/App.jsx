import { useCallback } from 'react'
import StatusBar           from './components/StatusBar.jsx'
import CouchbaseStats      from './components/CouchbaseStats.jsx'
import FlightBoard         from './components/FlightBoard.jsx'
import SimulationControls  from './components/SimulationControls.jsx'
import BaggageTable        from './components/BaggageTable.jsx'
import { useHealth }       from './hooks/useHealth.js'

export default function App() {
  const { health, error } = useHealth(3000)

  // Force an immediate health refresh (called after simulation actions)
  const refresh = useCallback(() => {
    // Health hook polls on its own; no action needed but useful as a callback hook
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#e6edf3',
      padding: '0',
      margin: '0',
    }}>
      {/* Fixed status bar */}
      <StatusBar health={health} />

      {/* Content — starts below the 44px status bar */}
      <div style={{
        paddingTop: '56px',
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>

        {/* Connection error banner */}
        {error && (
          <div style={{
            background: '#3d1515',
            border: '1px solid #b22222',
            borderRadius: '4px',
            padding: '8px 14px',
            fontSize: '12px',
            fontFamily: 'IBM Plex Mono',
            color: '#b22222',
          }}>
            Backend unreachable: {error} — is docker-compose running?
          </div>
        )}

        {/* Couchbase node counts — key demo component */}
        <CouchbaseStats health={health} />

        {/* Two-column middle row */}
        <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: '16px' }}>
          <div style={{ minHeight: '260px' }}>
            <FlightBoard />
          </div>
          <div style={{ minHeight: '260px' }}>
            <SimulationControls health={health} onHealthChange={refresh} />
          </div>
        </div>

        {/* Baggage table — full width */}
        <BaggageTable />

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          fontSize: '11px',
          color: '#484f58',
          fontFamily: 'IBM Plex Mono',
          paddingTop: '8px',
        }}>
          Swedavia Resilient Baggage Operations · Hackathon Demo ·{' '}
          Edge: localhost:8091 · Main: localhost:8092 · SGW: localhost:4984
        </div>
      </div>
    </div>
  )
}
