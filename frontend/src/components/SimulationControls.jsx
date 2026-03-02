import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function nowHMS() {
  return new Date().toLocaleTimeString('sv-SE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function LogLine({ entry }) {
  const keywordColors = {
    PAUSED:   '#b22222',
    OFFLINE:  '#b22222',
    RESUMED:  '#238636',
    ONLINE:   '#238636',
    SYNCING:  '#1f6feb',
    SEEDED:   '#1f6feb',
    SEED:     '#1f6feb',
    ERROR:    '#b22222',
    PENDING:  '#9e6a03',
  }

  // Tokenise by keyword boundaries
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

export default function SimulationControls({ health, onHealthChange }) {
  const [logs, setLogs]       = useState([])
  const [working, setWorking] = useState(false)

  const online = health?.online ?? true

  const addLog = (msg) => {
    setLogs(prev => [{ ts: nowHMS(), message: msg }, ...prev].slice(0, 8))
  }

  const call = async (path, successMsg, errorPrefix) => {
    setWorking(true)
    try {
      const r = await fetch(`${API}${path}`, { method: 'POST' })
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

  const handleSeed = () =>
    call(
      '/simulate/seed',
      (d) => `SEED complete — ${d.flights_seeded} flights, ${d.bags_seeded} bags SEEDED on Edge`,
      'seed',
    )

  const handleOffline = () =>
    call(
      '/simulate/offline',
      () => 'SIMULATE OUTAGE — Replication PAUSED. Writing to Edge only. OFFLINE.',
      'offline',
    )

  const handleOnline = () =>
    call(
      '/simulate/online',
      () => 'RESTORE CONNECTION — Replication RESUMED. Edge syncing to Main. ONLINE.',
      'online',
    )

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      <div className="label-upper">Simulation Controls</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          className="btn"
          onClick={handleSeed}
          disabled={working}
          style={{ justifyContent: 'flex-start' }}
        >
          Seed Test Data
        </button>

        <button
          className="btn btn-danger"
          onClick={handleOffline}
          disabled={working || !online}
          style={{ justifyContent: 'flex-start' }}
        >
          Simulate Outage
        </button>

        <button
          className="btn btn-success"
          onClick={handleOnline}
          disabled={working || online}
          style={{ justifyContent: 'flex-start' }}
        >
          Restore Connection
        </button>
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

      {/* Quick-add bag form */}
      <QuickAddBag onAdd={addLog} online={online} />
    </div>
  )
}

function QuickAddBag({ onAdd, online }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const flights = ['SK101', 'SK202', 'SK303', 'SK404', 'SK505']
  const [flight, setFlight]   = useState('SK101')
  const [name, setName]       = useState('')
  const [weight, setWeight]   = useState('12.5')
  const [working, setWorking] = useState(false)

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
      const r = await fetch(`${API}/bags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
