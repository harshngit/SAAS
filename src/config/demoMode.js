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

// Hard fail-safe: demo mode must never reach a production build, by accident or by a
// misconfigured deploy env. This module is imported for its side effect at app startup
// (see main.jsx) specifically so this check always runs, regardless of which page loads first.
if (DEMO_MODE && import.meta.env.PROD) {
  throw new Error(
    'DEMO_MODE is enabled in a production build (VITE_DEMO_DATA is set to a truthy value). ' +
      'This must never ship live - set VITE_DEMO_DATA=false (or remove it) in the production environment and rebuild.',
  )
}
