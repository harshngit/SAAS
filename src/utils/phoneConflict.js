export function phoneConflictFields(status, message) {
  if (status !== 409) return {}
  const fields = {}
  if (/phone|mobile/i.test(message || '')) fields.phone = 'This mobile number is already assigned to another staff account'
  // Backend now enforces one login email across every firm and platform account, any casing -
  // see crm_changes15.md "Email uniqueness made reliable" - so this 409 can happen on any
  // updateUser() call site that edits an email, not just registration.
  if (/email/i.test(message || '')) fields.email = message || 'This email is already registered.'
  return fields
}
