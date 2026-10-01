import { Link } from 'react-router-dom'

// Subtle legal-page links shared by Login/Register/GoogleRegister - these pages render before a
// session exists, so /privacy, /terms and /help are the only way to reach those pages pre-login.
export default function AuthFooterLinks() {
  return (
    <p className="mt-6 text-center text-xs text-neutral-400">
      <Link to="/privacy" className="hover:text-neutral-600 hover:underline">Privacy Policy</Link>
      <span className="mx-2">·</span>
      <Link to="/terms" className="hover:text-neutral-600 hover:underline">Terms of Service</Link>
      <span className="mx-2">·</span>
      <Link to="/help" className="hover:text-neutral-600 hover:underline">Help</Link>
    </p>
  )
}
