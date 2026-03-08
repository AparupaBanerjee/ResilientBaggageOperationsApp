export default function CouchbaseStats({ health, syncEta }) {
  if (!health) return null

  const {
    online,
    counts_in_sync,
    edge_doc_count,
    main_doc_count,
  } = health

  const throughput = health.throughput_per_min ?? 0
  const pending    = health.pending_sync_count  ?? 0
  const diff       = Math.abs((edge_doc_count ?? 0) - (main_doc_count ?? 0))

  // Sync state
  let syncLabel, syncColor, syncBg, pulse
  if (!online && !counts_in_sync) {
    syncLabel = 'OUT OF SYNC'
    syncColor = '#f85149'
    syncBg    = '#3d1515'
    pulse     = true
  } else if (online && !counts_in_sync) {
    syncLabel = 'SYNCING'
    syncColor = '#388bfd'
    syncBg    = '#0d1f38'
    pulse     = true
  } else {
    syncLabel = 'IN SYNC'
    syncColor = '#3fb950'
    syncBg    = '#0d2a18'
    pulse     = false
  }

  const dot = (color, animated) => (
    <span style={{
      display: 'inline-block',
      width: '6px', height: '6px',
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
      animation: animated ? 'pulse 1.4s ease-in-out infinite' : 'none',
    }} />
  )

  const seg = { width: '1px', height: '18px', background: '#21262d', flexShrink: 0 }

  return (
    <>
      {/* Pulse keyframe injected once */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center',
        gap: '0',
        height: '40px',
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '6px',
        padding: '0 4px',
        fontFamily: 'IBM Plex Mono',
        fontSize: '11px',
        overflow: 'hidden',
      }}>

        {/* ── Label ─────────────────────────────────────────── */}
        <span style={{
          padding: '0 14px',
          fontSize: '9px', letterSpacing: '0.12em',
          color: '#484f58', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          CB Nodes
        </span>
        <div style={seg} />

        {/* ── Edge node ─────────────────────────────────────── */}
        <a
          href="http://localhost:8091"
          target="_blank" rel="noopener noreferrer"
          title="Open Edge Admin UI"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '0 14px', textDecoration: 'none', color: 'inherit',
          }}
        >
          {dot('#3fb950', false)}
          <span style={{ color: '#7d8590', fontSize: '9px', letterSpacing: '0.1em' }}>EDGE</span>
          <span style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>
            {edge_doc_count ?? '—'}
          </span>
          <span style={{ color: '#484f58', fontSize: '9px' }}>docs</span>
        </a>

        {/* ── Sync badge (centre) ───────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '24px', height: '1px', background: '#21262d' }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: syncBg, border: `1px solid ${syncColor}22`,
            borderRadius: '20px', padding: '2px 10px',
          }}>
            {dot(syncColor, pulse)}
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em',
              color: syncColor, whiteSpace: 'nowrap',
            }}>
              {syncLabel}
              {syncLabel === 'SYNCING' && syncEta != null ? ` ~${syncEta}s` : ''}
              {syncLabel === 'OUT OF SYNC' && diff > 0 ? ` · ${diff}Δ` : ''}
            </span>
          </div>
          <div style={{ width: '24px', height: '1px', background: '#21262d' }} />
        </div>

        {/* ── Main node ─────────────────────────────────────── */}
        <a
          href="http://localhost:8092"
          target="_blank" rel="noopener noreferrer"
          title="Open Main Admin UI"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '0 14px', textDecoration: 'none', color: 'inherit',
          }}
        >
          <span style={{ color: '#484f58', fontSize: '9px' }}>docs</span>
          <span style={{ color: '#e6edf3', fontSize: '13px', fontWeight: 600 }}>
            {main_doc_count ?? '—'}
          </span>
          <span style={{ color: '#7d8590', fontSize: '9px', letterSpacing: '0.1em' }}>MAIN</span>
          {dot('#3fb950', false)}
        </a>

        {/* ── Throughput ─────────────────────────────────────── */}
        <div style={seg} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '0 14px',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#484f58" strokeWidth="2" strokeLinecap="round">
            <polyline points="13 2 13 9 22 9"/><polyline points="11 22 11 15 2 15"/>
            <line x1="22" y1="9" x2="2" y2="15"/>
          </svg>
          <span style={{ color: throughput > 0 ? '#3fb950' : '#484f58', fontWeight: 600, fontSize: '12px' }}>
            {throughput}
          </span>
          <span style={{ color: '#484f58', fontSize: '9px' }}>bags/min</span>
        </div>

        {/* ── Pending (only if >0) ───────────────────────────── */}
        {pending > 0 && (
          <>
            <div style={seg} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '0 14px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9e6a03" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span style={{ color: '#9e6a03', fontWeight: 600, fontSize: '12px' }}>{pending}</span>
              <span style={{ color: '#484f58', fontSize: '9px' }}>queued</span>
            </div>
          </>
        )}

        {/* ── SGW link ──────────────────────────────────────── */}
        <div style={{ marginLeft: 'auto', paddingRight: '12px' }}>
          <a
            href="http://localhost:4984"
            target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: '9px', color: '#484f58', textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => e.target.style.color = '#7d8590'}
            onMouseLeave={e => e.target.style.color = '#484f58'}
          >
            SGW →
          </a>
        </div>

      </div>
    </>
  )
}
