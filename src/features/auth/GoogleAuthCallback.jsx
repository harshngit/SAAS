import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import FullScreenLoader from '../../components/ui/FullScreenLoader'
import { exchangeGoogleCode } from '../../api/auth'
import { resolveHomePath } from '../../auth/roles'

const ERROR_MESSAGES = {
  google_identity_conflict:
    'This email address is already linked to a different Google account. Please use password login or the correct Google account.',
}

function friendlyErrorMessage(error) {
  if (!error) return ''
  return ERROR_MESSAGES[error] || decodeURIComponent(error.replace(/\+/g, ' '))
}

export default function GoogleAuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState('')
  // React 18 StrictMode double-mounts effects in dev - a ticket is single-use, so a second
  // exchange attempt would fail with "already used". Guard against firing twice.
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true

    const exchangeCode = searchParams.get('exchange_code')
    const registrationCode = searchParams.get('registration_code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setErrorMessage(friendlyErrorMessage(errorParam))
      window.setTimeout(() => navigate('/login', { replace: true }), 3000)
      return
    }

    if (registrationCode) {
      navigate(`/auth/register/google?registration_code=${encodeURIComponent(registrationCode)}`, { replace: true })
      return
    }

    if (!exchangeCode) {
      setErrorMessage('No sign-in code was found in the link. Please try signing in again.')
      window.setTimeout(() => navigate('/login', { replace: true }), 3000)
      return
    }

    exchangeGoogleCode(exchangeCode).then((result) => {
      // Strip the one-time code from the address bar regardless of outcome.
      window.history.replaceState({}, document.title, '/auth/callback')

      if (!result.success) {
        setErrorMessage(result.error)
        window.setTimeout(() => navigate('/login', { replace: true }), 3000)
        return
      }

      navigate(resolveHomePath({ role: result.user?.role, currentUser: result.user }), { replace: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorMessage) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-6 text-center shadow-popover">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-neutral-900">Sign-in failed</p>
          <p className="mt-1.5 text-sm text-neutral-500">{errorMessage}</p>
          <p className="mt-3 text-xs text-neutral-400">Redirecting to sign in…</p>
        </div>
      </div>
    )
  }

  return <FullScreenLoader label="Completing secure sign-in…" />
}
