import AppRoutes from './routes/AppRoutes'
import { ToastProvider } from './components/ui/Toast'
import ThemeProvider from './theme/ThemeProvider'
import EntitlementsProvider from './entitlements/EntitlementsProvider'

function App() {
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
