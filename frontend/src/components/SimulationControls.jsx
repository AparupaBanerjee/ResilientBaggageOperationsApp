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

const SEVERITY_COLORS = { HIGH: '#b22222', MEDIUM: '#9e6a03', LOW: '#238636' }

function OutageForecast({ online }) {
  const [forecast, setForecast] = useState(null)
  const [duration, setDuration] = useState(5)

  useEffect(() => {
    if (!online) { setForecast(null); return }
    fetch(`${API}/predict/outage-impact?duration_min=${duration}`)
      .then(r => r.json())
      .then(setForecast)
      .catch(() => setForecast(null))
  }, [online, duration])

  if (!online || !forecast) return null

  const sev   = forecast.severity ?? 'LOW'
  const color = SEVERITY_COLORS[sev]

  return (
    <div style={{
      background: '#0d1117',
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '4px',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58', letterSpacing: '0.06em' }}>
          OUTAGE IMPACT FORECAST
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58' }}>for</span>
          <select
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '3px',
              color: '#e6edf3',
              fontFamily: 'IBM Plex Mono',
              fontSize: '10px',
              padding: '1px 4px',
              outline: 'none',
            }}
          >
            {[2, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '20px', fontWeight: 600, color }}>
          ~{forecast.estimated_unsynced_bags}
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590' }}>
          bags unsynced · severity
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', fontWeight: 600, color }}>
          {sev}
        </span>
      </div>

      {forecast.high_risk_flights?.length > 0 && (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#9e6a03' }}>
          AT RISK:{' '}
          {forecast.high_risk_flights.map(f =>
            `${f.flight_id} (T-${Math.max(0, f.minutes_until_departure)}m)`
          ).join('  ·  ')}
        </div>
      )}
    </div>
  )
}

export default function SimulationControls({ health, onHealthChange }) {
  const [logs, setLogs]           = useState([])
  const [working, setWorking]     = useState(false)
  const [loadCount, setLoadCount] = useState(10)

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

  const handleSeed     = () => call('/simulate/seed',
    (d) => `SEED complete — ${d.flights_seeded} flights, ${d.bags_seeded} bags SEEDED on Edge`, 'seed')

  const handleOffline  = () => call('/simulate/offline',
    () => 'SIMULATE OUTAGE — Replication PAUSED. Writing to Edge only. OFFLINE.', 'offline')

  const handleOnline   = () => call('/simulate/online',
    () => 'RESTORE CONNECTION — Replication RESUMED. Edge syncing to Main. ONLINE.', 'online')

  const handleLoad     = () => call(`/simulate/load?count=${loadCount}`,
    (d) => `GENERATED ${d.inserted} bags — throughput counter updating`, 'load')

  const handleMisroute = () => call('/simulate/misroute',
    (d) => `MISROUTED ${d.bag_id} (${d.flight_id}) → belt ${d.wrong_belt} (correct: ${d.correct_belt})`, 'misroute')

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      <div className="label-upper">Simulation Controls</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="btn" onClick={handleSeed} disabled={working} style={{ justifyContent: 'flex-start' }}>
          Seed Test Data
        </button>

        {/* Predictive outage impact — only visible when online */}
        <OutageForecast online={online} />

        <button className="btn btn-danger" onClick={handleOffline} disabled={working || !online} style={{ justifyContent: 'flex-start' }}>
          Simulate Outage
        </button>

        <button className="btn btn-success" onClick={handleOnline} disabled={working || online} style={{ justifyContent: 'flex-start' }}>
          Restore Connection
        </button>

        <button className="btn btn-danger" onClick={handleMisroute} disabled={working} style={{ justifyContent: 'flex-start' }}>
          Inject Misrouting
        </button>

        {/* Generate traffic row */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #21262d' }}>
          <input
            type="number"
            min="1"
            max="50"
            value={loadCount}
            onChange={e => setLoadCount(Number(e.target.value))}
            style={{
              width: '56px',
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#e6edf3',
              fontFamily: 'IBM Plex Mono',
              fontSize: '12px',
              padding: '5px 8px',
              outline: 'none',
              textAlign: 'center',
            }}
          />
          <button className="btn" onClick={handleLoad} disabled={working} style={{ flex: 1, justifyContent: 'flex-start' }}>
            Generate Traffic
          </button>
        </div>
      </div>

      {/* Event log */}
      <div style={{
        flex: 1,
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: '4px',
        padding: '8px 10px',
        overflowY: 'auto',
        maxHeight: '160px',
        minHeight: '80px',
      }}>
        {logs.length === 0 ? (
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: '#484f58' }}>
            Awaiting events...
          </span>
        ) : (
          logs.map((entry, i) => <LogLine key={i} entry={entry} />)
        )}
      </div>

      <QuickAddBag onAdd={addLog} online={online} />
      <QuickAddFlight onAdd={addLog} online={online} />
    </div>
  )
}

function QuickAddFlight({ onAdd, online }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const [flightId, setFlightId]   = useState('')
  const [dest, setDest]           = useState('')
  const [depTime, setDepTime]     = useState('12:00')
  const [gate, setGate]           = useState('')
  const [belt, setBelt]           = useState('')
  const [working, setWorking]     = useState(false)
  const [error, setError]         = useState('')

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
    setError('')
    if (!flightId.trim() || !dest.trim() || !gate.trim() || !belt.trim()) return
    setWorking(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const departure_time = new Date(`${today}T${depTime}:00`).toISOString()
      const operatorId = localStorage.getItem('operator_id') || 'anonymous'
      const r = await fetch(`${API}/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator-Id': operatorId },
        body: JSON.stringify({
          flight_id: flightId.trim().toUpperCase(),
          destination: dest.trim(),
          departure_time,
          gate: gate.trim().toUpperCase(),
          belt: belt.trim(),
        }),
      })
      const data = await r.json()
      if (r.ok) {
        onAdd(`NEW FLIGHT ${data.flight_id} → ${data.destination} gate ${data.gate} belt ${data.belt} [${online ? 'SYNCED' : 'PENDING'}]`)
        setFlightId(''); setDest(''); setGate(''); setBelt('')
      } else {
        const msg = data.detail?.[0]?.msg ?? data.detail ?? JSON.stringify(data)
        setError(msg)
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
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          style={{ ...inputStyle, width: '80px' }}
          placeholder="SK606"
          value={flightId}
          onChange={e => setFlightId(e.target.value)}
          required
        />
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Destination"
          value={dest}
          onChange={e => setDest(e.target.value)}
          required
        />
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="time"
          style={{ ...inputStyle, width: '90px' }}
          value={depTime}
          onChange={e => setDepTime(e.target.value)}
          required
        />
        <input
          style={{ ...inputStyle, width: '70px' }}
          placeholder="Gate"
          value={gate}
          onChange={e => setGate(e.target.value)}
          required
        />
        <input
          style={{ ...inputStyle, width: '60px' }}
          placeholder="Belt"
          value={belt}
          onChange={e => setBelt(e.target.value)}
          required
        />
        <button type="submit" className="btn" disabled={working} style={{ whiteSpace: 'nowrap' }}>
          ADD
        </button>
      </div>
      {error && (
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#b22222' }}>
          {error}
        </span>
      )}
    </form>
  )
}

function QuickAddBag({ onAdd, online }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const [flights, setFlights] = useState([])
  const [flight, setFlight]   = useState('')
  const [name, setName]       = useState('')
  const [weight, setWeight]   = useState('12.5')
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
    try {
      const operatorId = localStorage.getItem('operator_id') || 'anonymous'
      const r = await fetch(`${API}/bags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Id': operatorId,
        },
        body: JSON.stringify({
          flight_id: flight,
          passenger_name: name.trim(),
          weight_kg: parseFloat(weight) || 12.0,
        }),
      })
      const data = await r.json()
      if (r.ok) {
        onAdd(`NEW BAG ${data.bag_id} for ${name} on ${flight} [${online ? 'SYNCED' : 'PENDING'}]`)
        setName('')
      } else {
        onAdd(`ERROR adding bag: ${data.detail}`)
      }
    } catch (err) {
      onAdd(`ERROR: ${err.message}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label-upper" style={{ marginBottom: '2px' }}>Add Bag</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <select value={flight} onChange={e => setFlight(e.target.value)} style={{ ...inputStyle, width: '90px' }}>
          {flights.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Passenger name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <input
          style={{ ...inputStyle, width: '60px' }}
          type="number"
          step="0.1"
          min="0.5"
          max="50"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="kg"
        />
        <button type="submit" className="btn" disabled={working} style={{ whiteSpace: 'nowrap' }}>
          ADD
        </button>
      </div>
    </form>
  )
}
