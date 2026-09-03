// Explicit, development-only demo-data switch.
//
// OFF by default. Turn it on for local visual inspection / backend-reference review by
// creating a `.env` (or `.env.local`) at the SAAS/ root with:
//
//   VITE_DEMO_DATA=true
//
// then restarting the Vite dev server.
//
// When OFF: screens that consult this use ONLY real API data (real records, or a truthful
// empty state, or a real error) - never local fixtures.
// When ON: those screens use ONLY local demo fixtures and simulate mutations locally -
// no real API mutation is attempted.
//
// `VITE_DEMO_DATA=empty` also enables demo mode but with ZERO fixtures - useful for
// checking the truthful empty state without touching real data.
//
// This is intentionally NOT a runtime UI toggle - it must never ship enabled to production.
const raw = import.meta.env.VITE_DEMO_DATA
export const DEMO_EMPTY = raw === 'empty'
export const DEMO_MODE = DEMO_EMPTY || raw === 'true' || raw === '1' || raw === true
