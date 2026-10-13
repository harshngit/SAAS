import { planErrorCode } from '../../api/entitlements'

// Global trigger for the storage-limit modal, mirroring toastContext.js's module-level handler
// pattern - lets any upload call site (a component's catch block, a shared upload helper) show
// the shared modal without needing React context plumbing of its own.
let storageLimitHandler = null

export function setStorageLimitHandler(handler) {
  storageLimitHandler = handler
}

export function showStorageLimitModal() {
  storageLimitHandler?.()
}

// The one place every upload call site checks for a storage-limit rejection. Returns true when
// the error WAS a storage-limit rejection (and has already triggered the shared modal) so the
// caller's catch block can skip its normal/generic error handling; returns false for every other
// error so callers fall through to their existing handling unchanged.
export function handleStorageLimitError(error) {
  if (planErrorCode(error) !== 'PLAN_STORAGE_LIMIT_REACHED') return false
  showStorageLimitModal()
  return true
}
