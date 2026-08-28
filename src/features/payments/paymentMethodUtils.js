export const paymentMethodOptions = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
]

export function normalizePaymentMethod(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
}

export function getPaymentMethodFlags(paymentMethod) {
  const method = normalizePaymentMethod(paymentMethod)

  return {
    method,
    showUpiFields: method === 'upi',
    showCardFields: method === 'card',
    showCashFields: method === 'cash',
    showCodFields: method === 'cod',
    showReferenceField: method === 'upi' || method === 'card' || method === 'bank_transfer' || method === 'cheque',
    requiresPendingStatus: method === 'cod',
  }
}

export function sanitizePaymentDetails(paymentMethod, details = {}) {
  const flags = getPaymentMethodFlags(paymentMethod)
  const cleaned = {}

  if (flags.showUpiFields && details.upiId) cleaned.upiId = details.upiId
  if (flags.showReferenceField && details.transactionReference) cleaned.transactionReference = details.transactionReference
  if (flags.showCardFields && details.cardType) cleaned.cardType = details.cardType
  if (flags.showCardFields && details.cardLastFour) cleaned.cardLastFour = details.cardLastFour
  if (flags.showCashFields && details.amountReceived !== undefined && details.amountReceived !== '') {
    cleaned.amountReceived = details.amountReceived
  }
  if (flags.showCodFields && details.collectionInstructions) cleaned.collectionInstructions = details.collectionInstructions
  if (flags.requiresPendingStatus) cleaned.paymentStatus = details.paymentStatus || 'pending'

  return cleaned
}
