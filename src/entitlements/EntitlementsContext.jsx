import { createContext, useContext } from 'react'

// Mirrors theme/ThemeContext.jsx's own default-value contract: a component calling
// useEntitlements() outside <EntitlementsProvider>, or before the first fetch resolves, gets
// safe no-op defaults - hasFeature/getLimit default to "allow" (see EntitlementsProvider's
// comment on why fail-open, not fail-closed) rather than throwing or hiding everything.
export const EntitlementsContext = createContext({
  isLoading: true,
  isReady: false,
  loadError: '',
  entitlements: null,
  features: {},
  limits: {},
  plan: null,
  subscriptionStatus: '',
  trialEndsAt: null,
  trialDaysLeft: null,
  hasFeature: () => true,
  getLimit: () => null,
  refreshEntitlements: async () => {},
})

export function useEntitlements() {
  return useContext(EntitlementsContext)
}
