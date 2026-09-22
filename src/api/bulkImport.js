import { apiClient } from './client'
import { useAuthStore } from '../store/authStore'
import { DEMO_MODE, DEMO_EMPTY } from '../config/demoMode'

// Bulk Excel Import — isolated adapter layer.
//
// Backend contract (confirmed): GET /{base}/import/template streams the module's .xlsx
// template; POST /{base}/import (multipart field "file") validates AND commits in one atomic
// call - valid rows are created, invalid rows are reported, nothing is a separate "confirm" step.
//
// Demo mode (DEMO_MODE && !DEMO_EMPTY) never calls the real backend - it runs a local canned
// simulation for import, and honestly reports the template as unavailable in demo mode (there is
// nothing real to download without a network call).
export const BULK_IMPORT_DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

export const BULK_IMPORT_MODULES = {
  customers: { label: 'Customers', basePath: '/customers', templateFileName: 'customers_import_template.xlsx' },
  suppliers: { label: 'Suppliers', basePath: '/suppliers', templateFileName: 'suppliers_import_template.xlsx' },
  salesOrders: { label: 'Sales Orders', basePath: '/orders', templateFileName: 'sales_orders_import_template.xlsx' },
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

function formatApiError(errorData, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData
  if (Array.isArray(errorData)) return errorData.map((item) => formatApiError(item)).filter(Boolean).join(', ')
  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }
    if (errorData.detail || errorData.message || errorData.error) {
      return formatApiError(errorData.detail || errorData.message || errorData.error)
    }
    return Object.entries(errorData).map(([field, value]) => `${field}: ${formatApiError(value)}`).join(', ')
  }
  return String(errorData)
}

// `responseType: 'blob'` means axios parses even an error body as a Blob, not JSON - read it
// back out as text and re-parse so a real 403/422 shows its actual message instead of a raw blob.
async function formatBlobError(error, fallbackMessage) {
  const blob = error.response?.data
  if (blob instanceof Blob) {
    try {
      const text = await blob.text()
      const parsed = JSON.parse(text)
      return formatApiError(parsed?.detail || parsed?.message || parsed?.error || parsed, fallbackMessage)
    } catch {
      return fallbackMessage
    }
  }
  return formatApiError(error.response?.data, fallbackMessage)
}

function normalizeImportResult(data) {
  const errors = Array.isArray(data?.errors)
    ? data.errors.map((err) => ({
        row: err.row,
        field: err.field || err.column || '',
        error: err.message || err.error || '',
      }))
    : []

  return {
    totalRows: data?.total_rows ?? data?.total_records ?? 0,
    validRows: data?.valid_rows ?? data?.success_count ?? 0,
    invalidRows: data?.failed_rows ?? data?.error_count ?? errors.length,
    createdIds: Array.isArray(data?.created_ids) ? data.created_ids : [],
    errors,
  }
}

const demoRowErrors = {
  customers: [
    { row: 4, field: 'mobile_number', error: 'Phone number is required' },
    { row: 7, field: 'email_address', error: 'Invalid email format' },
  ],
  suppliers: [
    { row: 3, field: 'gst_number', error: 'GST number is invalid' },
  ],
  salesOrders: [
    { row: 2, field: 'customer_id', error: 'Customer not found' },
    { row: 5, field: 'product_id', error: 'Product not found' },
    { row: 9, field: 'quantity', error: 'Quantity must be greater than 0' },
  ],
}

// GET /{base}/import/template — streams the module's real .xlsx template.
export async function downloadBulkImportTemplate(moduleKey) {
  if (BULK_IMPORT_DEMO_ENABLED) {
    return { success: false, error: 'Template download is not available in demo mode.' }
  }

  const config = BULK_IMPORT_MODULES[moduleKey]
  if (!config) return { success: false, error: 'Unknown import module.' }

  try {
    const response = await apiClient.get(`${config.basePath}/import/template`, {
      headers: authHeader(),
      responseType: 'blob',
    })

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = config.templateFileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    const message = await formatBlobError(error, 'Unable to download the import template. Please try again.')
    return { success: false, error: message }
  }
}

// POST /{base}/import (multipart "file") — validates and commits in one call. Valid rows are
// created immediately; invalid rows are reported row-by-row. Never called twice for one file.
export async function importBulkFile(moduleKey, file) {
  if (BULK_IMPORT_DEMO_ENABLED) {
    await new Promise((resolve) => setTimeout(resolve, 700))
    const errors = demoRowErrors[moduleKey] || []
    const totalRows = 10
    const invalidRows = errors.length
    return {
      success: true,
      data: { totalRows, validRows: totalRows - invalidRows, invalidRows, createdIds: [], errors },
    }
  }

  const config = BULK_IMPORT_MODULES[moduleKey]
  if (!config) return { success: false, error: 'Unknown import module.' }

  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post(`${config.basePath}/import`, formData, {
      headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
    })

    return { success: true, data: normalizeImportResult(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(errorData, 'Unable to import file. Please try again.')
    return { success: false, error: message }
  }
}
