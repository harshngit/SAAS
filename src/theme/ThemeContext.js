import { createContext, useContext } from 'react'
import { DEFAULT_THEME } from '../api/theme'

// Default context value = the safe default theme, `refreshTheme`/`setOptimisticTheme` as no-ops.
// A component calling useTheme() outside <ThemeProvider>, or before the auth store has rehydrated,
// therefore always gets the exact current-CRM-default behavior rather than throwing or reading
// undefined - the same "never break existing screens" guarantee custom_enabled:false gives.
export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  refreshTheme: async () => {},
  setOptimisticTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}
