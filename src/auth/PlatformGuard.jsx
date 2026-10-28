import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentProfile } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { hasPlatformAccess } from './platformRoles'
import FullScreenLoader from '../components/ui/FullScreenLoader'
import Button from '../components/ui/Button'

export default function PlatformGuard({ superAdminOnly = false, children }) {
  const currentUser = useAuthStore(state => state.currentUser)
  const location = useLocation()
  const [check, setCheck] = useState({ loading: true, error: '', status: null, checked: false })
  const [retry, setRetry] = useState(0)
  const userId = currentUser?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    let pending = false
    async function verify() {
      if (pending) return
      pending = true
      const result = await getCurrentProfile()
      pending = false
      if (!active) return
      if (result.success && result.user?.is_active === false) { useAuthStore.getState().logout(); return }
      setCheck({ loading: false, error: result.success ? '' : result.error, status: result.status, checked: true })
    }
    // Only block the UI on the very first check for this session - a route change or window
    // focus re-verifies the session silently in the background (no full-screen flash on every
    // in-app navigation), and only surfaces if the re-check actually fails.
    setCheck(current => (current.checked ? current : { ...current, loading: true }))
    verify()
    const onFocus = verify
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(verify, 60000)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [userId, retry, location.pathname])
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location }} />
  if (check.loading) return <FullScreenLoader label="Checking platform access..." />
  if (check.error) return <div role="alert" className="p-6 text-sm text-red-700"><h1 className="text-xl font-semibold">{check.status === 403 ? "You don't have access" : 'Unable to verify your session'}</h1><p className="my-3">{check.error}</p><Button onClick={() => setRetry(value => value + 1)}>Retry</Button></div>
  if (!hasPlatformAccess(currentUser, superAdminOnly)) return <div role="alert" className="p-6"><h1 className="text-xl font-semibold">You don&apos;t have access</h1><p className="mt-2">This page is restricted to authorized platform staff.</p></div>
  return children
}
