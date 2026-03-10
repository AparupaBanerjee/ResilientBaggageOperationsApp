import { useState, useEffect, useRef } from 'react'
import { GitMerge, AlertTriangle, Cloud, Server, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function fmtTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('sv-SE', { hour12: false }) }
  catch { return iso }
}

export default function SplitBrainPanel({ isCloudOnline, health }) {
  const edgeDocs = health?.edge_bag_count  ?? '—'
  const mainDocs = health?.main_bag_count  ?? '—'
  const inSync   = health?.counts_in_sync  ?? true
  const pending  = health?.pending_sync_count ?? 0

  const footerMsg = !isCloudOnline
    ? 'Local node handling routing autonomously — data queued for sync'
    : inSync
      ? 'All baggage data syncing to cloud in real-time'
      : `${pending} doc(s) pending sync — Edge ahead of Main`
  const [conflicts,   setConflicts]   = useState([])
  const [history,     setHistory]     = useState([])
  const [resolving,   setResolving]   = useState(null)
  const [toast,       setToast]       = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [divertBelts, setDivertBelts] = useState({})   // { [directive_id]: belt }
  const pollRef = useRef(null)

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchConflicts = () => {
    fetch(`${API}/conflicts`).then(r => r.json()).then(setConflicts).catch(() => {})
  }
  const fetchHistory = () => {
    fetch(`${API}/conflicts/history`).then(r => r.json()).then(setHistory).catch(() => {})
  }

  useEffect(() => {
    fetchConflicts(); fetchHistory()
    pollRef.current = setInterval(() => { fetchConflicts(); fetchHistory() }, 3000)
    return () => clearInterval(pollRef.current)
  }, [])

  const handleResolve = (directive_id, action) => {
    setResolving(directive_id)
    const op = localStorage.getItem('operator_id') || 'operator'
    const divert_belt = (divertBelts[directive_id] || 'D12').toUpperCase()
    fetch(`${API}/conflicts/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-operator-id': op },
      body: JSON.stringify({ directive_id, action, divert_belt }),
    })
      .then(async r => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.detail || 'Resolve failed')
        return body
      })
      .then(body => {
        const labels = {
          accept_cloud:  'CLOUD ACCEPTED',
          keep_edge:     'EDGE KEPT',
          manual_update: `MANUAL REROUTE → Belt ${body.divert_belt || divert_belt}`,
        }
        const extra = body.bags_affected > 0 ? ` — ${body.bags_affected} bag(s) updated` : ''
        showToast(`${labels[action] || action}: ${body.flight_id}${extra}`, true)
        fetchConflicts(); fetchHistory()
      })
      .catch(err => showToast(err.message, false))
      .finally(() => setResolving(null))
  }

  const hasConflicts = conflicts.length > 0

  return (
    <div className="card" style={{ overflow: 'hidden', position: 'relative' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#0d2a18' : '#3d1515',
          border: `1px solid ${toast.ok ? '#238636' : '#b22222'}`,
          borderRadius: '4px', padding: '6px 14px',
          fontFamily: 'IBM Plex Mono', fontSize: '11px',
          color: toast.ok ? '#3fb950' : '#f85149',
          zIndex: 10, whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {toast.ok ? '✓' : '⚠'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span className="label-upper" style={{ letterSpacing: '0.12em' }}>Hybrid Architecture</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <motion.span
            key={isCloudOnline ? 'on' : 'off'}
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
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
          {hasConflicts && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                color: '#f85149', border: '1px solid #b22222',
                borderRadius: '3px', padding: '2px 7px', letterSpacing: '0.06em',
              }}
            >
              ⚠ {conflicts.length} CONFLICT{conflicts.length !== 1 ? 'S' : ''}
            </motion.span>
          )}
          <button
            onClick={() => { setShowHistory(h => !h); if (!showHistory) fetchHistory() }}
            style={{
              fontFamily: 'IBM Plex Mono', fontSize: '9px',
              background: 'none', border: '1px solid #30363d',
              color: '#484f58', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#388bfd'; e.currentTarget.style.color = '#388bfd' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#484f58' }}
          >
            {showHistory ? 'HIDE' : 'HISTORY'}
          </button>
        </div>
      </div>

      {/* Node grid — square boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px', padding: '0 16px 10px' }}>

        {/* Edge node */}
        <div style={{
          background: '#0a1f0f', border: '1px solid #238636', borderRadius: '8px',
          padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          boxShadow: '0 0 14px 2px rgba(35,134,54,0.10)',
          position: 'relative',
        }}>
          <span style={{ position: 'absolute', top: '8px', right: '8px' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </span>
          <div style={{ background: 'rgba(35,134,54,0.15)', border: '1px solid rgba(35,134,54,0.3)', borderRadius: '8px', padding: '5px' }}>
            <Server size={16} color="#3fb950" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700, color: '#3fb950', letterSpacing: '0.1em', marginBottom: '2px' }}>EDGE NODE</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590' }}>Always Writing</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '17px', fontWeight: 700, color: '#3fb950', lineHeight: 1 }}>{edgeDocs}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', marginLeft: '4px' }}>bags</span>
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700, color: '#3fb950',
            letterSpacing: '0.08em', background: '#0d2a18', border: '1px solid #238636',
            borderRadius: '20px', padding: '2px 8px',
          }}>◎ OPERATIONAL</div>
        </div>

        {/* Bridge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '0 4px' }}>
          <AnimatePresence mode="wait">
            {isCloudOnline ? (
              <motion.div key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
              >
                <motion.span animate={{ x: [0, -4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ fontFamily: 'IBM Plex Mono', fontSize: '15px', color: hasConflicts ? '#f85149' : '#22d3ee' }}>←</motion.span>
                <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  style={{ fontFamily: 'IBM Plex Mono', fontSize: '15px', color: hasConflicts ? '#f85149' : '#22d3ee' }}>→</motion.span>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '8px', fontWeight: 700, marginTop: '2px',
                  color: hasConflicts ? '#f85149' : '#22d3ee', letterSpacing: '0.1em',
                }}>{hasConflicts ? 'CONFLICT' : 'XDCR'}</span>
              </motion.div>
            ) : (
              <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
              >
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '15px', color: '#4a1515', opacity: 0.5 }}>←</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '15px', color: '#4a1515', opacity: 0.5 }}>→</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '8px', fontWeight: 700, color: '#f85149', letterSpacing: '0.1em', marginTop: '2px' }}>PAUSED</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main / Cloud node */}
        <div style={{
          background: isCloudOnline ? '#071e26' : '#1a0d0d',
          border: `1px solid ${isCloudOnline ? 'rgba(34,211,238,0.5)' : '#4a1515'}`,
          borderRadius: '8px', padding: '8px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          boxShadow: isCloudOnline ? '0 0 14px 2px rgba(34,211,238,0.08)' : 'none',
          opacity: isCloudOnline ? 1 : 0.6, transition: 'opacity 0.3s',
          position: 'relative',
        }}>
          <span style={{ position: 'absolute', top: '8px', right: '8px' }}>
            {isCloudOnline ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
            ) : (
              <span className="inline-flex rounded-full h-2 w-2 bg-red-800" />
            )}
          </span>
          <div style={{
            background: isCloudOnline ? 'rgba(34,211,238,0.1)' : 'rgba(248,81,73,0.08)',
            border: isCloudOnline ? '1px solid rgba(34,211,238,0.25)' : '1px solid rgba(248,81,73,0.2)',
            borderRadius: '8px', padding: '5px', transition: 'all 0.3s',
          }}>
            <GitMerge size={16} color={isCloudOnline ? '#22d3ee' : '#b22222'} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
              color: isCloudOnline ? '#22d3ee' : '#6b3333', letterSpacing: '0.1em', marginBottom: '2px',
            }}>MAIN CLOUD</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590' }}>
              {isCloudOnline ? 'In Sync' : 'Isolated'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '17px', fontWeight: 700, color: isCloudOnline ? '#22d3ee' : '#4a1515', lineHeight: 1 }}>
              {isCloudOnline ? mainDocs : '—'}
            </span>
            {isCloudOnline && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', marginLeft: '4px' }}>bags</span>}
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
            background: isCloudOnline ? '#071e26' : '#2a0a0a',
            border: `1px solid ${isCloudOnline ? 'rgba(34,211,238,0.4)' : 'rgba(248,81,73,0.3)'}`,
            color: isCloudOnline ? '#22d3ee' : '#f85149',
            borderRadius: '20px', padding: '2px 8px',
          }}>● {isCloudOnline ? 'ONLINE' : 'OFFLINE'}</div>
        </div>

      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #21262d' }} />

      {/* Conflict cards */}
      <AnimatePresence>
        {conflicts.map(conflict => {
          const isResolvingThis = resolving === conflict.directive_id
          return (
            <motion.div
              key={conflict.directive_id}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ borderBottom: '1px solid #b22222', background: 'rgba(178,34,34,0.06)' }}
            >
              <div style={{
                padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px',
                borderBottom: '1px solid rgba(178,34,34,0.2)',
              }}>
                <AlertTriangle size={13} color="#f85149" />
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 700, color: '#f85149', letterSpacing: '0.06em' }}>
                  CONFLICT · {conflict.flight_id}
                </span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58' }}>
                  {conflict.directive_id} · {fmtTime(conflict.issued_at)}
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#d29922' }}>
                  {conflict.affected_count} bag{conflict.affected_count !== 1 ? 's' : ''} routing on Edge
                </span>
              </div>

              {conflict.affected_bags.length > 0 && (
                <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
                  {conflict.affected_bags.map((bag, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                      padding: '4px 16px', borderBottom: '1px solid rgba(178,34,34,0.1)',
                      background: i % 2 === 0 ? 'rgba(178,34,34,0.03)' : 'transparent',
                    }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#f85149', fontWeight: 700 }}>{bag.bag_id}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590' }}>{bag.passenger_name}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58', textAlign: 'right' }}>belt {bag.destination_belt || '—'} · {bag.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Human override — two option cards */}
              <div style={{ padding: '8px 12px 10px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  HUMAN OVERRIDE REQUIRED:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                  {/* Option 1 — Accept Cloud */}
                  <div style={{
                    border: '1px solid rgba(34,211,238,0.35)', borderRadius: '5px',
                    background: 'rgba(34,211,238,0.04)', padding: '8px 10px',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                  }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700, color: '#22d3ee', letterSpacing: '0.1em', marginBottom: '2px' }}>
                      ☁ ACCEPT CLOUD
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590', lineHeight: 1.5 }}>
                      Flight: <span style={{ color: '#d29922' }}>{(conflict.flight_status || 'unknown').toUpperCase()}</span>
                      {' → '}
                      <span style={{ color: '#f85149' }}>CANCELLED</span>
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590', lineHeight: 1.5 }}>
                      Bags: active → <span style={{ color: '#d29922' }}>ON HOLD</span>
                    </div>
                    <button
                      disabled={isResolvingThis}
                      onClick={() => handleResolve(conflict.directive_id, 'accept_cloud')}
                      style={{
                        marginTop: '4px', fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
                        background: isResolvingThis ? 'transparent' : 'rgba(34,211,238,0.1)',
                        border: '1px solid rgba(34,211,238,0.4)',
                        color: isResolvingThis ? '#484f58' : '#22d3ee',
                        borderRadius: '3px', padding: '4px 0', cursor: isResolvingThis ? 'default' : 'pointer',
                        width: '100%',
                      }}
                    >{isResolvingThis ? '…' : 'APPLY'}</button>
                  </div>

                  {/* Option 2 — Manual Update */}
                  <div style={{
                    border: '1px solid rgba(210,153,34,0.35)', borderRadius: '5px',
                    background: 'rgba(210,153,34,0.04)', padding: '8px 10px',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                  }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700, color: '#d29922', letterSpacing: '0.1em', marginBottom: '2px' }}>
                      ✎ MANUAL UPDATE
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590', lineHeight: 1.5 }}>
                      Flight: <span style={{ color: '#d29922' }}>{(conflict.flight_status || 'unknown').toUpperCase()}</span>
                      {' → '}
                      <span style={{ color: '#f85149' }}>CANCELLED</span>
                    </div>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Bags: active → Belt
                      <input
                        value={divertBelts[conflict.directive_id] ?? 'D12'}
                        onChange={e => setDivertBelts(prev => ({ ...prev, [conflict.directive_id]: e.target.value }))}
                        style={{
                          fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                          background: '#0d1117', border: '1px solid rgba(210,153,34,0.4)',
                          color: '#d29922', borderRadius: '3px', padding: '1px 5px',
                          width: '40px', textAlign: 'center', textTransform: 'uppercase',
                        }}
                        maxLength={4}
                      />
                    </div>
                    <button
                      disabled={isResolvingThis}
                      onClick={() => handleResolve(conflict.directive_id, 'manual_update')}
                      style={{
                        marginTop: '4px', fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
                        background: isResolvingThis ? 'transparent' : 'rgba(210,153,34,0.1)',
                        border: '1px solid rgba(210,153,34,0.4)',
                        color: isResolvingThis ? '#484f58' : '#d29922',
                        borderRadius: '3px', padding: '4px 0', cursor: isResolvingThis ? 'default' : 'pointer',
                        width: '100%',
                      }}
                    >{isResolvingThis ? '…' : 'APPLY'}</button>
                  </div>

                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Empty state */}
      {conflicts.length === 0 && (
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={12} color="#3fb950" />
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58' }}>
            No active conflicts — state is consistent
          </span>
        </div>
      )}

      {/* Sync footer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={footerMsg}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            padding: '8px 16px', borderTop: '1px solid #21262d',
            fontFamily: 'IBM Plex Mono', fontSize: '10px', textAlign: 'center',
            color: isCloudOnline ? (inSync ? '#3fb950' : '#d29922') : '#7d8590',
            letterSpacing: '0.02em',
          }}
        >
          {footerMsg}
        </motion.div>
      </AnimatePresence>

      {/* Resolution history */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            key="history"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', borderTop: '1px solid #21262d' }}
          >
            <div style={{ padding: '6px 16px', background: '#0a0e14' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.1em' }}>RESOLUTION HISTORY</span>
            </div>
            {history.length === 0 ? (
              <div style={{ padding: '10px 16px', fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#30363d' }}>No resolutions yet.</div>
            ) : (
              history.map(h => (
                <div key={h.directive_id} style={{
                  display: 'grid', gridTemplateColumns: '60px 56px 1fr 110px 64px',
                  alignItems: 'center', gap: '8px', padding: '5px 16px', borderBottom: '1px solid #161b22',
                }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58' }}>{fmtTime(h.resolved_at)}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#e6edf3', fontWeight: 600 }}>{h.flight_id}</span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58' }}>{h.directive_id}</span>
                  <span style={{
                    fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                    color: h.resolution === 'accept_cloud' ? '#22d3ee' : h.resolution === 'manual_update' ? '#d29922' : '#3fb950',
                    letterSpacing: '0.04em',
                  }}>
                    {h.resolution === 'accept_cloud' ? '☁ CLOUD' : h.resolution === 'manual_update' ? `✎ →${h.divert_belt || 'D12'}` : '⬡ EDGE'}
                  </span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', textAlign: 'right' }}>{h.resolved_by}</span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
