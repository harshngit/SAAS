import { forwardRef, useRef, useState } from 'react'
import NumericInput from './NumericInput'
import { showGlobalToast } from './toastContext'

// Quantity-style field that only ever holds a whole number.
// It never rewrites what the person typed behind their back (a controlled number input used to turn
// "2.5" into 25 while typing and 2 when pasted):
//   - the keys . , e E + - are blocked, with a message
//   - pasted / dropped text that is not digits is kept on screen, flagged, NOT passed on to the form,
//     and a message explains it; when the field loses focus it shows the last valid value again
// `onChange` is only called with digits-only text, so callers can keep using event.target.value.
const BLOCKED_KEYS = new Set(['.', ',', 'e', 'E', '+', '-'])
const DIGITS_ONLY = /^\d*$/

const WholeNumberInput = forwardRef(function WholeNumberInput(
  { value, onChange, onBlur, onKeyDown, label = 'Quantity', className = '', ...rest },
  ref,
) {
  // Non-null only while the text in the box is not a whole number.
  const [rejected, setRejected] = useState(null)
  const lastWarnAt = useRef(0)

  const warn = (text) => {
    const now = Date.now()
    if (now - lastWarnAt.current < 2500) return
    lastWarnAt.current = now
    showGlobalToast({
      title: `${label} must be a whole number`,
      message: text ? `"${text}" was not accepted. Use digits only, for example 2 or 25.` : 'Use digits only, for example 2 or 25.',
      variant: 'error',
    })
  }

  const handleKeyDown = (event) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    if (BLOCKED_KEYS.has(event.key)) {
      event.preventDefault()
      warn(event.key)
    }
  }

  const handleChange = (event) => {
    const text = event.target.value
    if (DIGITS_ONLY.test(text)) {
      setRejected(null)
      onChange?.(event)
      return
    }
    setRejected(text)
    warn(text)
  }

  const handleBlur = (event) => {
    // A rejected text is dropped, not passed on: blur handlers read event.target.value and would round it (2.5 -> 3).
    const hadRejected = rejected !== null
    setRejected(null)
    if (!hadRejected) onBlur?.(event)
  }

  return (
    <NumericInput
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={rejected ?? value}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onBlur={handleBlur}
      aria-invalid={rejected !== null ? 'true' : undefined}
      className={`${className}${rejected !== null ? ' text-red-600 ring-1 ring-red-400' : ''}`}
    />
  )
})

export default WholeNumberInput
