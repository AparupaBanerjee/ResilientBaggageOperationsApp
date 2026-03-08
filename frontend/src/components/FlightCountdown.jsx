/**
 * FlightCountdown — horizontal strip showing time until departure for each flight.
 * Sits just below the status bar.
 */
import { useState, useEffect, useRef } from 'react'

const API  = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const mono = { fontFamily: 'IBM Plex Mono' }

const STATUS_COLORS = {
  boarding:  '#1f6feb',
  scheduled: '#238636',
  departed:  '#484f58',
  cancelled: '#b22222',
}

function minutesUntil(isoString) {
  try {
    return Math.round((new Date(isoString).getTime() - Date.now()) / 60000)
  } catch { return null }
}

function CountdownTile({ flight }) {
  const [mins, setMins] = useState(() => minutesUntil(flight.departure_time))

  useEffect(() => {
    const id = setInterval(() => setMins(minutesUntil(flight.departure_time)), 10000)
    return () => clearInterval(id)
  }, [flight.departure_time])

  const departed  = flight.status === 'departed'
  const cancelled = flight.status === 'cancelled'
  const urgent    = !departed && !cancelled && mins !== null && mins <= 30
  const warning   = !departed && !cancelled && mins !== null && mins <= 60 && mins > 30

  const borderColor = cancelled ? '#b22222' : urgent ? '#b22222' : warning ? '#9e6a03' : STATUS_COLORS[flight.status] ?? '#30363d'
  const textColor   = cancelled ? '#b22222' : urgent ? '#b22222' : warning ? '#9e6a03' : '#7d8590'

  let countdown = '—'
  if (departed)    countdown = 'DEPARTED'
  else if (cancelled) countdown = 'CANCELLED'
  else if (mins === null) countdown = '—'
  else if (mins < 0) countdown = 'BOARDING'
  else countdown = `T-${mins}m`

  return (
    <div style={{
      background: '#161b22',
      border: `1px solid ${borderColor}44`,
      borderBottom: `2px solid ${borderColor}`,
      borderRadius: '4px 4px 0 0',
      padding: '6px 12px',
      width: '100%',
      display: 'flex', flexDirection: 'column', gap: '2px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {urgent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: '#b22222',
          animation: 'pulse 1s ease-in-out infinite alternate',
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...mono, fontSize: '12px', fontWeight: 700, color: '#e6edf3' }}>
          {flight.flight_id}
        </span>
        <span style={{
          ...mono, fontSize: '9px', fontWeight: 700,
          color: STATUS_COLORS[flight.status] ?? '#484f58',
          letterSpacing: '0.05em',
        }}>
          {flight.status?.toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ ...mono, fontSize: '10px', color: '#7d8590' }}>
          {flight.destination?.split(' ')[0] ?? '—'} · G{flight.gate}
        </span>
        <span style={{ ...mono, fontSize: '13px', fontWeight: 700, color: textColor }}>
          {countdown}
        </span>
      </div>
    </div>
  )
}

export default function FlightCountdown() {
  const [flights, setFlights] = useState([])
  const timerRef = useRef(null)

  const fetch_ = () =>
    fetch(`${API}/flights`)
      .then(r => r.json())
      .then(data => setFlights(Array.isArray(data) ? data : []))
      .catch(() => {})

  useEffect(() => {
    fetch_()
    timerRef.current = setInterval(fetch_, 15000)
    return () => clearInterval(timerRef.current)
  }, [])

  if (!flights.length) return null

  return (
    <div style={{
      display: 'flex', gap: '6px',
    }}>
      {flights.map(f => (
        <div key={f.flight_id} style={{ flex: 1, minWidth: 0 }}>
          <CountdownTile flight={f} />
        </div>
      ))}
    </div>
  )
}
