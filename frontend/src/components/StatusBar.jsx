import { useState, useEffect, useRef } from 'react'

const TERMINALS = [
  { id: 'T1', label: 'Terminal 1' },
  { id: 'T2', label: 'Terminal 2' },
  { id: 'T3', label: 'Terminal 3' },
  { id: 'T4', label: 'Terminal 4' },
  { id: 'T5', label: 'Terminal 5' },
]

function AirportSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const terminal = TERMINALS.find(t => t.id === selected) || TERMINALS[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: open ? '#1c2128' : 'transparent',
          border: '1px solid',
          borderColor: open ? '#388bfd' : '#30363d',
          borderRadius: '6px',
          padding: '5px 10px 5px 8px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Terminal icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7d8590" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>

        {/* Terminal label */}
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700,
          color: '#e6edf3', letterSpacing: '0.04em', whiteSpace: 'nowrap',
        }}>
          {terminal.label}
        </span>

        {/* Chevron */}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="#484f58" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: '#161b22', border: '1px solid #30363d', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: '280px', zIndex: 999, overflow: 'hidden',
          padding: '4px 0',
        }}>
          {/* Header */}
          <div style={{
            padding: '6px 12px 4px',
            fontFamily: 'IBM Plex Mono', fontSize: '9px',
            letterSpacing: '0.12em', color: '#484f58',
            textTransform: 'uppercase', borderBottom: '1px solid #21262d',
            marginBottom: '4px',
          }}>
            ARN · Stockholm Arlanda
          </div>

          {TERMINALS.map(t => {
            const isActive = t.id === selected
            return (
              <button
                key={t.id}
                onClick={() => { onChange(t.id); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: '10px', padding: '8px 12px',
                  background: isActive ? '#1c2128' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderLeft: isActive ? '2px solid #388bfd' : '2px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#161b22' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Terminal label */}
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 700,
                  color: isActive ? '#388bfd' : '#e6edf3',
                  letterSpacing: '0.04em',
                }}>
                  {t.label}
                </span>

                {/* Active checkmark */}
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'ops',          label: 'LIVE OPS' },
  { id: 'baggage',      label: 'BAGGAGE HALL' },
  { id: 'workstations', label: 'WORKSTATIONS' },
  { id: 'audit',        label: 'AUDIT' },
]

export default function StatusBar({ health, activeTab, onTabChange, onLogout }) {
  const online   = health?.online ?? true
  const pending  = health?.pending_sync_count ?? 0
  const operator = localStorage.getItem('operator_id') || ''

  const handleLogout = () => {
    localStorage.removeItem('operator_auth')
    localStorage.removeItem('operator_id')
    onLogout?.()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '64px',
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 100,
    }}>
      {/* Left — App name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Baggage conveyor logo */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          {/* Conveyor belt body */}
          <rect x="2" y="13" width="24" height="7" rx="3.5" stroke="#f59e0b" strokeWidth="1.8"/>
          {/* Belt dashes */}
          <line x1="7" y1="13" x2="7" y2="20" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2"/>
          <line x1="14" y1="13" x2="14" y2="20" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2"/>
          <line x1="21" y1="13" x2="21" y2="20" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2"/>
          {/* Wheels */}
          <circle cx="5.5" cy="16.5" r="3" fill="#0d1117" stroke="#f59e0b" strokeWidth="1.8"/>
          <circle cx="22.5" cy="16.5" r="3" fill="#0d1117" stroke="#f59e0b" strokeWidth="1.8"/>
          {/* Bag on belt */}
          <rect x="9" y="6" width="10" height="8" rx="2" fill="#1f6feb" stroke="#388bfd" strokeWidth="1.2"/>
          {/* Bag handle */}
          <path d="M11.5 6 Q14 3.5 16.5 6" stroke="#388bfd" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          {/* Bag tag */}
          <line x1="17" y1="10" x2="19.5" y2="10" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: '15px', fontWeight: 800,
            color: '#e6edf3', letterSpacing: '0.07em', whiteSpace: 'nowrap',
            lineHeight: 1.1,
          }}>
            Resilient Baggage Operations
          </span>
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 500,
            color: '#f59e0b', letterSpacing: '0.12em', whiteSpace: 'nowrap',
          }}>
            ARN · STOCKHOLM ARLANDA
          </span>
        </div>
      </div>

      {/* Center — Tab navigation */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', gap: '0' }}>
        {TABS.map(tab => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: active ? '2px solid #388bfd' : '2px solid transparent',
                borderTop: '2px solid transparent',
                color: active ? '#e6edf3' : '#484f58',
                fontFamily: 'IBM Plex Mono', fontSize: '12px',
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.07em',
                padding: '0 22px',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#7d8590' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#484f58' }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Right — operator ID + connection status + pending */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Operator name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58', letterSpacing: '0.06em' }}>OP</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 700, color: '#e6edf3' }}>
            {operator}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#484f58',
            fontFamily: 'IBM Plex Mono',
            fontSize: '10px',
            letterSpacing: '0.06em',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#b22222'; e.currentTarget.style.color = '#b22222' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.color = '#484f58' }}
        >
          LOGOUT
        </button>

        <div style={{ width: '1px', height: '20px', background: '#30363d' }} />

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            {online ? (
              <>
                <path d="M1.5 8.5C5 4.8 9.2 3 12 3s7 1.8 10.5 5.5" stroke="#238636" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4.5 11.5C7 9 9.4 8 12 8s5 1 7.5 3.5" stroke="#238636" strokeWidth="2" strokeLinecap="round"/>
                <path d="M7.5 14.5C9 13 10.4 12.5 12 12.5s3 .5 4.5 2" stroke="#238636" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="18" r="1.5" fill="#238636"/>
              </>
            ) : (
              <>
                <path d="M1.5 8.5C5 4.8 9.2 3 12 3s7 1.8 10.5 5.5" stroke="#484f58" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4.5 11.5C7 9 9.4 8 12 8s5 1 7.5 3.5" stroke="#484f58" strokeWidth="2" strokeLinecap="round"/>
                <path d="M7.5 14.5C9 13 10.4 12.5 12 12.5s3 .5 4.5 2" stroke="#484f58" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="18" r="1.5" fill="#484f58"/>
                <line x1="3" y1="3" x2="21" y2="21" stroke="#b22222" strokeWidth="2" strokeLinecap="round"/>
              </>
            )}
          </svg>
          <span style={{
            fontFamily: 'Inter',
            fontSize: '12px',
            color: online ? '#e6edf3' : '#484f58',
            fontWeight: 500,
          }}>
            {online ? 'ONLINE' : 'OFFLINE — Sync paused. Writing to edge only.'}
          </span>
        </div>

        {pending > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderLeft: '1px solid #30363d',
            paddingLeft: '16px',
          }}>
            <span style={{ color: '#7d8590', fontSize: '11px', letterSpacing: '0.06em' }}>PENDING</span>
            <span style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: '13px',
              color: '#9e6a03',
              fontWeight: 500,
            }}>{pending}</span>
          </div>
        )}
      </div>
    </div>
  )
}
