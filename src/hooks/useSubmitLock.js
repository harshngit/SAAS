import { useCallback, useRef } from 'react'

// Double-click guard for buttons that create money records (payments, collections, reconcile/void).
//
// A `loading` / `disabled` flag kept in React state only takes effect after the next render, so two clicks
// (or Enter + click) landing in the same moment can both start a request and create two payments. The lock
// lives in a ref, which is updated synchronously: the second call sees it at once and is ignored.
//
//   const { begin, end } = useSubmitLock(setIsSaving)
//   ...
//   if (!begin()) return          // instead of setIsSaving(true); a second submit while in flight returns here
//   const result = await createPayment(...)
//   end()                          // instead of setIsSaving(false); call it on EVERY path after begin()
//
// `setBusy` is the component's existing state setter, so the button's `loading` / `disabled` still show.
export default function useSubmitLock(setBusy) {
  const inFlight = useRef(false)

  const begin = useCallback(() => {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy?.(true)
    return true
  }, [setBusy])

  const end = useCallback(() => {
    inFlight.current = false
    setBusy?.(false)
  }, [setBusy])

  return { begin, end }
}
