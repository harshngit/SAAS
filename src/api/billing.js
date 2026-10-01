// Razorpay Phase 1 - SaaS plan payment (online, on top of the existing manual upgrade-request
// flow, which stays unchanged - see api/organizations.js's requestPlanUpgrade). Order "amount" is
// in integer PAISE (e.g. 99900 = Rs 999) - divide by 100 before passing to formatCurrency.
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

function normalizePayment(payment) {
  if (!payment) return payment
  return {
    id: payment.id,
    organizationId: payment.organization_id,
    planId: payment.plan_id,
    planName: payment.plan_name,
    billingCycle: payment.billing_cycle,
    amountPaise: payment.amount_paise ?? 0,
    currency: payment.currency || 'INR',
    razorpayOrderId: payment.razorpay_order_id || '',
    razorpayPaymentId: payment.razorpay_payment_id || '',
    status: payment.status,
    failureReason: payment.failure_reason || '',
    createdAt: payment.created_at,
    paidAt: payment.paid_at || null,
  }
}

// 503 ("Online payment not configured") is a distinct, expected case - the backend Razorpay env
// vars just aren't set up yet - callers should hide the Pay button and fall back to the manual
// request flow, not show a generic error. `notConfigured: true` flags that case specifically.
export async function createRazorpayOrder({ planId, billingCycle }) {
  try {
    const { data } = await apiClient.post(
      '/billing/razorpay/order',
      { plan_id: planId, billing_cycle: billingCycle },
      { headers: authHeader() },
    )

    return {
      success: true,
      orderId: data.order_id,
      amount: data.amount,
      currency: data.currency || 'INR',
      keyId: data.key_id,
      planName: data.plan_name,
      billingCycle: data.billing_cycle,
      prefill: {
        name: data.prefill?.name || '',
        email: data.prefill?.email || '',
        contact: data.prefill?.contact || '',
      },
    }
  } catch (error) {
    if (error.response?.status === 503) {
      return { success: false, notConfigured: true, error: 'Online payment is not set up yet.' }
    }
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to start payment. Please try again.',
    )
    return { success: false, error: message }
  }
}

// Returns the full OrganizationOut response on success (plan, billing_cycle, plan_expires_at,
// days_left, status) - the caller applies it directly, same shape getCurrentOrganizationState()
// returns.
export async function verifyRazorpayPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  try {
    const { data } = await apiClient.post(
      '/billing/razorpay/verify',
      {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      },
      { headers: authHeader() },
    )

    return { success: true, organization: data }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Payment verification failed. If an amount was deducted, it will be refunded automatically.',
    )
    return { success: false, error: message }
  }
}

export async function getPaymentHistory() {
  try {
    const { data } = await apiClient.get('/billing/payments', { headers: authHeader() })
    const payments = Array.isArray(data) ? data : data?.payments || []
    return { success: true, payments: payments.map(normalizePayment) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load payment history. Please try again.',
    )
    return { success: false, error: message }
  }
}

// Super Admin only - every organization's subscription payments, optionally filtered.
export async function getSuperAdminSubscriptionPayments(organizationId) {
  try {
    const { data } = await apiClient.get('/superadmin/subscription-payments', {
      headers: authHeader(),
      params: organizationId ? { organization_id: organizationId } : undefined,
    })
    const payments = Array.isArray(data) ? data : data?.payments || []
    return { success: true, payments: payments.map(normalizePayment) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load subscription payments. Please try again.',
    )
    return { success: false, error: message }
  }
}
