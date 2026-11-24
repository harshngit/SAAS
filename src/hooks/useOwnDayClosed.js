import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentDayEnd } from '../api/deliveryDayEnd'

// How often a locked screen re-checks the Day-End, so the lock lifts on its own once the admin rejects it
// (the partner is usually sitting on the page, not reloading it).
const RECHECK_WHILE_CLOSED_MS = 20000

// Is today's Day-End of a delivery partner closed?  GET /delivery-day-ends/current (today, the signed-in partner unless a
// partnerId is given). The backend closes the day as soon as it is SUBMITTED (waiting for the admin) and keeps it closed once it
// is APPROVED; a REJECTED day-end re-opens it. While closed, the vehicle load / extra load / end-of-day return / delivery confirm
// of that day are read-only. This only stops an obviously invalid action early - the backend stays authoritative and its
// rejection (409 DAY_END_CLOSED) is still shown. A failed lookup is treated as "not closed" (never blocks work on a guess).
//
// Returns: isClosed (submitted or approved), isSubmitted, isApproved, status. A closed screen re-checks every 20 s and when the
// tab becomes visible again, so a rejection unlocks it without a page reload.
export default function useOwnDayClosed({ partnerId, enabled = true } = {}) {
  const [dayEnd, setDayEnd] = useState(null)
  const [isChecking, setIsChecking] = useState(Boolean(enabled))
  const requestId = useRef(0)

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) { setDayEnd(null); setIsChecking(false); return null }
    const mine = requestId.current + 1
    requestId.current = mine
    if (!silent) setIsChecking(true)
    const result = await getCurrentDayEnd({ deliveryPartnerId: partnerId || undefined })
    if (mine !== requestId.current) return null // a newer check answered first
    const next = result.success ? result.dayEnd : null
    setDayEnd(next)
    setIsChecking(false)
    return next
  }, [enabled, partnerId])

  useEffect(() => { reload() }, [reload])

  const status = dayEnd?.status || ''
  const isSubmitted = status === 'submitted'
  const isApproved = status === 'approved'
  const isClosed = isSubmitted || isApproved

  useEffect(() => {
    if (!enabled || !isClosed) return undefined
    const recheck = () => { reload({ silent: true }) }
    const timer = setInterval(recheck, RECHECK_WHILE_CLOSED_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled, isClosed, reload])

  return { dayEnd, status, isClosed, isSubmitted, isApproved, isChecking, reload }
}
