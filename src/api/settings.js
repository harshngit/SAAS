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

function normalizeWorkflowSettings(settings) {
  if (!settings) return settings

  return {
    orderRequiresApproval: Boolean(settings.order_requires_approval),
    reserveStockOnOrder: settings.reserve_stock_on_order !== false,
    allowPartialDelivery: settings.allow_partial_delivery !== false,
    allowBackorder: Boolean(settings.allow_backorder),
    invoiceTiming: settings.invoice_timing || 'after_delivery',
    allowDirectInvoice: settings.allow_direct_invoice !== false,
    creditLimitAction: settings.credit_limit_action || 'warn',
    deliveryCollectionAllowed: settings.delivery_collection_allowed !== false,
    partialDeliveryInvoiceMode: settings.partial_delivery_invoice_mode || 'per_delivery',
  }
}

export async function getSalesWorkflowSettings() {
  try {
    const { data } = await apiClient.get('/sales-workflow-settings', {
      headers: authHeader(),
    })

    return { success: true, settings: normalizeWorkflowSettings(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load sales workflow settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateSalesWorkflowSettings(payload) {
  try {
    const requestBody = {
      order_requires_approval: payload.orderRequiresApproval,
      reserve_stock_on_order: payload.reserveStockOnOrder,
      allow_partial_delivery: payload.allowPartialDelivery,
      allow_backorder: payload.allowBackorder,
      invoice_timing: payload.invoiceTiming,
      allow_direct_invoice: payload.allowDirectInvoice,
      credit_limit_action: payload.creditLimitAction,
      delivery_collection_allowed: payload.deliveryCollectionAllowed,
      partial_delivery_invoice_mode: payload.partialDeliveryInvoiceMode,
    }

    const { data } = await apiClient.patch('/sales-workflow-settings', requestBody, {
      headers: authHeader(),
    })

    return { success: true, settings: normalizeWorkflowSettings(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save sales workflow settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getFieldSettings() {
  try {
    const { data } = await apiClient.get('/organizations/settings/fields', {
      headers: authHeader(),
    })

    return {
      success: true,
      fieldSettings: data?.field_settings || {},
      availableFields: data?.available_fields || {},
    }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load field settings. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateFieldSettings(fieldSettings) {
  try {
    const { data } = await apiClient.put('/organizations/settings/fields', { field_settings: fieldSettings }, {
      headers: authHeader(),
    })

    return { success: true, fieldSettings: data?.field_settings || fieldSettings }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to save field settings. Please try again.',
    )

    return { success: false, error: message }
  }
}
