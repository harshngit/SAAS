export function resolveCustomerGst(value) {
  const gstNumber = String(value || '').trim()
  return gstNumber || 'NA'
}
