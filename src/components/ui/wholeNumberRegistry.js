// Which whole-number (quantity) boxes currently hold text that is not a whole number.
// WholeNumberInput registers / clears itself here; every form that has quantity boxes asks before it saves:
//   const quantityError = invalidWholeNumberMessage(); if (quantityError) { setSubmitError(quantityError); return }
const invalid = new Map()

export function setWholeNumberInvalid(id, message) {
  if (message) invalid.set(id, message)
  else invalid.delete(id)
}

// First message, or '' when every quantity box is a valid whole number.
export function invalidWholeNumberMessage() {
  return invalid.size ? [...invalid.values()][0] : ''
}
