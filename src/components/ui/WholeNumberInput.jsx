import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import NumericInput from './NumericInput'
import { setWholeNumberInvalid } from './wholeNumberRegistry'

// Quantity-style field that only ever holds a whole number.
// Typing and pasting are treated the same way and nothing is blocked or rewritten behind the person's back:
//   - digits only -> passed to the form (onChange)
//   - anything else ("2.5", "2,5", "abc", "-1") -> stays in the box in red with an error message under it,
//     is NOT passed to the form, and the form cannot be saved / the order created until it is fixed
//     (the box registers itself in wholeNumberRegistry; every form checks invalidWholeNumberMessage() before saving)
// The red state stays when the box loses focus; it clears when the text is a whole number again or the value
// is changed from outside (the - / + buttons).
const DIGITS_ONLY = /^\d*$/

const WholeNumberInput = forwardRef(function WholeNumberInput(
  { value, onChange, onBlur, label = 'Quantity', className = '', ...rest },
  ref,
) {
  const id = useId()
  const innerRef = useRef(null)
  // Non-null only while the text in the box is not a whole number.
  const [rejected, setRejected] = useState(null)
  const [bubble, setBubble] = useState(null)
  const message = rejected === null ? '' : `${label}: "${rejected}" is not a whole number. Enter digits only, for example 2 or 25.`

  const setRefs = (node) => {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  // Changed from outside (the - / + buttons, a reset): whatever invalid text was in the box is gone.
  const lastValue = useRef(value)
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value
      setRejected(null)
    }
  }, [value])

  // Registered while invalid so the form can refuse to save; cleaned up when the box goes away (row removed).
  useEffect(() => {
    setWholeNumberInvalid(id, message)
    return () => setWholeNumberInvalid(id, '')
  }, [id, message])

  // The error bubble is drawn on the page (not inside the table cell) so a narrow / clipped cell cannot hide it.
  useLayoutEffect(() => {
    if (rejected === null) {
      setBubble(null)
      return undefined
    }
    const place = () => {
      const rect = innerRef.current?.getBoundingClientRect()
      // Centered under the box, kept inside the window (a box at the right edge would squash the bubble).
      if (rect) setBubble({ top: rect.bottom + 6, left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [rejected])

  const handleChange = (event) => {
    const text = event.target.value
    if (DIGITS_ONLY.test(text)) {
      setRejected(null)
      onChange?.(event)
      return
    }
    setRejected(text)
  }

  return (
    <>
      <NumericInput
        {...rest}
        ref={setRefs}
        type="text"
        inputMode="numeric"
        value={rejected ?? value}
        onChange={handleChange}
        // A rejected text is never handed to the blur handlers: they read event.target.value and would round it (2.5 -> 3).
        onBlur={(event) => { if (rejected === null) onBlur?.(event) }}
        aria-invalid={rejected !== null ? 'true' : undefined}
        className={`${className}${rejected !== null ? ' text-red-600 ring-2 ring-red-400' : ''}`}
      />
      {rejected !== null && bubble && createPortal(
        <div
          role="alert"
          style={{ position: 'fixed', top: bubble.top, left: bubble.left, transform: 'translateX(-50%)', width: 'max-content' }}
          className="z-[90] max-w-xs rounded-lg bg-red-600 px-2.5 py-1.5 text-[0.7rem] font-medium leading-snug text-white shadow-lg"
        >
          {message}
        </div>,
        document.body,
      )}
    </>
  )
})

export default WholeNumberInput
