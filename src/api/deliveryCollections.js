import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import {
  COLLECTION_DEMO_ENABLED,
  createDemoCollection,
  getDemoCollection,
  listDemoCollections,
  listDemoCollectionsForDelivery,
  reconcileDemoCollection,
  voidDemoCollection,
} from '../features/collections/deliveryCollectionDemoData'

// =============================================================================
// Delivery Collection + reconciliation API.
// -----------------------------------------------------------------------------
// A Collection is the money a Delivery Partner physically takes at the doorstep.
// It is NOT a payment yet: the Accountant/Admin later "reconciles" it, and the
// BACKEND (not this file) then creates exactly one CustomerPayment and moves the
// customer / invoice balance. Frontend only records, lists, reconciles, voids.
//
// Endpoints (per the delivery-collections contract):
//   POST /deliveries/{delivery_id}/collections
//   GET  /deliveries/{delivery_id}/collections
//   GET  /deliveries/collections
//   GET  /deliveries/collections/{id}
//   POST /deliveries/collections/{id}/reconcile
//   POST /deliveries/collections/{id}/void
//
// Demo mode (VITE_DEMO_DATA=true) simulates the whole lifecycle locally and
// never calls any of these; demo ids are never sent to the backend.
// =============================================================================

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData
  if (Array.isArray(errorData)) return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.message || errorData.error) return formatApiError(errorData.message || errorData.error)
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }
  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

// Status-aware message so the queue can show the truthful reason (§27).
function collectionError(error, fallback) {
  const status = error.response?.status
  const data = error.response?.data
  const detail = data?.detail || data?.message || data?.error || data
  if (status === 404) {
    return 'The delivery collections service did not respond (404). Nothing was changed — please retry.'
  }
  if (status === 403) return 'You do not have permission to perform this action.'
  if (status === 409) return formatApiError(detail, 'This collection has already been reconciled or voided.')
  return formatApiError(detail, fallback)
}

function normalizeCollection(raw) {
  if (!raw) return raw
  const status = String(raw.status || raw.state || 'recorded').toLowerCase()
  return {
    id: raw.id,
    collectionNumber: raw.collection_number || raw.number || raw.id,
    deliveryId: raw.delivery_id || raw.delivery?.id || null,
    deliveryNumber: raw.delivery_number || raw.delivery?.delivery_number || '',
    orderId: raw.order_id || raw.order?.id || null,
    orderNumber: raw.order_number || raw.order?.order_number || '',
    customerId: raw.customer_id || raw.customer?.id || '',
    customerName: raw.customer_name || raw.customer?.name || raw.customer?.business_name || '',
    deliveryPartnerId: raw.delivery_partner_id || raw.delivery_partner?.id || '',
    deliveryPartnerName: raw.delivery_partner_name || raw.delivery_partner?.name || '',
    amount: Number(raw.amount ?? raw.amount_collected) || 0,
    paymentMode: raw.payment_mode || raw.payment_method || raw.mode || '',
    reference: raw.reference || raw.transaction_reference || '',
    note: raw.note || raw.notes || '',
    status: status === 'reconciled' || status === 'voided' ? status : 'recorded',
    recordedById: raw.recorded_by_id || raw.created_by_id || raw.recorded_by?.id || '',
    recordedByName: raw.recorded_by_name || raw.recorded_by?.name || raw.created_by?.name || '',
    recordedAt: raw.recorded_at || raw.created_at || null,
    reconciledAt: raw.reconciled_at || null,
    reconciledById: raw.reconciled_by_id || raw.reconciled_by?.id || '',
    reconciledByName: raw.reconciled_by_name || raw.reconciled_by?.name || '',
    customerPaymentId: raw.customer_payment_id || raw.payment_id || raw.customer_payment?.id || null,
    customerPaymentNumber: raw.customer_payment_number || raw.customer_payment?.receipt_number || raw.payment_reference || '',
    invoiceId: raw.invoice_id || raw.invoice?.id || null,
    invoiceNumber: raw.invoice_number || raw.invoice?.invoice_number || '',
    invoiceTotal: raw.invoice_total ?? raw.invoice?.total ?? null,
    orderTotal: raw.order_total ?? raw.order?.total ?? null,
    alreadyPaid: raw.already_paid ?? raw.amount_paid ?? null,
    // The outstanding balance snapshot taken when the driver recorded the collection - shown
    // truthfully as "Outstanding at Recording". `outstandingAmount` (below) is the current
    // balance and is only labelled "Current Outstanding".
    outstandingAtRecording: raw.outstanding_at_recording ?? raw.outstanding_snapshot ?? raw.outstanding_at_collection ?? null,
    outstandingAmount: raw.outstanding_amount ?? raw.outstanding ?? null,
    voidReason: raw.void_reason || raw.voided_reason || '',
    voidedAt: raw.voided_at || null,
    voidedByName: raw.voided_by_name || raw.voided_by?.name || '',
  }
}

function buildCollectionBody(payload) {
  const body = { amount: Number(payload.amount) || 0 }
  const mode = payload.paymentMode || payload.payment_mode
  if (mode) body.payment_mode = mode
  const reference = (payload.reference || '').trim?.() ?? payload.reference
  if (reference) body.reference = reference
  const note = (payload.note || '').trim?.() ?? payload.note
  if (note) body.note = note
  return body
}

export async function createDeliveryCollection(deliveryId, payload) {
  if (COLLECTION_DEMO_ENABLED) return createDemoCollection(deliveryId, payload)

  try {
    const { data } = await apiClient.post(`/deliveries/${deliveryId}/collections`, buildCollectionBody(payload), {
      headers: authHeader(),
    })
    return { success: true, collection: normalizeCollection(data) }
  } catch (error) {
    return { success: false, error: collectionError(error, 'Unable to record this collection. Please try again.') }
  }
}

export async function listDeliveryCollections(deliveryId) {
  if (COLLECTION_DEMO_ENABLED) return listDemoCollectionsForDelivery(deliveryId)

  try {
    const { data } = await apiClient.get(`/deliveries/${deliveryId}/collections`, { headers: authHeader() })
    const rows = Array.isArray(data) ? data : data?.collections || []
    return { success: true, collections: rows.map(normalizeCollection) }
  } catch (error) {
    // A missing endpoint here should not break the Delivery Detail page - report it,
    // let the caller render the "not available" note.
    return { success: false, error: collectionError(error, 'Unable to load collections for this delivery.') }
  }
}

export async function listCollections(params = {}) {
  if (COLLECTION_DEMO_ENABLED) return listDemoCollections(params)

  try {
    const queryParams = {}
    if (params.status && params.status !== 'all') queryParams.status = params.status
    if (params.search) queryParams.search = params.search
    const { data } = await apiClient.get('/deliveries/collections', { headers: authHeader(), params: queryParams })
    const rows = Array.isArray(data) ? data : data?.collections || []
    return { success: true, collections: rows.map(normalizeCollection) }
  } catch (error) {
    return { success: false, error: collectionError(error, 'Unable to load collections. Please try again.') }
  }
}

export async function getCollection(collectionId) {
  if (COLLECTION_DEMO_ENABLED) {
    const collection = getDemoCollection(collectionId)
    return collection ? { success: true, collection } : { success: false, error: 'Collection not found.' }
  }

  try {
    const { data } = await apiClient.get(`/deliveries/collections/${collectionId}`, { headers: authHeader() })
    return { success: true, collection: normalizeCollection(data) }
  } catch (error) {
    return { success: false, error: collectionError(error, 'Unable to load this collection.') }
  }
}

// The backend creates exactly one CustomerPayment and moves the balance - the
// frontend only triggers this and refetches server truth.
export async function reconcileCollection(collectionId) {
  if (COLLECTION_DEMO_ENABLED) return reconcileDemoCollection(collectionId)

  try {
    const { data } = await apiClient.post(`/deliveries/collections/${collectionId}/reconcile`, {}, {
      headers: authHeader(),
    })
    return { success: true, collection: normalizeCollection(data) }
  } catch (error) {
    return { success: false, error: collectionError(error, 'Unable to reconcile this collection. Please try again.') }
  }
}

export async function voidCollection(collectionId, reason) {
  if (COLLECTION_DEMO_ENABLED) return voidDemoCollection(collectionId, reason)

  try {
    const body = reason ? { reason } : {}
    const { data } = await apiClient.post(`/deliveries/collections/${collectionId}/void`, body, { headers: authHeader() })
    return { success: true, collection: normalizeCollection(data) }
  } catch (error) {
    return { success: false, error: collectionError(error, 'Unable to void this collection. Please try again.') }
  }
}
