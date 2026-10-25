import { createContext, useContext } from 'react'

// Mirrors entitlements/EntitlementsContext.jsx's own contract: a component calling
// useFieldSettings() outside <FieldSettingsProvider>, or before the first fetch resolves, gets
// safe fail-open defaults - isFieldVisible defaults to true (never hide a field just because
// settings haven't loaded yet; a slow/failed fetch should never make every form look broken).
export const FieldSettingsContext = createContext({
  isLoading: true,
  loadError: '',
  availableFields: {},
  fieldSettings: {},
  isFieldVisible: () => true,
  getFieldMeta: () => null,
  refreshFieldSettings: async () => {},
})

export function useFieldSettings() {
  return useContext(FieldSettingsContext)
}
