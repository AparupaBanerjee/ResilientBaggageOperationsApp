import { useState, useEffect, useRef, useMemo } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function SnapshotStrip({ bags, health }) {
  const mono = { fontFamily: 'IBM Plex Mono' }
  const totalBags   = bags.filter(b => ['check_in', 'in_transit', 'loaded'].includes(b.status)).length
  const noShowHold  = bags.filter(b => b.hold_reason === 'passenger_no_show').length
  const misrouted   = bags.filter(b => b.misrouted).length
  const needsAttn   = noShowHold + misrouted
  const syncOnline  = health?.online ?? true
  const edgeBags    = health?.edge_bag_count ?? 0
  const mainBags    = health?.main_bag_count  ?? 0
  const inSync      = health?.counts_in_sync ?? true

  const metrics = [
    { label: 'BAGS IN SYSTEM',   value: totalBags,  color: '#e6edf3' },
    { label: 'NEEDS ATTENTION',  value: needsAttn,  color: needsAttn > 0 ? '#f85149' : '#484f58' },
    { label: 'MISROUTED',        value: misrouted,  color: misrouted > 0 ? '#b22222' : '#484f58' },
    { label: 'NO-SHOW HOLD',     value: noShowHold, color: noShowHold > 0 ? '#d29922' : '#484f58' },
  ]

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '6px',
      padding: '10px 16px',
      marginBottom: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '0',
      flexWrap: 'wrap',
    }}>
      <span style={{ ...mono, fontSize: '9px', color: '#484f58', letterSpacing: '0.1em', marginRight: '16px' }}>
        OPS SNAPSHOT
      </span>

      {metrics.map(m => (
        <div key={m.label} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0 16px',
          borderRight: '1px solid #21262d',
        }}>
          <span style={{ ...mono, fontSize: '18px', fontWeight: 700, color: m.color, lineHeight: 1 }}>
            {m.value}
          </span>
          <span style={{ ...mono, fontSize: '8px', color: '#484f58', letterSpacing: '0.08em', marginTop: '2px' }}>
            {m.label}
          </span>
        </div>
      ))}

      {/* Sync status */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 16px',
        borderRight: '1px solid #21262d',
      }}>
        <span style={{ ...mono, fontSize: '18px', fontWeight: 700, lineHeight: 1,
          color: !syncOnline ? '#b22222' : inSync ? '#3fb950' : '#d29922' }}>
          {!syncOnline ? 'OFF' : inSync ? 'SYNC' : 'LAG'}
        </span>
        <span style={{ ...mono, fontSize: '8px', color: '#484f58', letterSpacing: '0.08em', marginTop: '2px' }}>
          CLOUD SYNC
        </span>
      </div>

      {/* Edge vs Main counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}>
        <span style={{ ...mono, fontSize: '10px', color: '#484f58' }}>
          Edge <span style={{ color: '#e6edf3', fontWeight: 700 }}>{edgeBags}</span>
          {' · '}
          Main <span style={{ color: inSync ? '#e6edf3' : '#d29922', fontWeight: 700 }}>{mainBags}</span>
        </span>
      </div>
    </div>
  )
}

const WORKSTATIONS = [
  {
    id:     'WS-1',
    name:   'Security Screening',
    status: 'check_in',
    color:  '#7d8590',
    bg:     'rgba(125,133,144,0.06)',
    border: '#30363d',
    desc:   'Bags entering the system',
  },
  {
    id:     'WS-2',
    name:   'Conveyor Routing',
    status: 'in_transit',
    color:  '#388bfd',
    bg:     'rgba(56,139,253,0.06)',
    border: 'rgba(56,139,253,0.3)',
    desc:   'Bags on conveyor belts',
  },
  {
    id:     'WS-3',
    name:   'Aircraft Loading',
    status: 'loaded',
    color:  '#3fb950',
    bg:     'rgba(63,185,80,0.06)',
    border: 'rgba(63,185,80,0.3)',
    desc:   'Bags at gate for loading',
  },
]

function WorkstationPanel({ ws, bags }) {
  const filtered = useMemo(
    () => bags.filter(b => b.status === ws.status),
    [bags, ws.status]
  )

  return (
    <div style={{
      background: '#0d1117',
      border: `1px solid ${ws.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${ws.border}`,
        background: ws.bg,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 700,
            color: ws.color, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {ws.id}
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 700,
            color: '#e6edf3', letterSpacing: '0.04em',
          }}>
            {ws.name}
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono', fontSize: '9px', color: '#484f58',
            letterSpacing: '0.04em',
          }}>
            {ws.desc}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: '24px', fontWeight: 700,
          color: ws.color, lineHeight: 1,
        }}>
          {filtered.length}
        </span>
      </div>

      {/* Bag list */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '340px' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '16px', fontFamily: 'IBM Plex Mono', fontSize: '11px',
            color: '#484f58', textAlign: 'center',
          }}>
            No bags at this checkpoint
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21262d' }}>
                {['Bag ID', 'Passenger', 'Flight', 'Belt', 'Sync'].map(h => (
                  <th key={h} style={{
                    padding: '5px 10px', textAlign: 'left',
                    fontFamily: 'IBM Plex Mono', fontSize: '9px',
                    color: '#484f58', fontWeight: 400,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(bag => (
                <tr
                  key={bag.bag_id}
                  style={{
                    borderBottom: '1px solid #161b22',
                    background: bag.hold_reason === 'passenger_no_show'
                      ? 'rgba(178,34,34,0.08)' : undefined,
                  }}
                >
                  <td style={{
                    padding: '5px 10px',
                    fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#e6edf3',
                  }}>
                    {bag.bag_id}
                    {bag.hold_reason === 'passenger_no_show' && (
                      <span style={{
                        marginLeft: '4px', fontFamily: 'IBM Plex Mono', fontSize: '8px',
                        color: '#f85149', border: '1px solid #b2222244',
                        borderRadius: '2px', padding: '0 3px',
                      }}>NO-SHOW</span>
                    )}
                    {bag.misrouted && (
                      <span style={{
                        marginLeft: '4px', fontFamily: 'IBM Plex Mono', fontSize: '8px',
                        color: '#b22222', border: '1px solid #b2222244',
                        borderRadius: '2px', padding: '0 3px',
                      }}>MISROUTE</span>
                    )}
                  </td>
                  <td style={{
                    padding: '5px 10px', fontSize: '11px', color: '#e6edf3',
                    maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {bag.passenger_name}
                  </td>
                  <td style={{
                    padding: '5px 10px',
                    fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 500, color: '#e6edf3',
                  }}>
                    {bag.flight_id ?? '—'}
                  </td>
                  <td style={{
                    padding: '5px 10px',
                    fontFamily: 'IBM Plex Mono', fontSize: '11px',
                    color: bag.misrouted ? '#b22222' : '#7d8590',
                  }}>
                    {bag.destination_belt ?? '—'}
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <span style={{
                      fontFamily: 'IBM Plex Mono', fontSize: '9px', fontWeight: 500,
                      color: bag.source === 'edge_only' ? '#9e6a03' : '#3fb950',
                      letterSpacing: '0.04em',
                    }}>
                      {bag.source === 'edge_only' ? 'EDGE' : 'SYNC'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function WorkstationView({ health }) {
  const [bags,    setBags]    = useState([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  const fetchBags = () => {
    fetch(`${API}/bags`)
      .then(r => r.json())
      .then(data => { setBags(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchBags()
    timerRef.current = setInterval(fetchBags, 4000)
    return () => clearInterval(timerRef.current)
  }, [])

  const checkIn   = bags.filter(b => b.status === 'check_in').length
  const inTransit = bags.filter(b => b.status === 'in_transit').length
  const loaded    = bags.filter(b => b.status === 'loaded').length

  return (
    <div>
      {/* Operational snapshot */}
      <SnapshotStrip bags={bags} health={health} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        marginBottom: '12px',
      }}>
        <span className="label-upper" style={{ letterSpacing: '0.12em' }}>
          Operator Workstations
        </span>
        <span style={{
          fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58',
        }}>
          {checkIn + inTransit + loaded} bags in active checkpoints
        </span>
        {loading && (
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '10px', color: '#484f58' }}>
            Loading…
          </span>
        )}
      </div>

      {/* 3-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '14px',
      }}>
        {WORKSTATIONS.map(ws => (
          <WorkstationPanel key={ws.id} ws={ws} bags={bags} />
        ))}
      </div>

      {/* Status summary footer */}
      <div className="card" style={{ marginTop: '14px', padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label-upper" style={{ fontSize: '9px', color: '#484f58' }}>
            Belt Summary
          </span>
          {['A1','A2','B1','B2','C1'].map(belt => {
            const beltBags = bags.filter(b =>
              b.destination_belt === belt &&
              ['check_in','in_transit','loaded'].includes(b.status)
            )
            const misrouted = beltBags.filter(b => b.misrouted).length
            return (
              <div key={belt} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '11px', fontWeight: 700,
                  color: '#e6edf3',
                }}>
                  {belt}
                </span>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700,
                  color: misrouted > 0 ? '#b22222' : '#3fb950',
                }}>
                  {beltBags.length}
                </span>
                {misrouted > 0 && (
                  <span style={{
                    fontFamily: 'IBM Plex Mono', fontSize: '9px',
                    color: '#b22222', border: '1px solid #b2222244',
                    borderRadius: '2px', padding: '0 3px',
                  }}>
                    {misrouted} MISROUTED
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
