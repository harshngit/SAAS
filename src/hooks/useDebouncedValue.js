import { useEffect, useState } from 'react'

// Delays updating the returned value until `value` stops changing for `delayMs` - for a
// search box wired to a server call (OrderList.jsx), so typing doesn't fire a network request
// on every keystroke.
export function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
