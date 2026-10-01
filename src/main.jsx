import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Imported for its side effect: throws immediately if DEMO_MODE is ever enabled in a
// production build, regardless of which page the app happens to render first.
import './config/demoMode.js'
import App from './App.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
