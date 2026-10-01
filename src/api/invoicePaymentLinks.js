// Razorpay Part B - invoice payment links. Amounts here are in RUPEES (e.g. 1000.00), unlike
// Part A's order "amount" which is in paise - see api/billing.js.
import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData

  if (Array.isArray(errorData)) {
    return errorData.map((item) => formatApiError(item)).filter(Boolean).join(', ')
  }

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

function normalizePaymentLink(link) {
  if (!link) return link
  return {
    id: link.id,
    invoiceId: link.invoice_id,
    razorpayLinkId: link.razorpay_link_id || '',
    shortUrl: link.short_url || '',
    amount: link.amount ?? 0,
    amountPaid: link.amount_paid ?? 0,
    currency: link.currency || 'INR',
    status: link.status,
    expireBy: link.expire_by || null,
    notifySms: Boolean(link.notify_sms),
    notifyEmail: Boolean(link.notify_email),
    createdAt: link.created_at,
    paidAt: link.paid_at || null,
  }
}

// payload: { amount?, expireInDays?, notifySms?, notifyEmail? } - all optional, backend applies
// its own defaults (outstanding amount, 7 days) and validates the amount server-side.
export async function createInvoicePaymentLink(invoiceId, payload = {}) {
  try {
    const body = {}
    if (payload.amount !== undefined) body.amount = payload.amount
    if (payload.expireInDays !== undefined) body.expire_in_days = payload.expireInDays
    if (payload.notifySms !== undefined) body.notify_sms = payload.notifySms
    if (payload.notifyEmail !== undefined) body.notify_email = payload.notifyEmail

    const { data } = await apiClient.post(`/invoices/${invoiceId}/payment-link`, body, { headers: authHeader() })
    return { success: true, link: normalizePaymentLink(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to create payment link. Please try again.',
    )
    return { success: false, error: message }
  }
}

export async function listInvoicePaymentLinks(invoiceId) {
  try {
    const { data } = await apiClient.get(`/invoices/${invoiceId}/payment-links`, { headers: authHeader() })
    const links = Array.isArray(data) ? data : data?.links || []
    return { success: true, links: links.map(normalizePaymentLink) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment link history. Please try again.',
    )
    return { success: false, error: message }
  }
}

export async function cancelInvoicePaymentLink(invoiceId, linkId) {
  try {
    const { data } = await apiClient.post(`/invoices/${invoiceId}/payment-links/${linkId}/cancel`, {}, { headers: authHeader() })
    return { success: true, link: data ? normalizePaymentLink(data) : null }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to cancel the payment link. Please try again.',
    )
    return { success: false, error: message }
  }
}

export async function refreshInvoicePaymentLink(invoiceId, linkId) {
  try {
    const { data } = await apiClient.get(`/invoices/${invoiceId}/payment-links/${linkId}/refresh`, { headers: authHeader() })
    return { success: true, link: normalizePaymentLink(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to refresh the payment link status. Please try again.',
    )
    return { success: false, error: message }
  }
}
