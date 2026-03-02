function NodeCard({ label, subtitle, count, adminPort }) {
  return (
    <div className="card" style={{ flex: 1, padding: '16px 20px' }}>
      <div className="label-upper" style={{ marginBottom: '8px' }}>{label}</div>
      <div style={{
        fontFamily: 'IBM Plex Mono',
        fontSize: '36px',
        fontWeight: 500,
        color: '#e6edf3',
        lineHeight: 1,
        marginBottom: '6px',
      }}>
        {count ?? '—'}
      </div>
      <div style={{ fontSize: '12px', color: '#7d8590', marginBottom: '12px' }}>{subtitle}</div>
      <a
        href={`http://localhost:${adminPort}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: 'IBM Plex Mono',
          fontSize: '11px',
          color: '#1f6feb',
          textDecoration: 'none',
          letterSpacing: '0.02em',
        }}
      >
        Open Admin UI →
      </a>
    </div>
  )
}

function SyncStatus({ health }) {
  if (!health) return null

  const { online, counts_in_sync, edge_doc_count, main_doc_count, pending_sync_count } = health
  const diff = Math.abs(edge_doc_count - main_doc_count)

  let text, color
  if (!online && !counts_in_sync) {
    text  = `OUT OF SYNC — ${diff} PENDING`
    color = '#b22222'
  } else if (online && !counts_in_sync) {
    text  = 'SYNCING...'
    color = '#1f6feb'
  } else {
    text  = 'IN SYNC'
    color = '#238636'
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '120px',
      padding: '0 12px',
      gap: '6px',
    }}>
      <div style={{ width: '1px', flex: 1, background: '#30363d' }} />
      <span style={{
        fontFamily: 'IBM Plex Mono',
        fontSize: '11px',
        fontWeight: 500,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}>
        {text}
      </span>
      <div style={{ width: '1px', flex: 1, background: '#30363d' }} />
    </div>
  )
}

export default function CouchbaseStats({ health }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="label-upper" style={{ marginBottom: '12px' }}>Couchbase Node Status</div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>
        <NodeCard
          label="Edge Node"
          subtitle="Airport / Always On"
          count={health?.edge_doc_count}
          adminPort={8091}
        />
        <SyncStatus health={health} />
        <NodeCard
          label="Main Server"
          subtitle="Central / Cloud"
          count={health?.main_doc_count}
          adminPort={8092}
        />
      </div>
    </div>
  )
}
