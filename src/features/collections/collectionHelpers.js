// Display helpers for Delivery Collection reconciliation. No API calls - only derives
// display state from a normalized collection (see api/deliveryCollections.js).
import { roleLabels } from '../../auth/roles'

export const COLLECTION_STATUS_LABEL = {
  // User-facing lifecycle everywhere: Collected -> Confirm Payment -> Completed (or Voided).
  // Stored / backend values stay recorded / reconciled / voided. `recorded` = money received, not confirmed yet.
  recorded: 'Collected',
  reconciled: 'Completed',
  voided: 'Voided',
}

export const COLLECTION_STATUS_VARIANT = {
  recorded: 'warning',
  reconciled: 'success',
  voided: 'neutral',
}

// The lifecycle tabs. `status` is the backend filter value. `named` tabs read view=collected, whose rows carry the
// customer / order / delivery / collector names (that view never contains voided records).
export const COLLECTION_TABS = [
  { value: 'all', label: 'All', status: undefined, named: false, empty: 'No collections recorded yet.' },
  { value: 'collected', label: 'Collected', status: 'recorded', named: true, empty: 'No collections waiting for confirmation.' },
  { value: 'completed', label: 'Completed', status: 'reconciled', named: true, empty: 'No completed collections yet.' },
  { value: 'voided', label: 'Voided', status: 'voided', named: false, empty: 'No voided collections.' },
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
  return COLLECTION_STATUS_LABEL[collection?.status] || 'Collected'
}

export const PAYMENT_MODE_FILTER_KEYS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque']

// The backend totals bank / NEFT / RTGS / IMPS together as bank transfer - the payment-mode filter groups them the same way.
export function paymentModeKey(mode) {
  const key = String(mode || '').toLowerCase()
  return ['bank', 'neft', 'rtgs', 'imps'].includes(key) ? 'bank_transfer' : key
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

// What a cell shows when the API sent no name/number for it. A record that really has no delivery/order/partner
// shows a dash (nothing to show); a record that HAS the id but arrived without its name shows "Not available" -
// never the raw id, "undefined" or an empty cell.
export const NOT_AVAILABLE = 'Not available'
export const nameOrNotAvailable = (value) => value || NOT_AVAILABLE
export const linkedValue = (value, id) => value || (id ? NOT_AVAILABLE : '—')

// "20 Nov 2026" from a date-only value (YYYY-MM-DD). Built from the parts, so no timezone can move it to another day.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatBusinessDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!match) return '\u2014'
  return `${match[3]} ${MONTHS[Number(match[2]) - 1] || ''} ${match[1]}`
}
