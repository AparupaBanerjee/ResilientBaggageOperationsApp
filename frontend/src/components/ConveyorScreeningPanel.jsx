/**
 * ConveyorScreeningPanel — Real-time conveyor / RFID screening monitor.
 *
 * Connects to ws://localhost:4000/screening-stream (or falls back to the built-in
 * mock simulator when the WS server is not reachable).
 *
 * State lives in Zustand (screeningStore) so any other component can read KPIs.
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, AlertTriangle, CheckCircle, XCircle, Clock, Wifi, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useScreeningStore } from '../store/screeningStore.js'

// ── Mock WebSocket simulator ──────────────────────────────────────────────────
const FLIGHTS   = ['SK101', 'SK202', 'SK303', 'SK404', 'SK505']
const BELTS     = ['A1', 'A2', 'B1', 'B2', 'C1']
const FAIL_REASONS = [
  'Camera obstruction',
  'RFID tag unreadable',
  'Weight sensor offline',
  'Tag orientation error',
  'Duplicate scan detected',
]

function createMockEvent(bags = []) {
  const roll = Math.random()
  const result =
    roll < 0.78  ? 'PASS' :
    roll < 0.92  ? 'MANUAL_REVIEW' : 'FAIL'

  // Use a real bag if available, else fall back to synthetic
  const activeBags = bags.filter(b => ['check_in', 'in_transit', 'loaded'].includes(b.status))
  if (activeBags.length > 0) {
    const b = activeBags[Math.floor(Math.random() * activeBags.length)]
    return {
      ts:        new Date().toISOString(),
      bag_id:    b.bag_id,
      flight_id: b.flight_id,
      belt_id:   b.destination_belt ?? BELTS[Math.floor(Math.random() * BELTS.length)],
      result,
      reason:    result !== 'PASS' ? FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)] : null,
      weight_kg: b.weight_kg ?? parseFloat((Math.random() * 25 + 3).toFixed(1)),
      mock:      true,
    }
  }

  // Fallback: no real bags seeded yet
  return {
    ts:        new Date().toISOString(),
    bag_id:    `BAG-${Math.floor(Math.random() * 90000) + 10000}`,
    flight_id: FLIGHTS[Math.floor(Math.random() * FLIGHTS.length)],
    belt_id:   BELTS[Math.floor(Math.random() * BELTS.length)],
    result,
    reason:    result !== 'PASS' ? FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)] : null,
    weight_kg: parseFloat((Math.random() * 25 + 3).toFixed(1)),
    mock:      true,
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const WS_URL = 'ws://localhost:4000/screening-stream'
const MOCK_INTERVAL_MS = 1400   // one event ~every 1.4 s when mocking

const RESULT_STYLE = {
  PASS:          { color: '#3fb950', label: 'PASS',          bg: 'rgba(35,134,54,0.07)' },
  MANUAL_REVIEW: { color: '#d29922', label: 'MANUAL REVIEW', bg: 'rgba(210,153,34,0.08)' },
  FAIL:          { color: '#f85149', label: 'FAIL',          bg: 'rgba(178,34,34,0.10)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTs(iso) {
  try {
    return new Date(iso).toLocaleTimeString('sv-SE', { hour12: false })
  } catch { return '—' }
}

function autoPassRate(scanned, passed) {
  if (!scanned) return 0
  return Math.round((passed / scanned) * 100)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ConveyorScreeningPanel() {
  const { scanned, passed, failed, manualQ, feed, interventions,
          connected, setConnected, pushEvent, clearIntervention, clearAllInterventions } = useScreeningStore()

  const wsRef       = useRef(null)
  const mockTimer   = useRef(null)
  const bagsRef     = useRef([])
  const [useMock, setUseMock]         = useState(false)
  const [activeFilter, setActiveFilter] = useState(null)  // null | 'all' | 'PASS' | 'FAIL' | 'MANUAL_REVIEW'

  // ── WebSocket connection with mock fallback ───────────────────────────────
  useEffect(() => {
    let dead = false

    function startMock() {
      if (dead) return
      setUseMock(true)
      setConnected(true)
      mockTimer.current = setInterval(() => {
        if (!dead) pushEvent(createMockEvent(bagsRef.current))
      }, MOCK_INTERVAL_MS)
    }

    function connect() {
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws

        const timeout = setTimeout(() => {
          ws.close()
          startMock()
        }, 3000)

        ws.onopen = () => {
          clearTimeout(timeout)
          setConnected(true)
          setUseMock(false)
        }

        ws.onmessage = (e) => {
          try { pushEvent(JSON.parse(e.data)) }
          catch { /* ignore malformed */ }
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          ws.close()
        }

        ws.onclose = () => {
          if (!dead) {
            setConnected(false)
            startMock()
          }
        }
      } catch {
        startMock()
      }
    }

    connect()

    return () => {
      dead = true
      clearInterval(mockTimer.current)
      if (wsRef.current) wsRef.current.close()
      setConnected(false)
    }
  }, [])   // eslint-disable-line

  // Keep bagsRef fresh so mock events use real bag IDs
  useEffect(() => {
    const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const fetchBags = () => {
      fetch(`${API}/bags`).then(r => r.json())
        .then(data => { bagsRef.current = Array.isArray(data) ? data : [] })
        .catch(() => {})
    }
    fetchBags()
    const t = setInterval(fetchBags, 8000)
    return () => clearInterval(t)
  }, [])

  const rate = autoPassRate(scanned, passed)

  // ── KPI card helper ───────────────────────────────────────────────────────
  const KpiCard = ({ label, value, color, icon: Icon, filterKey }) => {
    const isActive = activeFilter === filterKey
    return (
      <div
        onClick={() => setActiveFilter(isActive ? null : filterKey)}
        style={{
          background: isActive ? `rgba(${color === '#3fb950' ? '63,185,80' : color === '#f85149' ? '248,81,73' : color === '#d29922' ? '210,153,34' : '125,133,144'},0.12)` : '#161b22',
          border: `1px solid ${isActive ? color : '#30363d'}`,
          borderRadius: '6px',
          padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Icon && <Icon size={12} color={color} />}
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.1em' }}>
            {label}
          </span>
          {isActive && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '8px', color, marginLeft: 'auto', letterSpacing: '0.06em' }}>
              ▼ FILTERED
            </span>
          )}
        </div>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '26px', fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </span>
      </div>
    )
  }

  return (
    <div className="card" style={{ overflow: 'hidden', position: 'relative', height: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex', alignItems: 'center', gap: '10px',
        background: '#0d1117',
      }}>
        <Camera size={15} color="#7d8590" />
        <span className="label-upper">Conveyor Screening</span>

        {/* Auto-pass rate badge */}
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700,
          color: rate >= 75 ? '#3fb950' : rate >= 55 ? '#d29922' : '#f85149',
          border: `1px solid ${rate >= 75 ? '#238636' : rate >= 55 ? '#9e6a03' : '#b22222'}`,
          borderRadius: '3px', padding: '1px 7px', letterSpacing: '0.06em',
        }}>
          {rate}% AUTO-PASS
        </span>

        {/* Connection pill */}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {connected
            ? <><span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#3fb950', letterSpacing: '0.06em' }}>
                {useMock ? 'MOCK FEED' : 'LIVE'}
              </span></>
            : <><WifiOff size={11} color="#f85149" />
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#f85149' }}>DISCONNECTED</span></>
          }
        </span>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
        padding: '12px 16px',
        borderBottom: '1px solid #21262d',
      }}>
        <KpiCard label="SCANNED"  value={scanned}  color="#7d8590" icon={Camera}        filterKey="all"           />
        <KpiCard label="PASSED"   value={passed}   color="#3fb950" icon={CheckCircle}   filterKey="PASS"          />
        <KpiCard label="FAILED"   value={failed}   color="#f85149" icon={XCircle}       filterKey="FAIL"          />
        <KpiCard label="MANUAL Q" value={manualQ}  color="#d29922" icon={AlertTriangle} filterKey="MANUAL_REVIEW" />
      </div>

      {/* ── Intervention warning banner ───────────────────────────────────── */}
      <AnimatePresence>
        {interventions.length > 0 && (
          <motion.div
            key="intervention-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'rgba(178,34,34,0.12)',
              borderBottom: '1px solid #b22222',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '7px 16px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <AlertTriangle size={13} color="#f85149" />
              <span style={{
                fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 700,
                color: '#f85149', letterSpacing: '0.06em', flex: 1,
              }}>
                REQUIRES INTERVENTION — {interventions.length} BAG{interventions.length !== 1 ? 'S' : ''}
              </span>
              <button
                onClick={clearAllInterventions}
                style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                  background: 'none', border: '1px solid #b22222',
                  color: '#f85149', borderRadius: '3px', padding: '2px 8px',
                  cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >
                CLEAR ALL
              </button>
            </div>

            {/* Intervention rows */}
            <div style={{ maxHeight: '130px', overflowY: 'auto' }}>
              {interventions.map(item => (
                <div key={item.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 2fr auto',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 16px',
                  borderTop: '1px solid rgba(178,34,34,0.2)',
                  background: 'rgba(178,34,34,0.04)',
                }}>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#f85149', fontWeight: 700 }}>
                    {item.bag_id}
                  </span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590' }}>
                    {item.flight_id} · {item.belt_id}
                  </span>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#d29922' }}>
                    {item.reason}
                  </span>
                  <button
                    onClick={() => clearIntervention(item.id)}
                    style={{
                      fontFamily: 'IBM Plex Mono', fontSize: '9px',
                      background: 'none', border: '1px solid #30363d',
                      color: '#484f58', borderRadius: '3px', padding: '2px 7px',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#238636'; e.currentTarget.style.color = '#3fb950' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#484f58' }}
                  >
                    CLEAR
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live screening feed ───────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.1em' }}>
          {activeFilter && activeFilter !== 'all'
            ? `FILTERED · ${activeFilter.replace('_', ' ')} ONLY`
            : 'LIVE SCREENING FEED'}
        </span>
        {activeFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            style={{
              fontFamily: 'IBM Plex Mono', fontSize: '8px', fontWeight: 600,
              background: 'none', border: '1px solid #30363d',
              color: '#484f58', borderRadius: '3px', padding: '1px 6px',
              cursor: 'pointer', letterSpacing: '0.04em', marginLeft: 'auto',
            }}
          >
            CLEAR FILTER
          </button>
        )}
      </div>

      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {feed.length === 0 ? (
          <div style={{ padding: '16px', fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#484f58' }}>
            Waiting for scan events…
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {feed
              .filter(evt => !activeFilter || activeFilter === 'all' || evt.result === activeFilter)
              .map((evt) => {
              const st = RESULT_STYLE[evt.result] ?? RESULT_STYLE.PASS
              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 110px 60px 50px 1fr 80px',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 16px',
                    borderBottom: '1px solid #161b22',
                    background: st.bg,
                  }}
                >
                  {/* Time */}
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58' }}>
                    {fmtTs(evt.ts)}
                  </span>
                  {/* Bag ID */}
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#e6edf3', fontWeight: 600 }}>
                    {evt.bag_id}
                  </span>
                  {/* Flight */}
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590' }}>
                    {evt.flight_id}
                  </span>
                  {/* Belt */}
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58' }}>
                    {evt.belt_id}
                  </span>
                  {/* Reason */}
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#7d8590', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {evt.reason || '—'}
                  </span>
                  {/* Result badge */}
                  <span style={{
                    fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
                    color: st.color, letterSpacing: '0.05em', textAlign: 'right',
                  }}>
                    {st.label}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

    </div>
  )
}
