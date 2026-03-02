import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useHealth(intervalMs = 3000) {
  const [health, setHealth] = useState(null)
  const [error, setError]   = useState(null)
  const timerRef = useRef(null)

  const fetch_health = () => {
    fetch(`${API}/health`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => { setHealth(data); setError(null) })
      .catch(err => { setError(err.message) })
  }

  useEffect(() => {
    fetch_health()
    timerRef.current = setInterval(fetch_health, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [intervalMs])

  return { health, error }
}
