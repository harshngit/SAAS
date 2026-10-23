import { useEffect } from 'react'
import AppRoutes from './routes/AppRoutes'
import { ToastProvider } from './components/ui/Toast'
import ThemeProvider from './theme/ThemeProvider'
import EntitlementsProvider from './entitlements/EntitlementsProvider'
import { useAuthStore } from './store/authStore'
import { syncPushToken } from './push/pushService'

function App() {
  // Boot-time refresh for an already-signed-in session (page reload, or returning after closing
  // the tab) - login()/exchangeGoogleCode() in api/auth.js cover the two actual sign-in moments,
  // this covers every other app start. Fires at most once per browser session; syncPushToken
  // itself no-ops silently if push was never configured, isn't supported, or permission was never
  // granted, so this is always safe to call unconditionally here.
  const currentUserId = useAuthStore((state) => state.currentUser?.id)
  useEffect(() => {
    if (currentUserId) syncPushToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeProvider>
      <EntitlementsProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </EntitlementsProvider>
    </ThemeProvider>
  )
}

export default App
