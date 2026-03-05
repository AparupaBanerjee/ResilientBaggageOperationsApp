import { Server, Cloud, CloudOff, ArrowRightLeft, ArrowRight, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HybridArchitectureStatus({ isCloudOnline, health }) {
  const edgeDocs  = health?.edge_doc_count ?? '—'
  const mainDocs  = health?.main_doc_count  ?? '—'
  const inSync    = health?.counts_in_sync  ?? true
  const pending   = health?.pending_sync_count ?? 0

  // ── Shared card base ───────────────────────────────────────────────────────
  const nodeBase = `
    relative flex flex-col items-center gap-2 p-3 rounded-xl border
    transition-all duration-500 cursor-default select-none
  `

  return (
    <div className="card" style={{ padding: '16px 20px' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="label-upper" style={{ letterSpacing: '0.12em' }}>
          Hybrid Architecture
        </span>
        <motion.span
          key={isCloudOnline ? 'online' : 'offline'}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="font-mono text-[10px] font-bold tracking-widest px-2 py-0.5 rounded"
          style={{
            background: isCloudOnline ? '#0d2a18' : '#3d1515',
            color:      isCloudOnline ? '#3fb950' : '#f85149',
            border:     `1px solid ${isCloudOnline ? '#238636' : '#b22222'}`,
          }}
        >
          {isCloudOnline ? '● LIVE SYNC' : '● DISCONNECTED'}
        </motion.span>
      </div>

      {/* Three-column grid */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">

        {/* ── LOCAL NODE ─────────────────────────────────────── */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className={nodeBase}
          style={{
            background:   '#0a1f0f',
            borderColor:  '#238636',
            boxShadow:    '0 0 18px 2px rgba(35,134,54,0.18)',
          }}
        >
          {/* Live pulse ring */}
          <span className="absolute top-3 right-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </span>

          <div
            className="p-3 rounded-lg"
            style={{ background: 'rgba(35,134,54,0.15)', border: '1px solid rgba(35,134,54,0.3)' }}
          >
            <Server size={22} className="text-green-400" />
          </div>

          <div className="text-center">
            <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase mb-0.5">Local Node</p>
            <p className="font-mono text-[11px] font-bold text-slate-100">Edge · ARN</p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '22px', fontWeight: 700, color: '#3fb950', lineHeight: 1 }}>
              {edgeDocs}
            </span>
            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.08em', marginTop: '2px' }}>DOCS</p>
          </div>

          <span
            className="font-mono text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded-full"
            style={{ background: '#0d2a18', color: '#3fb950', border: '1px solid #238636' }}
          >
            OPERATIONAL
          </span>
        </motion.div>

        {/* ── SYNC BRIDGE ────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 px-1">
          <AnimatePresence mode="wait">
            {isCloudOnline ? (
              <motion.div
                key="sync-on"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                {/* Animated flow arrows */}
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowRight size={14} className="text-cyan-500" />
                </motion.div>

                <div
                  className="font-mono text-[8px] tracking-[0.18em] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#071e26', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.35)' }}
                >
                  SYNC
                </div>

                <motion.div
                  animate={{ x: [0, -5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                >
                  <ArrowLeft size={14} className="text-cyan-500" />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="sync-off"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-2"
              >
                <ArrowRightLeft size={14} className="text-red-600 opacity-40" />
                <div
                  className="font-mono text-[8px] tracking-[0.18em] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#2a0a0a', color: '#f85149', border: '1px solid rgba(248,81,73,0.3)' }}
                >
                  OFFLINE
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CLOUD ANALYTICS ────────────────────────────────── */}
        <motion.div
          whileHover={{ scale: isCloudOnline ? 1.02 : 1.01 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className={nodeBase}
          style={{
            background:  isCloudOnline ? '#071e26' : '#1a0d0d',
            borderColor: isCloudOnline ? 'rgba(34,211,238,0.5)' : '#4a1515',
            boxShadow:   isCloudOnline
              ? '0 0 18px 2px rgba(34,211,238,0.12)'
              : '0 0 8px 1px rgba(248,81,73,0.06)',
            opacity: isCloudOnline ? 1 : 0.65,
          }}
        >
          {/* Status dot */}
          <span className="absolute top-3 right-3">
            {isCloudOnline ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-red-700" />
            )}
          </span>

          <div
            className="p-3 rounded-lg transition-all duration-500"
            style={{
              background: isCloudOnline ? 'rgba(34,211,238,0.1)' : 'rgba(248,81,73,0.08)',
              border:     isCloudOnline ? '1px solid rgba(34,211,238,0.25)' : '1px solid rgba(248,81,73,0.2)',
            }}
          >
            {isCloudOnline
              ? <Cloud size={22} className="text-cyan-400" />
              : <CloudOff size={22} className="text-red-700" />
            }
          </div>

          <div className="text-center">
            <p className="font-mono text-[9px] tracking-widest text-slate-500 uppercase mb-0.5">Cloud Analytics</p>
            <p
              className="font-mono text-[11px] font-bold transition-colors duration-500"
              style={{ color: isCloudOnline ? '#e6edf3' : '#6b3333' }}
            >
              {isCloudOnline ? 'Connected' : 'Unavailable'}
            </p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '22px', fontWeight: 700, color: isCloudOnline ? '#22d3ee' : '#4a1515', lineHeight: 1 }}>
              {isCloudOnline ? mainDocs : '—'}
            </span>
            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.08em', marginTop: '2px' }}>DOCS</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.span
              key={isCloudOnline ? 'cl-on' : 'cl-off'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="font-mono text-[9px] font-bold tracking-widest px-2.5 py-0.5 rounded-full"
              style={isCloudOnline
                ? { background: '#071e26', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.35)' }
                : { background: '#2a0a0a', color: '#f85149', border: '1px solid rgba(248,81,73,0.3)' }
              }
            >
              {isCloudOnline ? 'ONLINE' : 'OFFLINE'}
            </motion.span>
          </AnimatePresence>
        </motion.div>

      </div>

      {/* Footer status line */}
      <AnimatePresence mode="wait">
        <motion.p
          key={isCloudOnline ? 'ft-on' : 'ft-off'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[10px] text-center mt-3 pt-3"
          style={{
            borderTop: '1px solid #21262d',
            color: isCloudOnline ? '#3fb950' : '#7d8590',
            letterSpacing: '0.04em',
          }}
        >
          {!isCloudOnline
            ? '⚠  Local node handling routing autonomously — data queued for sync'
            : inSync
              ? '↑↓  Edge and Main in sync'
              : `⚠  ${pending} doc(s) pending sync — Edge ahead of Main`
          }
        </motion.p>
      </AnimatePresence>

    </div>
  )
}
