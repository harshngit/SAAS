import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

let toastHandler = null

export function setToastHandler(handler) {
  toastHandler = handler
}

export function showGlobalToast(toast) {
  toastHandler?.(toast)
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}
