import { useMemo, useState } from 'react'
import { CheckCircle, X } from 'lucide-react'
import { ToastContext } from './toastContext'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = ({ title, message, variant = 'success', duration = 3500 }) => {
    const id = `${Date.now()}-${Math.random()}`
    const toast = { id, title, message, variant }

    setToasts((current) => [...current, toast])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, duration)
  }

  const removeToast = (id) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }

  const value = useMemo(() => ({ showToast }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-5 top-5 z-[70] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-white p-4 shadow-(--shadow-popover)"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
              <CheckCircle className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">{toast.title}</p>
              {toast.message && <p className="mt-1 text-sm text-neutral-500">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Dismiss notification"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
