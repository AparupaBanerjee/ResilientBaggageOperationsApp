import { useState } from 'react'

const VALID_USERS = ['aparupa', 'pritha', 'priyanka', 'kamali']
const PASSWORD    = '1234'

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [shake,    setShake]    = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const valid = VALID_USERS.includes(username.trim().toLowerCase()) && password === PASSWORD
    if (!valid) {
      setError('Invalid username or password')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    const display = username.trim().charAt(0).toUpperCase() + username.trim().slice(1).toLowerCase()
    localStorage.setItem('operator_id', display)
    localStorage.setItem('operator_auth', '1')
    onLogin()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Amber runway strip */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
        background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 40px,transparent 40px,transparent 60px)',
      }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '380px',
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '10px',
        overflow: 'hidden',
        animation: shake ? 'shake 0.4s ease' : 'none',
      }}>

        {/* Header */}
        <div style={{
          background: '#0c2340',
          padding: '28px 32px 24px',
          borderBottom: '3px solid #f59e0b',
          textAlign: 'center',
        }}>
          <svg width="48" height="48" viewBox="0 0 28 28" fill="none" style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }}>
            <rect x="2" y="13" width="24" height="7" rx="3.5" stroke="#f59e0b" strokeWidth="1.8"/>
            <line x1="7" y1="13" x2="7" y2="20" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2"/>
            <line x1="14" y1="13" x2="14" y2="20" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2"/>
            <line x1="21" y1="13" x2="21" y2="20" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2"/>
            <circle cx="5.5" cy="16.5" r="3" fill="#0c2340" stroke="#f59e0b" strokeWidth="1.8"/>
            <circle cx="22.5" cy="16.5" r="3" fill="#0c2340" stroke="#f59e0b" strokeWidth="1.8"/>
            <rect x="9" y="6" width="10" height="8" rx="2" fill="#1f6feb" stroke="#388bfd" strokeWidth="1.2"/>
            <path d="M11.5 6 Q14 3.5 16.5 6" stroke="#388bfd" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            <line x1="17" y1="10" x2="19.5" y2="10" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700,
            color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '4px',
          }}>
            ARN · STOCKHOLM ARLANDA
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '16px', fontWeight: 700,
            color: '#e6edf3', letterSpacing: '0.06em',
          }}>
            Resilient Baggage Operations
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: '12px', color: '#7d8590', marginTop: '6px' }}>
            Operator login required
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{
              fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
              style={{
                background: '#0d1117',
                border: `1px solid ${error ? '#b22222' : '#30363d'}`,
                borderRadius: '6px',
                color: '#e6edf3',
                fontFamily: 'IBM Plex Mono',
                fontSize: '13px',
                padding: '10px 12px',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{
              fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#7d8590',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="••••"
              autoComplete="current-password"
              style={{
                background: '#0d1117',
                border: `1px solid ${error ? '#b22222' : '#30363d'}`,
                borderRadius: '6px',
                color: '#e6edf3',
                fontFamily: 'IBM Plex Mono',
                fontSize: '14px',
                padding: '10px 12px',
                outline: 'none',
                letterSpacing: '0.2em',
                transition: 'border-color 0.15s',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: '#b22222', letterSpacing: '0.04em' }}>
              ✕ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={{
              marginTop: '4px', padding: '12px',
              background: '#238636', border: '1px solid #2ea043',
              borderRadius: '6px', color: '#fff',
              fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.06em', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#2ea043'}
            onMouseLeave={e => e.currentTarget.style.background = '#238636'}
          >
            LOGIN
          </button>
        </form>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '24px', fontFamily: 'IBM Plex Mono', fontSize: '10px',
        color: '#30363d', letterSpacing: '0.08em', textAlign: 'center',
      }}>
        Swedavia · Hackathon 2026 · Edge-First Resilience Demo
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
    </div>
  )
}
