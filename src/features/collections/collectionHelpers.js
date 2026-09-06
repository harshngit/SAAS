// Display helpers for Delivery Collection reconciliation. No API calls - only derives
// display state from a normalized collection (see api/deliveryCollections.js).

export const COLLECTION_STATUS_LABEL = {
  recorded: 'Recorded',
  reconciled: 'Reconciled',
  voided: 'Voided',
}

export const COLLECTION_STATUS_VARIANT = {
  recorded: 'warning',
  reconciled: 'success',
  voided: 'neutral',
}

export const COLLECTION_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'recorded', label: 'Recorded' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'voided', label: 'Voided' },
]

const PAYMENT_MODE_LABEL = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  cod: 'COD / Other',
}

export function formatStatus(collection) {
  return COLLECTION_STATUS_LABEL[collection?.status] || 'Recorded'
}

export function formatPaymentMode(mode) {
  if (!mode) return '—'
  return PAYMENT_MODE_LABEL[mode] || String(mode).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Only a Recorded collection can be reconciled or simply voided. A Reconciled collection
// has already produced a CustomerPayment - reversing that is a backend financial operation,
// not a frontend "void".
export function isReconcilable(collection) {
  return collection?.status === 'recorded'
}

export function isVoidable(collection) {
  return collection?.status === 'recorded'
}

export function isSameDay(value, ref = new Date()) {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate()
}
