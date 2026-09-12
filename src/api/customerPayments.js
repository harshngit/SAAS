import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { getCustomer, listCustomers } from './customers'
import {
  COLLECTION_DEMO_ENABLED,
  createDemoGeneralCollection,
  getDemoOutstandingCustomer,
  searchDemoOutstandingCustomers,
} from '../features/collections/deliveryCollectionDemoData'

// =============================================================================
// General customer-outstanding collection (Delivery Partner -> ANY customer).
// -----------------------------------------------------------------------------
// This is the "+ Collect Payment" flow: search a customer, see how much they owe,
// record the amount collected, submit. It is NOT the delivery-anchored COD flow
// (that stays on POST /deliveries/{delivery_id}/collections - api/deliveryCollections.js).
// There is NO invoice-level allocation here - the Accountant allocates at reconciliation.
//
// Canonical endpoint (backend contract):
//   POST /customer-payments/collections
// Reads reuse the existing canonical endpoints:
//   GET /customers?search={q}&has_outstanding=true      (listCustomers)
//   GET /customers/{id}                                  (getCustomer)
//
// Like the money it records, the result is a Collection: the Accountant reconciles
// it and the BACKEND then creates the CustomerPayment and moves balances. The
// frontend never touches balances locally.
//
// Demo mode (VITE_DEMO_DATA=true) routes every call to the local demo layer and
// never sends a demo id to the backend.
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

// Status-aware so the drawer shows the truthful backend reason (spec §27).
function collectionError(error, fallback) {
  const status = error.response?.status
  const detail = error.response?.data?.detail || error.response?.data?.message || error.response?.data?.error || error.response?.data
  if (status === 403) return 'You do not have permission to record collections.'
  if (status === 404 || status === 405) {
    return 'Collecting an outstanding payment isn’t available on the server yet. Nothing was recorded — the amount stays due for the accounts team to collect.'
  }
  if (status === 409) return formatApiError(detail, 'This collection could not be recorded — it may already exist.')
  return formatApiError(detail, fallback)
}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

// Only customers who currently owe money.
export async function searchOutstandingCustomers(query) {
  if (COLLECTION_DEMO_ENABLED) return searchDemoOutstandingCustomers(query)

  const result = await listCustomers({ search: query || undefined, has_outstanding: true })
  if (!result.success) return result

  const customers = (result.customers || [])
    .map((raw) => ({
      id: raw.id,
      name: raw.name || raw.business_name || raw.customer_name || 'Customer',
      phone: raw.phone || raw.mobile_number || '',
      outstandingBalance: Number(raw.outstanding_balance ?? raw.outstandingBalance ?? 0) || 0,
    }))
    .filter((customer) => customer.id)
  return { success: true, customers }
}

// The canonical customer response - outstanding balance is backend-owned truth.
export async function getCustomerOutstanding(customerId) {
  if (COLLECTION_DEMO_ENABLED) return getDemoOutstandingCustomer(customerId)

  const result = await getCustomer(customerId)
  if (!result.success) return result

  const customer = result.customer
  return {
    success: true,
    customer: {
      id: customer.id,
      name: customer.name || customer.businessName || 'Customer',
      phone: customer.phone || customer.mobileNumber || '',
      outstandingBalance: Number(customer.outstandingBalance ?? 0) || 0,
    },
  }
}

// -----------------------------------------------------------------------------
// Submit
// -----------------------------------------------------------------------------

function buildCollectionBody(payload) {
  // Customer-based only. NO invoice_id / order_id / allocations / delivery_id / collector_id -
  // the backend allocates against the customer's invoices at reconciliation and identifies the
  // collector from the auth token.
  return {
    customer_id: payload.customerId,
    amount: Number(payload.amount) || 0,
    payment_method: payload.paymentMethod || 'cash',
    payment_date: payload.paymentDate || new Date().toISOString().slice(0, 10),
    source: 'delivery_partner',
    reference: (payload.reference || '').trim(),
    notes: (payload.notes || '').trim(),
  }
}

// Canonical path per the backend contract. If a deployment exposes it elsewhere, change
// this ONE constant - do not add guessed fallbacks (they just produce 404/405 noise).
// Never a fake success, never a demo fallback in real mode.
const COLLECTION_ENDPOINT = '/customer-payments/collections'

export async function recordCustomerCollection(payload) {
  if (COLLECTION_DEMO_ENABLED) return createDemoGeneralCollection(payload)

  try {
    const { data } = await apiClient.post(COLLECTION_ENDPOINT, buildCollectionBody(payload), {
      headers: authHeader(),
    })
    return { success: true, collection: data }
  } catch (error) {
    return { success: false, error: collectionError(error, 'Unable to record this collection. Please try again.') }
  }
}
