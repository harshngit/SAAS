import { useEffect, useRef, useState } from 'react'
import { clearNavigationGuard, registerNavigationGuard } from './navigationGuardStore'

// Reusable "leave this page?" guard for a form with in-progress edits.
//
// Usage: compute a boolean `isDirty` for the form (and an `isSaving` flag while a submit is in
// flight), pass both in, then call `guardLeave(() => navigate(...))` from the page's own Back
// control instead of navigating directly. Render <UnsavedChangesModal /> (components/ui) wired
// to the returned state anywhere in the page.
//
// While dirty, this also registers itself as the active page's guard (navigationGuardStore) so
// the Sidebar's own nav links reuse this SAME confirm step instead of navigating straight away -
// see Sidebar.jsx. It still does NOT and cannot intercept the browser's physical Back/Forward
// buttons (this app uses a plain BrowserRouter, not a data router, so react-router's useBlocker
// isn't available, and there is no safe, non-hacky way to catch a physical back/forward press
// without one) - only the native beforeunload prompt covers the refresh/close/physical-back case,
// and that IS always available.
export function useUnsavedChangesGuard({ isDirty, isSaving = false }) {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const pendingLeaveRef = useRef(null)

  useEffect(() => {
    if (!isDirty) return undefined
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const guardLeave = (leave) => {
    if (isSaving) return // actively saving - ignore stray navigation attempts entirely
    if (!isDirty) {
      leave()
      return
    }
    pendingLeaveRef.current = leave
    setIsLeaveModalOpen(true)
  }

  useEffect(() => {
    if (!isDirty) return undefined
    registerNavigationGuard(guardLeave)
    return () => clearNavigationGuard(guardLeave)
    // guardLeave is intentionally re-created every render (it closes over isSaving /
    // pendingLeaveRef) - re-registering on every isDirty/isSaving change keeps the shared slot
    // pointing at a guard that reflects the current isSaving value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, isSaving])

  const confirmLeave = () => {
    setIsLeaveModalOpen(false)
    const leave = pendingLeaveRef.current
    pendingLeaveRef.current = null
    leave?.()
  }

  const cancelLeave = () => {
    setIsLeaveModalOpen(false)
    pendingLeaveRef.current = null
  }

  return { isLeaveModalOpen, guardLeave, confirmLeave, cancelLeave }
}
