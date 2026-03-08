import { create } from 'zustand'

const MAX_FEED = 40       // rolling live feed
const MAX_INTERVENTIONS = 20

export const useScreeningStore = create((set, get) => ({
  // ── KPIs ──────────────────────────────────────────────────────────────────
  scanned:  0,
  passed:   0,
  failed:   0,
  manualQ:  0,

  // ── Live feed events ──────────────────────────────────────────────────────
  // Each: { id, ts, bag_id, flight_id, belt_id, result, reason, weight_kg }
  feed: [],

  // ── Intervention queue ────────────────────────────────────────────────────
  // Each: { id, ts, bag_id, flight_id, reason, belt_id }
  interventions: [],

  // ── Connection state ──────────────────────────────────────────────────────
  connected: false,

  // ── Actions ───────────────────────────────────────────────────────────────
  setConnected: (connected) => set({ connected }),

  pushEvent: (evt) => {
    const id = `${evt.bag_id}-${Date.now()}-${Math.random()}`
    const enriched = { ...evt, id }

    set(state => {
      const newFeed = [enriched, ...state.feed].slice(0, MAX_FEED)
      const scanned  = state.scanned + 1
      let passed   = state.passed
      let failed   = state.failed
      let manualQ  = state.manualQ
      let interventions = state.interventions

      if (evt.result === 'PASS') {
        passed += 1
      } else if (evt.result === 'FAIL') {
        failed += 1
        // Auto-promote fails to intervention queue
        const entry = {
          id,
          ts: evt.ts,
          bag_id: evt.bag_id,
          flight_id: evt.flight_id,
          belt_id: evt.belt_id,
          reason: evt.reason || 'Scan failure',
        }
        interventions = [entry, ...interventions].slice(0, MAX_INTERVENTIONS)
        manualQ += 1
      } else if (evt.result === 'MANUAL_REVIEW') {
        manualQ += 1
        const entry = {
          id,
          ts: evt.ts,
          bag_id: evt.bag_id,
          flight_id: evt.flight_id,
          belt_id: evt.belt_id,
          reason: evt.reason || 'Camera unreadable',
        }
        interventions = [entry, ...interventions].slice(0, MAX_INTERVENTIONS)
      }

      return { feed: newFeed, scanned, passed, failed, manualQ, interventions }
    })
  },

  clearIntervention: (id) => {
    set(state => ({
      interventions: state.interventions.filter(i => i.id !== id),
      manualQ: Math.max(0, state.manualQ - 1),
    }))
  },

  clearAllInterventions: () => {
    set(state => ({
      interventions: [],
      manualQ: 0,
    }))
  },

  reset: () => set({
    scanned: 0, passed: 0, failed: 0, manualQ: 0,
    feed: [], interventions: [], connected: false,
  }),
}))
