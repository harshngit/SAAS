import { forwardRef, useState } from 'react'

function selectZero(event) {
  const input = event.currentTarget
  if (!event.defaultPrevented && !input.disabled && !input.readOnly && input.value.trim() !== '' && Number(input.value) === 0) {
    // Clear the DOM value directly rather than relying on input.select(): browsers (Firefox in
    // particular) don't support text selection on type="number" inputs, so select() alone can
    // silently no-op there, leaving the "0" in place for the next keystroke to land next to -
    // "0" + "2" => "20" instead of "2". Clearing the value outright works in every browser and
    // for both controlled and uncontrolled usage.
    input.value = ''
    input.select()
    return true
  }
  return false
}

// Shared by labelled Input fields and compact table/quantity inputs.
// Keep a cleared field empty while editing even if its caller converts '' back to 0.
// Other values, validation attributes, stepper behavior and blur normalization stay with callers.
const NumericInput = forwardRef(function NumericInput(
  { type = 'text', value, onFocus, onClick, onChange, onBlur, ...rest },
  ref,
) {
  const [isEditing, setIsEditing] = useState(false)
  const [isEmptyDraft, setIsEmptyDraft] = useState(false)
  const isControlled = value !== undefined
  const isZeroOrEmpty = value === '' || value === null || Number(value) === 0
  const displayedValue = isControlled && isEditing && isEmptyDraft && isZeroOrEmpty ? '' : value

  const handleFocus = (event) => {
    setIsEditing(true)
    onFocus?.(event)
    setIsEmptyDraft(selectZero(event))
  }
  const handleClick = (event) => {
    onClick?.(event)
    // Mouse/touch clicks can collapse the selection made during focus; select again afterwards.
    if (selectZero(event)) setIsEmptyDraft(true)
  }
  const handleChange = (event) => {
    setIsEmptyDraft(event.currentTarget.value === '')
    onChange?.(event)
  }
  const handleBlur = (event) => {
    onBlur?.(event)
    setIsEditing(false)
    setIsEmptyDraft(false)
  }

  return <input {...rest} ref={ref} type={type} value={displayedValue}
    onFocus={handleFocus} onClick={handleClick} onChange={handleChange} onBlur={handleBlur} />
})

export default NumericInput
