import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function nowHMS() {
  return new Date().toLocaleTimeString('sv-SE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function LogLine({ entry }) {
  const keywordColors = {
    PAUSED:    '#b22222',
    OFFLINE:   '#b22222',
    RESUMED:   '#238636',
    ONLINE:    '#238636',
    SYNCING:   '#1f6feb',
    SEEDED:    '#1f6feb',
    SEED:      '#1f6feb',
    ERROR:     '#b22222',
    PENDING:   '#9e6a03',
    GENERATED: '#238636',
    MISROUTED: '#b22222',
    REROUTED:  '#b22222',
  }

  const tokens = []
  let rest = entry.message
  const pattern = new RegExp(`\\b(${Object.keys(keywordColors).join('|')})\\b`, 'g')
  let last = 0
  let match
  while ((match = pattern.exec(rest)) !== null) {
    if (match.index > last) tokens.push({ text: rest.slice(last, match.index), color: null })
    tokens.push({ text: match[0], color: keywordColors[match[0]] })
    last = match.index + match[0].length
  }
  if (last < rest.length) tokens.push({ text: rest.slice(last), color: null })

  return (
    <div style={{ lineHeight: '1.6', whiteSpace: 'pre' }}>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: '#484f58' }}>
        [{entry.ts}]{'  '}
      </span>
      {tokens.map((t, i) => (
        <span
          key={i}
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '12px',
            color: t.color ?? '#7d8590',
            fontWeight: t.color ? 500 : 400,
          }}
        >
          {t.text}
        </span>
      ))}
    </div>
  )
}

export default function SimulationControls({ health, onHealthChange, open, onToggle }) {
  const [logs, setLogs]         = useState([])
  const [working, setWorking]   = useState(false)
  const [cancelFlight, setCancelFlight] = useState('')
  const [flights, setFlights]   = useState([])

  const online = health?.online ?? true

  const addLog = (msg) => {
    setLogs(prev => [{ ts: nowHMS(), message: msg }, ...prev].slice(0, 8))
  }

  const call = async (path, successMsg, errorPrefix) => {
    setWorking(true)
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const r = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'X-Operator-Id': operatorId },
      })
      const data = await r.json()
      if (!r.ok) {
        addLog(`ERROR ${r.status}: ${data.detail ?? JSON.stringify(data)}`)
      } else {
        addLog(successMsg(data))
        if (onHealthChange) onHealthChange()
      }
    } catch (err) {
      addLog(`ERROR ${errorPrefix}: ${err.message}`)
    } finally {
      setWorking(false)
    }
  }

  const handleOffline = () => call('/simulate/offline',
    () => 'XDCR PAUSED — replication OFFLINE. Writing to Edge only.', 'offline')

  const handleOnline  = () => call('/simulate/online',
    () => 'XDCR RESUMED — replication ONLINE. Edge syncing to Main.', 'online')

  const handleSyncToggle = () => online ? handleOffline() : handleOnline()

  const handleSeed = () => call('/simulate/seed',
    (d) => `SEEDED ${d.flights ?? 0} flights + ${d.bags ?? 0} bags on Edge [SYNCING to Main]`, 'seed')

  const handleCloudCancel = async () => {
    if (!cancelFlight) return
    setWorking(true)
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const r = await fetch(`${API}/conflicts/cloud-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator-Id': operatorId },
        body: JSON.stringify({ flight_id: cancelFlight, reason: 'Cloud ops centre cancellation' }),
      })
      const data = await r.json()
      if (!r.ok) {
        addLog(`ERROR ${r.status}: ${data.detail ?? JSON.stringify(data)}`)
      } else {
        addLog(`CLOUD CANCEL issued for ${cancelFlight} — conflict queued for resolution`)
        if (onHealthChange) onHealthChange()
      }
    } catch (err) {
      addLog(`ERROR cloud-cancel: ${err.message}`)
    } finally {
      setWorking(false)
    }
  }

  // Load flight list for cancel dropdown
  useEffect(() => {
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => {
        const active = data.filter(f => !['cancelled', 'arrived'].includes(f.status)).map(f => f.flight_id)
        setFlights(active)
        if (active.length > 0 && !cancelFlight) setCancelFlight(active[0])
      })
      .catch(() => {})
  }, [])

  const syncColor = online ? '#238636' : '#b22222'
  const syncLabel = online ? 'CLOUD SYNC  ON' : 'CLOUD SYNC  OFF'

  return (
    <>
      {/* ── Toggle button — floats on left edge ── */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: '68px',
          left: open ? '300px' : '0',
          zIndex: 200,
          background: '#161b22',
          border: '1px solid #30363d',
          borderLeft: 'none',
          borderRadius: '0 4px 4px 0',
          padding: '10px 6px',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          transition: 'left 0.2s ease',
        }}
      >
        {/* Sliders icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <line x1="4" y1="6"  x2="20" y2="6"  stroke="#7d8590" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="4" y1="12" x2="20" y2="12" stroke="#7d8590" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="4" y1="18" x2="20" y2="18" stroke="#7d8590" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="9"  cy="6"  r="2.5" fill="#161b22" stroke="#7d8590" strokeWidth="1.5"/>
          <circle cx="15" cy="12" r="2.5" fill="#161b22" stroke="#7d8590" strokeWidth="1.5"/>
          <circle cx="9"  cy="18" r="2.5" fill="#161b22" stroke="#7d8590" strokeWidth="1.5"/>
        </svg>
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: '8px', color: '#484f58',
          writingMode: 'vertical-rl', letterSpacing: '0.1em',
        }}>
          {open ? 'CLOSE' : 'CTRL'}
        </span>
      </button>

      {/* ── Drawer panel ── */}
      <div style={{
        position: 'fixed',
        top: '56px',
        left: open ? '0' : '-304px',
        width: '300px',
        height: 'calc(100vh - 56px)',
        background: '#161b22',
        borderRight: '1px solid #30363d',
        zIndex: 199,
        display: 'flex', flexDirection: 'column',
        transition: 'left 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #30363d',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0d1117',
        }}>
          <span className="label-upper">Simulation Controls</span>
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: '10px',
            color: online ? '#3fb950' : '#b22222', fontWeight: 600,
          }}>
            {online ? '● ONLINE' : '● OFFLINE'}
          </span>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* ── SYNC toggle ── */}
          <button
            onClick={handleSyncToggle}
            disabled={working}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px',
              background: online ? 'rgba(35,134,54,0.1)' : 'rgba(178,34,34,0.1)',
              border: `1px solid ${syncColor}55`,
              borderLeft: `3px solid ${syncColor}`,
              borderRadius: '4px',
              cursor: 'pointer', outline: 'none', width: '100%',
            }}
          >
            <div style={{
              width: '32px', height: '16px',
              background: online ? '#238636' : '#b22222',
              borderRadius: '8px', position: 'relative',
              transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: '12px', height: '12px', background: '#e6edf3',
                borderRadius: '50%', position: 'absolute', top: '2px',
                left: online ? '18px' : '2px', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 600, color: syncColor, letterSpacing: '0.06em' }}>
              {syncLabel}
            </span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58', marginLeft: 'auto' }}>
              {online ? 'simulate outage' : 'restore'}
            </span>
          </button>

          {/* ── CLOUD section ── */}
          <div style={{ border: `1px solid ${online ? '#21262d' : '#30363d'}`, borderRadius: '6px', overflow: 'hidden', opacity: online ? 1 : 0.45 }}>
            <div style={{ background: '#0d1117', borderBottom: '1px solid #21262d', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700, color: online ? '#1f6feb' : '#484f58', letterSpacing: '0.12em' }}>☁  CLOUD</span>
              {!online && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '8px', color: '#484f58', letterSpacing: '0.06em' }}>— unavailable while offline</span>}
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58', letterSpacing: '0.06em' }}>CANCEL FLIGHT</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={cancelFlight}
                    onChange={e => setCancelFlight(e.target.value)}
                    disabled={!online}
                    style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', color: '#e6edf3', fontFamily: 'IBM Plex Mono', fontSize: '12px', padding: '5px 8px', outline: 'none' }}
                  >
                    {flights.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <button
                    onClick={handleCloudCancel}
                    disabled={working || !cancelFlight || !online}
                    title={!online ? 'Sync must be online to issue cloud directives' : ''}
                    style={{ background: '#3d1515', border: '1px solid #b2222299', borderRadius: '4px', color: '#b22222', fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 600, padding: '5px 12px', cursor: !online ? 'not-allowed' : 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Event log ── */}
          <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '4px', padding: '8px 10px', overflowY: 'auto', maxHeight: '140px', minHeight: '60px' }}>
            {logs.length === 0 ? (
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: '#484f58' }}>Awaiting events...</span>
            ) : (
              logs.map((entry, i) => <LogLine key={i} entry={entry} />)
            )}
          </div>

          {/* ── EDGE section ── */}
          <div style={{ border: '1px solid #21262d', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ background: '#0d1117', borderBottom: '1px solid #21262d', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700, color: '#3fb950', letterSpacing: '0.12em' }}>⬡  EDGE</span>
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleSeed}
                disabled={working}
                style={{ width: '100%', padding: '8px', background: 'rgba(31,111,235,0.12)', border: '1px solid #1f6feb88', borderRadius: '4px', color: '#58a6ff', fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', cursor: working ? 'default' : 'pointer' }}
              >
                ⬡  SEED TEST DATA
              </button>
              <div style={{ borderTop: '1px solid #21262d' }} />
              <BulkGenerate onAdd={addLog} online={online} />
              <div style={{ borderTop: '1px solid #21262d' }} />
              <QuickAddBag onAdd={addLog} online={online} />
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

const PASSENGER_NAMES = [
  'Erik Johansson','Anna Lindqvist','Lars Eriksson','Maria Nilsson','Johan Andersson',
  'Sofia Bergström','Mikael Karlsson','Emma Holm','Anders Svensson','Lina Persson',
  'Oscar Björk','Maja Strand','Henrik Lund','Klara Dahl','Fredrik Axelsson',
  'Ingrid Falk','Gustav Molin','Hanna Engström','Viktor Nyberg','Astrid Grahn',
]

function BulkGenerate({ onAdd, online }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const [flights, setFlights] = useState([])
  const [flight, setFlight]   = useState('')
  const [n, setN]             = useState(5)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => {
        const active = data.filter(f => f.status !== 'cancelled').map(f => f.flight_id)
        setFlights(active)
        if (active.length > 0) setFlight(active[0])
      })
      .catch(() => {})
  }, [])

  const inputStyle = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px',
    color: '#e6edf3', fontFamily: 'IBM Plex Mono', fontSize: '12px',
    padding: '5px 8px', outline: 'none', width: '100%',
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    const count = Math.max(1, Math.min(100, parseInt(n) || 5))
    setWorking(true)
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const results = await Promise.all(
        Array.from({ length: count }, (_, i) => {
          const name = PASSENGER_NAMES[i % PASSENGER_NAMES.length] + (i >= PASSENGER_NAMES.length ? ` ${Math.floor(i / PASSENGER_NAMES.length) + 1}` : '')
          return fetch(`${API}/bags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Operator-Id': operatorId },
            body: JSON.stringify({
              flight_id: flight,
              passenger_name: name,
              weight_kg: Math.round((7 + Math.random() * 16) * 10) / 10,
            }),
          }).then(r => r.json().then(d => ({ ok: r.ok, data: d })))
        })
      )
      const ok = results.filter(r => r.ok).length
      onAdd(`GENERATED ${ok} bags on ${flight} [${online ? 'SYNCED' : 'PENDING'}]`)
    } catch (err) {
      onAdd(`ERROR: ${err.message}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label-upper" style={{ marginBottom: '2px' }}>Bulk Generate Bags</div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select value={flight} onChange={e => setFlight(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          {flights.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          style={{ ...inputStyle, width: '52px', flex: 'none', textAlign: 'center' }}
          type="number" min="1" max="100"
          value={n} onChange={e => setN(e.target.value)}
          title="Number of bags"
        />
        <button type="submit" className="btn" disabled={working || !flight} style={{ flex: 'none', whiteSpace: 'nowrap' }}>
          {working ? '…' : 'GENERATE'}
        </button>
      </div>
    </form>
  )
}

function QuickAddFlight({ onAdd, online }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const [flightType, setFlightType] = useState('outbound')
  const [flightId, setFlightId]     = useState('')
  const [orig, setOrig]             = useState('')   // free field for inbound
  const [dest, setDest]             = useState('')   // free field for outbound
  const [depTime, setDepTime]       = useState('12:00')
  const [arrTime, setArrTime]       = useState('14:00')
  const [gate, setGate]             = useState('')
  const [belt, setBelt]             = useState('')
  const [working, setWorking]       = useState(false)
  const [error, setError]           = useState('')

  const isInbound = flightType === 'inbound'

  // For outbound: ORIG=ARN (fixed), DEST=user input
  // For inbound:  ORIG=user input, DEST=ARN (fixed)
  const effectiveOrig = isInbound ? orig : 'ARN'
  const effectiveDest = isInbound ? 'ARN' : dest

  const inputStyle = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px',
    color: '#e6edf3', fontFamily: 'IBM Plex Mono', fontSize: '12px',
    padding: '5px 8px', outline: 'none', width: '100%',
  }
  const lockedStyle = { ...inputStyle, color: '#3fb950', fontWeight: 600, background: '#0a1f0f', border: '1px solid #238636', letterSpacing: '0.06em' }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    const today = new Date().toISOString().slice(0, 10)
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    setWorking(true)
    try {
      const r = await fetch(`${API}/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator-Id': operatorId },
        body: JSON.stringify({
          flight_id:      flightId.trim().toUpperCase(),
          origin:         effectiveOrig.trim().toUpperCase(),
          destination:    effectiveDest.trim().toUpperCase(),
          flight_type:    flightType,
          departure_time: new Date(`${today}T${depTime}:00`).toISOString(),
          arrival_time:   new Date(`${today}T${arrTime}:00`).toISOString(),
          gate:           gate.trim().toUpperCase(),
          belt:           belt.trim(),
        }),
      })
      const data = await r.json()
      if (r.ok) {
        onAdd(`NEW FLIGHT ${data.flight_id} ${data.origin}→${data.destination} [${flightType.toUpperCase()}] gate ${data.gate} belt ${data.belt} [${online ? 'SYNCED' : 'PENDING'}]`)
        setFlightId(''); setOrig(''); setDest(''); setGate(''); setBelt('')
      } else {
        setError(data.detail?.[0]?.msg ?? data.detail ?? JSON.stringify(data))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label-upper" style={{ marginBottom: '2px' }}>Add Flight</div>

      {/* Toggle: OUTBOUND / INBOUND */}
      <div style={{ display: 'flex', gap: '0', borderRadius: '4px', overflow: 'hidden', border: '1px solid #30363d' }}>
        {['outbound', 'inbound'].map(type => (
          <button
            key={type} type="button"
            onClick={() => { setFlightType(type); setOrig(''); setDest('') }}
            style={{
              flex: 1, padding: '5px', border: 'none', cursor: 'pointer',
              fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
              background: flightType === type ? (type === 'inbound' ? '#071e26' : '#0a1f0f') : '#0d1117',
              color: flightType === type ? (type === 'inbound' ? '#22d3ee' : '#3fb950') : '#484f58',
              borderRight: type === 'outbound' ? '1px solid #30363d' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {type === 'outbound' ? '↑ OUTBOUND' : '↓ INBOUND'}
          </button>
        ))}
      </div>

      {/* Row 1: flight ID + ORIG → DEST */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, width: '68px', flex: 'none' }}
          placeholder="SK606" value={flightId}
          onChange={e => setFlightId(e.target.value)} required
        />
        {/* ORIG */}
        {isInbound
          ? <input style={{ ...inputStyle, width: '54px', flex: 'none', textAlign: 'center' }}
              placeholder="ORIG" value={orig} onChange={e => setOrig(e.target.value)} required />
          : <div style={{ ...lockedStyle, width: '54px', flex: 'none', textAlign: 'center', padding: '5px 8px', borderRadius: '4px', fontSize: '12px' }}>ARN</div>
        }
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58', flexShrink: 0 }}>→</span>
        {/* DEST */}
        {isInbound
          ? <div style={{ ...lockedStyle, flex: 1, padding: '5px 8px', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }}>ARN</div>
          : <input style={{ ...inputStyle, flex: 1 }}
              placeholder="DEST" value={dest} onChange={e => setDest(e.target.value)} required />
        }
      </div>

      {/* Row 2: DEP + ARR times */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', letterSpacing: '0.06em',
            color: isInbound ? '#484f58' : '#3fb950' }}>
            DEP{!isInbound ? ' *' : ''}
          </span>
          <input type="time" style={{ ...inputStyle }} value={depTime} onChange={e => setDepTime(e.target.value)} required />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '9px', letterSpacing: '0.06em',
            color: isInbound ? '#22d3ee' : '#484f58' }}>
            ARR{isInbound ? ' *' : ''}
          </span>
          <input type="time" style={{ ...inputStyle }} value={arrTime} onChange={e => setArrTime(e.target.value)} required />
        </div>
      </div>

      {/* Row 3: Gate + Belt */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Gate" value={gate} onChange={e => setGate(e.target.value)} required />
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Belt" value={belt} onChange={e => setBelt(e.target.value)} required />
      </div>
      <button type="submit" className="btn" disabled={working} style={{ width: '100%' }}>
        ADD
      </button>
      {error && (
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#b22222' }}>
          {error}
        </span>
      )}
    </form>
  )
}

function FlightActions({ onAdd }) {
  const [flights,    setFlights]    = useState([])
  const [flightId,   setFlightId]   = useState('')
  const [confirming, setConfirming] = useState(null) // 'cancel' | 'delay'
  const [working,    setWorking]    = useState(false)

  const loadFlights = () =>
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => {
        const active = data.filter(f => !['cancelled', 'arrived', 'departed'].includes(f.status))
        setFlights(active)
        setFlightId(prev => prev && active.find(f => f.flight_id === prev) ? prev : (active[0]?.flight_id ?? ''))
      })
      .catch(() => {})

  useEffect(() => { loadFlights() }, [])

  const selected  = flights.find(f => f.flight_id === flightId)
  const isInbound = selected?.flight_type === 'inbound'
  const isDelayed = selected?.status === 'delayed'

  const inputStyle = {
    background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px',
    color: '#e6edf3', fontFamily: 'IBM Plex Mono', fontSize: '12px',
    padding: '5px 8px', outline: 'none', width: '100%',
  }

  const actionBtn = (color) => ({
    fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 600,
    background: 'none', border: `1px solid ${color}66`,
    color, borderRadius: '3px', padding: '4px 0',
    cursor: 'pointer', letterSpacing: '0.04em', flex: 1,
  })

  const doStatus = async (status, successFn) => {
    setConfirming(null); setWorking(true)
    const op = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const r = await fetch(`${API}/flights/${flightId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-operator-id': op },
        body: JSON.stringify({ status }),
      })
      const d = await r.json()
      onAdd(r.ok ? successFn(d) : `ERROR: ${d.detail || 'Failed'}`)
      if (r.ok) loadFlights()
    } catch (err) { onAdd(`ERROR: ${err.message}`) }
    finally { setWorking(false) }
  }

  const doCancel = async () => {
    setConfirming(null); setWorking(true)
    const op = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const r = await fetch(`${API}/flights/${flightId}/cancel`, {
        method: 'POST', headers: { 'x-operator-id': op },
      })
      const d = await r.json()
      if (!r.ok) { onAdd(`ERROR: ${d.detail || 'Cancel failed'}`); return }
      const parts = []
      if (d.rerouted_bags)  parts.push(`${d.rerouted_bags} rerouted→${d.alternate_flight}`)
      if (d.on_hold_bags)   parts.push(`${d.on_hold_bags} on hold`)
      if (d.offloaded_bags) parts.push(`${d.offloaded_bags} to RCL`)
      onAdd(`${flightId} CANCELLED — ${parts.join(' · ') || 'no bags'}`)
      loadFlights()
    } catch (err) { onAdd(`ERROR: ${err.message}`) }
    finally { setWorking(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label-upper" style={{ marginBottom: '2px' }}>Flight Actions</div>
      <select value={flightId} onChange={e => { setFlightId(e.target.value); setConfirming(null) }} style={inputStyle}>
        {flights.map(f => (
          <option key={f.flight_id} value={f.flight_id}>
            {f.flight_id} — {f.destination} ({f.status})
          </option>
        ))}
      </select>

      {confirming === 'cancel' ? (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={doCancel} disabled={working} style={actionBtn('#f85149')}>CONFIRM CANCEL</button>
          <button onClick={() => setConfirming(null)} style={{ ...actionBtn('#484f58'), flex: 'none', padding: '4px 10px' }}>ABORT</button>
        </div>
      ) : confirming === 'delay' ? (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => doStatus('delayed', d => `${flightId} DELAYED — ${d.delayed_bags || 0} bags flagged`)} disabled={working} style={actionBtn('#d29922')}>CONFIRM DELAY</button>
          <button onClick={() => setConfirming(null)} style={{ ...actionBtn('#484f58'), flex: 'none', padding: '4px 10px' }}>ABORT</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '4px' }}>
          {isInbound && (
            <button disabled={working} onClick={() => doStatus('arrived', () => `${flightId} ARRIVED at ARN`)} style={actionBtn('#3fb950')}>
              ARRIVED
            </button>
          )}
          {!isInbound && !isDelayed && (
            <button disabled={working} onClick={() => setConfirming('delay')} style={actionBtn('#d29922')}>
              DELAY FLT
            </button>
          )}
          <button disabled={working} onClick={() => setConfirming('cancel')} style={actionBtn('#b22222')}>
            CANCEL FLT
          </button>
        </div>
      )}
    </div>
  )
}

function QuickAddBag({ onAdd, online }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const [flights, setFlights] = useState([])
  const [flight, setFlight]   = useState('')
  const [name, setName]       = useState('')
  const [weight, setWeight]   = useState('12.5')
  const [count, setCount]     = useState(1)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => {
        const active = data.filter(f => f.status !== 'cancelled').map(f => f.flight_id)
        setFlights(active)
        if (active.length > 0) setFlight(active[0])
      })
      .catch(() => {})
  }, [])

  const inputStyle = {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '4px',
    color: '#e6edf3',
    fontFamily: 'IBM Plex Mono',
    fontSize: '12px',
    padding: '5px 8px',
    outline: 'none',
    width: '100%',
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setWorking(true)
    const n = Math.max(1, Math.min(50, parseInt(count) || 1))
    const operatorId = localStorage.getItem('operator_id') || 'anonymous'
    try {
      const results = await Promise.all(
        Array.from({ length: n }, () =>
          fetch(`${API}/bags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Operator-Id': operatorId },
            body: JSON.stringify({
              flight_id: flight,
              passenger_name: name.trim(),
              weight_kg: parseFloat(weight) || 12.0,
            }),
          }).then(r => r.json().then(d => ({ ok: r.ok, data: d })))
        )
      )
      const ok     = results.filter(r => r.ok)
      const failed = results.filter(r => !r.ok)
      if (ok.length > 0) {
        if (n === 1) {
          onAdd(`NEW BAG ${ok[0].data.bag_id} for ${name} on ${flight} [${online ? 'SYNCED' : 'PENDING'}]`)
        } else {
          onAdd(`GENERATED ${ok.length} bags for ${name} on ${flight} [${online ? 'SYNCED' : 'PENDING'}]`)
        }
        setName('')
      }
      if (failed.length > 0) onAdd(`ERROR adding ${failed.length} bag(s)`)
    } catch (err) {
      onAdd(`ERROR: ${err.message}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label-upper" style={{ marginBottom: '2px' }}>Add Bag</div>
      {/* Row 1: passenger name (full width) */}
      <input
        style={inputStyle}
        placeholder="Passenger name"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      {/* Row 2: flight + weight + count + submit */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select value={flight} onChange={e => setFlight(e.target.value)} style={{ ...inputStyle, width: '82px', flex: 'none' }}>
          {flights.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          style={{ ...inputStyle, width: '54px', flex: 'none' }}
          type="number" step="0.1" min="0.5" max="50"
          value={weight} onChange={e => setWeight(e.target.value)}
          placeholder="kg"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 'none' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#484f58' }}>×</span>
          <input
            style={{ ...inputStyle, width: '36px', textAlign: 'center', padding: '5px 4px' }}
            type="number" min="1" max="50"
            value={count} onChange={e => setCount(e.target.value)}
            title="Number of bags to add"
          />
        </div>
        <button type="submit" className="btn" disabled={working} style={{ whiteSpace: 'nowrap', flex: 1 }}>
          ADD
        </button>
      </div>
    </form>
  )
}
