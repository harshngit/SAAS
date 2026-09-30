import AppRoutes from './routes/AppRoutes'
import { ToastProvider } from './components/ui/Toast'
import ThemeProvider from './theme/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
