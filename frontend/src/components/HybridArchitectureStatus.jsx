import { Server, Cloud, CloudOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HybridArchitectureStatus({ isCloudOnline, health }) {
  const edgeDocs = health?.edge_bag_count  ?? '—'
  const mainDocs = health?.main_bag_count  ?? '—'
  const inSync   = health?.counts_in_sync  ?? true
  const pending  = health?.pending_sync_count ?? 0

  const footerMsg = !isCloudOnline
    ? 'Local node handling routing autonomously — data queued for sync'
    : inSync
      ? 'All baggage data syncing to cloud analytics in real-time'
      : `${pending} doc(s) pending sync — Edge ahead of Main`

  return (
    <div className="card" style={{ padding: '14px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span className="label-upper" style={{ letterSpacing: '0.12em' }}>Hybrid Architecture</span>
        <motion.span
          key={isCloudOnline ? 'on' : 'off'}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '3px',
            background: isCloudOnline ? '#0d2a18' : '#3d1515',
            color:      isCloudOnline ? '#3fb950' : '#f85149',
            border:     `1px solid ${isCloudOnline ? '#238636' : '#b22222'}`,
          }}
        >
          {isCloudOnline ? '● LIVE SYNC' : '● DISCONNECTED'}
        </motion.span>
      </div>

      {/* Node grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>

        {/* ── LOCAL NODE ── */}
        <div style={{
          background: '#0a1f0f',
          border: '1px solid #238636',
          borderRadius: '8px',
          padding: '16px 14px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          boxShadow: '0 0 16px 2px rgba(35,134,54,0.12)',
          position: 'relative',
        }}>
          {/* Live pulse */}
          <span style={{ position: 'absolute', top: '10px', right: '10px' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </span>

          {/* Icon */}
          <div style={{
            background: 'rgba(35,134,54,0.15)', border: '1px solid rgba(35,134,54,0.3)',
            borderRadius: '8px', padding: '10px',
          }}>
            <Server size={24} color="#3fb950" />
          </div>

          {/* Labels */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700, color: '#3fb950', letterSpacing: '0.1em', marginBottom: '2px' }}>
              LOCAL NODE
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590' }}>
              Edge · ARN
            </div>
          </div>

          {/* Bag count */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '22px', fontWeight: 700, color: '#3fb950', lineHeight: 1 }}>
              {edgeDocs}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', marginLeft: '4px' }}>bags</span>
          </div>

          {/* Status badge */}
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
            color: '#3fb950', letterSpacing: '0.1em',
            background: '#0d2a18', border: '1px solid #238636',
            borderRadius: '20px', padding: '2px 10px',
          }}>
            ◎ OPERATIONAL
          </div>
        </div>

        {/* ── SYNC BRIDGE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '0 4px' }}>
          <AnimatePresence mode="wait">
            {isCloudOnline ? (
              <motion.div key="on"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <motion.div animate={{ x: [0, -4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '16px', color: '#22d3ee' }}>←</span>
                </motion.div>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '16px', color: '#22d3ee' }}>→</span>
                </motion.div>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                  color: '#22d3ee', letterSpacing: '0.12em',
                  marginTop: '2px',
                }}>SYNC</span>
              </motion.div>
            ) : (
              <motion.div key="off"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '16px', color: '#4a1515', opacity: 0.5 }}>←</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '16px', color: '#4a1515', opacity: 0.5 }}>→</span>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                  color: '#f85149', letterSpacing: '0.1em', marginTop: '2px',
                }}>OFF</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CLOUD ANALYTICS ── */}
        <div style={{
          background: isCloudOnline ? '#071e26' : '#1a0d0d',
          border: `1px solid ${isCloudOnline ? 'rgba(34,211,238,0.5)' : '#4a1515'}`,
          borderRadius: '8px',
          padding: '16px 14px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          boxShadow: isCloudOnline ? '0 0 16px 2px rgba(34,211,238,0.10)' : 'none',
          opacity: isCloudOnline ? 1 : 0.6,
          transition: 'opacity 0.3s',
          position: 'relative',
        }}>
          {/* Status dot */}
          <span style={{ position: 'absolute', top: '10px', right: '10px' }}>
            {isCloudOnline ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-red-800" />
            )}
          </span>

          {/* Icon */}
          <div style={{
            background: isCloudOnline ? 'rgba(34,211,238,0.1)' : 'rgba(248,81,73,0.08)',
            border: isCloudOnline ? '1px solid rgba(34,211,238,0.25)' : '1px solid rgba(248,81,73,0.2)',
            borderRadius: '8px', padding: '10px',
            transition: 'all 0.3s',
          }}>
            {isCloudOnline
              ? <Cloud size={24} color="#22d3ee" />
              : <CloudOff size={24} color="#b22222" />
            }
          </div>

          {/* Labels */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
              color: isCloudOnline ? '#22d3ee' : '#6b3333',
              letterSpacing: '0.1em', marginBottom: '2px',
            }}>
              CLOUD ANALYTICS
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590' }}>
              {isCloudOnline ? 'Connected' : 'Unavailable'}
            </div>
          </div>

          {/* Bag count */}
          <div style={{ textAlign: 'center' }}>
            <span style={{
              fontFamily: 'IBM Plex Mono', fontSize: '22px', fontWeight: 700,
              color: isCloudOnline ? '#22d3ee' : '#4a1515', lineHeight: 1,
            }}>
              {isCloudOnline ? mainDocs : '—'}
            </span>
            {isCloudOnline && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', marginLeft: '4px' }}>bags</span>}
          </div>

          {/* Status badge */}
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.1em',
            background: isCloudOnline ? '#071e26' : '#2a0a0a',
            border: `1px solid ${isCloudOnline ? 'rgba(34,211,238,0.4)' : 'rgba(248,81,73,0.3)'}`,
            color: isCloudOnline ? '#22d3ee' : '#f85149',
            borderRadius: '20px', padding: '2px 10px',
          }}>
            ● {isCloudOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

      </div>

      {/* Footer */}
      <AnimatePresence mode="wait">
        <motion.p
          key={footerMsg}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            fontFamily: 'IBM Plex Mono', fontSize: '10px', textAlign: 'center',
            marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #21262d',
            color: isCloudOnline ? (inSync ? '#3fb950' : '#d29922') : '#7d8590',
            letterSpacing: '0.02em',
          }}
        >
          {footerMsg}
        </motion.p>
      </AnimatePresence>

    </div>
  )
}
