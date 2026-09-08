import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) {
    return fallbackMessage
  }

  if (typeof errorData === 'string') {
    return errorData
  }

  if (Array.isArray(errorData)) {
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }

    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error)
    }

    return Object.entries(errorData)
      .map(([field, value]) => `${field}: ${formatApiError(value)}`)
      .join(', ')
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

const trimOrNull = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue
    const value = String(candidate).trim()
    return value || null
  }
  return null
}
const numOrNull = (value) =>
  value !== undefined && value !== null && String(value).trim() !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : null

// Canonical supplier master fields. Server-managed values (id, organization_id, total_*,
// outstanding_payable, created_at, updated_at) are never sent. `supplier_categories` is the
// canonical multi-select array - the legacy DB field `categories` / `category` is never sent.
function buildSupplierBody(payload) {
  const body = {
    name: (payload.name ?? '').trim(),
    code: trimOrNull(payload.code),
    company_name: trimOrNull(payload.companyName, payload.company_name),
    contact_person: trimOrNull(payload.contactPerson, payload.contact_person),
    phone: trimOrNull(payload.phone),
    email: trimOrNull(payload.email),
    address: trimOrNull(payload.address),
    city: trimOrNull(payload.city),
    state: trimOrNull(payload.state),
    pincode: trimOrNull(payload.pinCode, payload.pincode),
    country: trimOrNull(payload.country),
    gst_number: trimOrNull(payload.gstNumber, payload.gst_number),
    pan_number: trimOrNull(payload.panNumber, payload.pan_number, payload.pan),
    supplier_type: trimOrNull(payload.supplierType, payload.supplier_type, payload.category),
    payment_terms: trimOrNull(payload.paymentTerms, payload.payment_terms),
    credit_limit: numOrNull(payload.creditLimit ?? payload.credit_limit),
    opening_balance: Number(payload.openingBalance ?? payload.opening_balance) || 0,
    notes: trimOrNull(payload.notes),
    // Canonical multi-select. Never send the legacy DB field `categories` / `category`.
    supplier_categories: Array.isArray(payload.supplierCategories ?? payload.supplier_categories)
      ? (payload.supplierCategories ?? payload.supplier_categories).map((entry) => String(entry).trim()).filter(Boolean)
      : [],
  }
  return body
}

export async function createSupplier(payload) {
  try {
    const { data } = await apiClient.post('/suppliers', buildSupplierBody(payload), {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listSuppliers(params = {}) {
  try {
    const queryParams = {}

    if (params.search) queryParams.search = params.search
    if (params.category) queryParams.category = params.category
    if (params.is_active !== undefined && params.is_active !== null) queryParams.is_active = params.is_active
    if (params.skip !== undefined) queryParams.skip = params.skip
    if (params.limit !== undefined) queryParams.limit = params.limit

    const { data } = await apiClient.get('/suppliers', {
      headers: authHeader(),
      params: queryParams,
    })

    return { success: true, suppliers: Array.isArray(data) ? data : data?.suppliers || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load suppliers. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getSupplier(supplierId) {
  try {
    const { data } = await apiClient.get(`/suppliers/${supplierId}`, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load supplier details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSupplier(supplierId, payload) {
  try {
    const { data } = await apiClient.put(`/suppliers/${supplierId}`, buildSupplierBody(payload), {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSupplierStatus(supplierId, isActive) {
  try {
    const { data } = await apiClient.patch(`/suppliers/${supplierId}/status`, { is_active: isActive }, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update supplier status. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteSupplier(supplierId) {
  try {
    await apiClient.delete(`/suppliers/${supplierId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete supplier. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function recordSupplierPayment(supplierId, payload) {
  try {
    // Verified basic-phase PaymentCreate contract only: amount, payment_mode, reference?,
    // note?, paid_on?. The rich UPI / card / COD / payment_status sub-fields are NOT part of
    // the backend schema - they belong to the (future) full Supplier Payments module and are
    // never sent from here.
    const requestBody = {
      amount: Number(payload.amount) || 0,
      payment_mode: payload.paymentMode || payload.payment_mode || 'cash',
    }

    if (payload.reference) requestBody.reference = payload.reference
    if (payload.note) requestBody.note = payload.note

    const paidOn = payload.paidOn || payload.paid_on
    if (paidOn) requestBody.paid_on = paidOn

    const { data } = await apiClient.post(`/suppliers/${supplierId}/payments`, requestBody, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record payment. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getSupplierPayments(supplierId) {
  try {
    const { data } = await apiClient.get(`/suppliers/${supplierId}/payments`, {
      headers: authHeader(),
    })

    return { success: true, payments: Array.isArray(data) ? data : data?.payments || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment history. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Basic-phase: this physically deletes the payment row and reverses the supplier's aggregate
// balance server-side. It is NOT an audited accounting void (that is a downstream module).
export async function deleteSupplierPayment(supplierId, paymentId) {
  try {
    const { data } = await apiClient.delete(`/suppliers/${supplierId}/payments/${paymentId}`, {
      headers: authHeader(),
    })

    return { success: true, supplier: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete this payment. Please try again.',
    )

    return { success: false, error: message }
  }
}
// Back-compat alias for existing callers.
export const voidSupplierPayment = deleteSupplierPayment

// -----------------------------------------------------------------------------
// Supplier <-> Product many-to-many links.
//   GET    /suppliers/{supplier_id}/products
//   POST   /suppliers/{supplier_id}/products   { product_id }
//   DELETE /suppliers/{supplier_id}/products/{product_id}
// This manages ONLY the link. It never touches Product master or preferred_supplier_id.
// -----------------------------------------------------------------------------
function normalizeSupplierProductLink(row) {
  if (!row) return row
  return {
    id: row.id,
    supplierId: row.supplier_id || null,
    productId: row.product_id || row.product?.id || null,
    productName: row.product_name || row.product?.name || '',
    productSku: row.product_sku || row.product?.sku || '',
    productCategoryId: row.product_category_id || row.product?.category_id || null,
    productCategory: row.product_category || row.product?.category?.name || row.category || '',
    productStatus: row.product_status || row.product?.status || '',
    createdAt: row.created_at || null,
  }
}

export async function getSupplierProductLinks(supplierId) {
  try {
    const { data } = await apiClient.get(`/suppliers/${supplierId}/products`, { headers: authHeader() })
    const rows = Array.isArray(data) ? data : data?.products || data?.items || []
    return { success: true, links: rows.map(normalizeSupplierProductLink) }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to load linked products. Please try again.',
      ),
    }
  }
}

export async function linkSupplierProduct(supplierId, productId) {
  try {
    const { data } = await apiClient.post(
      `/suppliers/${supplierId}/products`,
      { product_id: productId },
      { headers: authHeader() },
    )
    return { success: true, link: normalizeSupplierProductLink(data) }
  } catch (error) {
    const status = error.response?.status
    const errorData = error.response?.data
    const detail = errorData?.detail || errorData?.message || errorData?.error || errorData
    if (status === 400 || status === 409) {
      return { success: false, alreadyLinked: true, error: formatApiError(detail, 'This product is already linked.') }
    }
    return { success: false, error: formatApiError(detail, 'Unable to link this product. Please try again.') }
  }
}

export async function unlinkSupplierProduct(supplierId, productId) {
  try {
    await apiClient.delete(`/suppliers/${supplierId}/products/${productId}`, { headers: authHeader() })
    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    return {
      success: false,
      error: formatApiError(
        errorData?.detail || errorData?.message || errorData?.error || errorData,
        'Unable to unlink this product. Please try again.',
      ),
    }
  }
}
