export function phoneConflictFields(status, message) {
  return status === 409 && /phone|mobile/i.test(message || '') ? { phone: 'This mobile number is already assigned to another staff account' } : {}
}
