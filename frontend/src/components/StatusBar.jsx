export default function StatusBar({ health }) {
  const online  = health?.online ?? true
  const pending = health?.pending_sync_count ?? 0

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 100,
    }}>
      {/* Left — project identity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontFamily: 'Inter',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#7d8590',
        }}>
          Swedavia · Baggage Operations
        </span>
        <span style={{
          fontFamily: 'Inter',
          fontSize: '13px',
          fontWeight: 600,
          color: '#e6edf3',
          letterSpacing: '0.01em',
        }}>
          Every Bag. Every Flight. Online or Not.
        </span>
      </div>

      {/* Right — connection status + pending count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="status-dot"
            style={{ background: online ? '#238636' : '#b22222' }}
          />
          <span style={{
            fontFamily: 'Inter',
            fontSize: '12px',
            color: online ? '#e6edf3' : '#b22222',
            fontWeight: 500,
          }}>
            {online
              ? 'ONLINE — Edge and Main in sync'
              : 'OFFLINE — Sync paused. Writing to edge only.'}
          </span>
        </div>

        {pending > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderLeft: '1px solid #30363d',
            paddingLeft: '16px',
          }}>
            <span style={{ color: '#7d8590', fontSize: '11px', letterSpacing: '0.06em' }}>
              PENDING
            </span>
            <span style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: '13px',
              color: '#9e6a03',
              fontWeight: 500,
            }}>
              {pending}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
