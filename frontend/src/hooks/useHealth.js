import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useHealth(intervalMs = 3000) {
  const [health, setHealth]   = useState(null)
  const [error, setError]     = useState(null)
  const [syncEta, setSyncEta] = useState(null)   // seconds until sync complete, or null

  const prevPendingRef  = useRef(null)
  const drainRateRef    = useRef(null)            // bags drained per second
  const timerRef        = useRef(null)

  const fetch_health = () => {
    fetch(`${API}/health`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setHealth(data)
        setError(null)

        const pending = data.pending_sync_count ?? 0
        const online  = data.online

        if (online && pending > 0) {
          const prev = prevPendingRef.current
          if (prev != null && prev > pending) {
            // Update drain rate estimate (exponential smoothing α=0.4)
            const newRate = (prev - pending) / (intervalMs / 1000)
            drainRateRef.current = drainRateRef.current == null
              ? newRate
              : 0.6 * drainRateRef.current + 0.4 * newRate
          }
          if (drainRateRef.current && drainRateRef.current > 0) {
            setSyncEta(Math.ceil(pending / drainRateRef.current))
          }
        } else {
          if (pending === 0) setSyncEta(null)
          if (!online) drainRateRef.current = null
        }

        prevPendingRef.current = pending
      })
      .catch(err => { setError(err.message) })
  }

  useEffect(() => {
    fetch_health()
    timerRef.current = setInterval(fetch_health, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [intervalMs])

  return { health, error, syncEta }
}
