import { useCallback, useEffect, useState } from 'react'
import { getCurrentDayEnd } from '../api/deliveryDayEnd'

// Is today's Day-End of a delivery partner "Approved and Closed"?  GET /delivery-day-ends/current (today, the signed-in partner
// unless a partnerId is given). Once it is approved the day is closed: the vehicle load / end-of-day return of that day must be
// read-only. This only stops an obviously invalid action early - the backend stays authoritative and its rejection is still shown.
// A failed lookup is treated as "not closed" (never blocks work on a guess).
export default function useOwnDayClosed({ partnerId, enabled = true } = {}) {
  const [dayEnd, setDayEnd] = useState(null)
  const [isChecking, setIsChecking] = useState(Boolean(enabled))

  const reload = useCallback(async () => {
    if (!enabled) { setDayEnd(null); setIsChecking(false); return null }
    setIsChecking(true)
    const result = await getCurrentDayEnd({ deliveryPartnerId: partnerId || undefined })
    const next = result.success ? result.dayEnd : null
    setDayEnd(next)
    setIsChecking(false)
    return next
  }, [enabled, partnerId])

  useEffect(() => { reload() }, [reload])

  return { dayEnd, isClosed: dayEnd?.status === 'approved', isChecking, reload }
}
