// Display helpers for Delivery Collection reconciliation. No API calls - only derives
// display state from a normalized collection (see api/deliveryCollections.js).
import { roleLabels } from '../../auth/roles'

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

const COLLECTION_SOURCE_LABEL = {
  delivery: 'Delivery (COD)',
  delivery_partner: 'Delivery partner collection',
  office: 'Office',
}

export function formatCollectionSource(source) {
  if (!source) return ''
  return COLLECTION_SOURCE_LABEL[source] || String(source).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// The collector's role - ALWAYS read from the backend (`collection.recordedByRole`), never
// hardcoded. A collection can be recorded by any role the backend allows (Delivery Partner
// today, potentially Sales Officer / Admin later) - this only formats whatever role comes back.
export function formatCollectorRole(role) {
  if (!role) return ''
  return roleLabels[role] || String(role).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
