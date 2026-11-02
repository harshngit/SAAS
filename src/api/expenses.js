import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'
import { handleStorageLimitError } from '../components/ui/storageLimitContext'

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

// ---- Status normalization (ONE boundary) --------------------------------------------------
// Backend Expense.status is lowercase: pending | approved | rejected | clarification_requested.
// The UI shows human labels; these two helpers are the only place raw <-> label is mapped.
const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  clarification_requested: 'Clarification Required',
}

export function expenseStatusLabel(rawStatus) {
  const key = String(rawStatus || 'pending').toLowerCase()
  return STATUS_LABEL[key] || key.replace(/_/g, ' ')
}

// UI label OR key -> the raw value GET /expenses?status= expects.
export function toExpenseStatusParam(value) {
  const v = String(value || '').toLowerCase().replace(/\s+/g, '_')
  if (v === 'clarification' || v === 'clarification_required') return 'clarification_requested'
  return v // 'pending' | 'approved' | 'rejected' | 'clarification_requested'
}

// ---- Lifecycle status (NEW source of truth for reimbursement-aware UI) --------------------
// Backend now also returns `lifecycle_status`: pending_approval | approved | rejected |
// reimbursed. This is distinct from the legacy `status` vocabulary above (which still drives
// the separate clarification-request flow, untouched by this). Action-visibility decisions
// (which buttons render) use lifecycleStatus; clarification handling stays on statusKey.
const LIFECYCLE_STATUS_LABEL = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed',
}

export function expenseLifecycleStatusLabel(rawLifecycleStatus) {
  const key = String(rawLifecycleStatus || 'pending_approval').toLowerCase()
  return LIFECYCLE_STATUS_LABEL[key] || key.replace(/_/g, ' ')
}

// Fallback for a response that only has the legacy `status` (+ `payment_status`) field - keeps
// older/demo data working the same way real lifecycle_status-bearing data does.
function deriveLifecycleStatus(legacyStatusKey, paymentStatus) {
  if (legacyStatusKey === 'approved' && paymentStatus === 'Paid') return 'reimbursed'
  if (legacyStatusKey === 'approved') return 'approved'
  if (legacyStatusKey === 'rejected') return 'rejected'
  // 'pending' and 'clarification_requested' both still await a decision.
  return 'pending_approval'
}

function buildExpenseBody(payload) {
  const body = {
    category: payload.category || '',
    amount: Number(payload.amount) || 0,
  }

  if (payload.description) body.description = payload.description
  if (payload.expenseDate || payload.expense_date) body.expense_date = payload.expenseDate || payload.expense_date
  if (payload.paymentMode || payload.payment_mode) body.payment_mode = payload.paymentMode || payload.payment_mode
  if (payload.receiptUrl || payload.receipt_url) body.receipt_url = payload.receiptUrl || payload.receipt_url

  return body
}

function normalizeExpense(expense) {
  if (!expense) return expense

  const statusKey = String(expense.status || expense.approval_status || 'pending').toLowerCase()
  const paymentStatus = expense.payment_status || 'Pending'
  const lifecycleStatus = String(expense.lifecycle_status || deriveLifecycleStatus(statusKey, paymentStatus)).toLowerCase()

  return {
    id: expense.id,
    expenseId: expense.expense_id || expense.id,
    expenseNumber: expense.expense_number || '',
    category: expense.category || '',
    description: expense.description || '',
    amount: expense.amount ?? 0,
    // The reimbursement-eligible amount the backend validates against - read-only basis for
    // the Reimburse modal's Amount display (net_payable, falling back to amount).
    netPayable: expense.net_payable ?? expense.amount ?? 0,
    expenseDate: expense.expense_date,
    paymentMode: expense.payment_mode || '',
    receiptUrl: expense.receipt_url || '',
    // Raw lowercase status is the source of truth; label + the legacy `approvalStatus` are
    // derived so existing components keep working.
    statusKey,
    statusLabel: expenseStatusLabel(expense.status || expense.approval_status),
    expenseStatus: expense.expense_status || 'Submitted',
    approvalStatus: expenseStatusLabel(expense.status || expense.approval_status),
    paymentStatus,
    // New source of truth for action-visibility (Approve/Reject/Reimburse) - see
    // expenseLifecycleStatusLabel() above.
    lifecycleStatus,
    lifecycleStatusLabel: expenseLifecycleStatusLabel(lifecycleStatus),
    submittedBy: expense.submitted_by || '',
    submittedByName: expense.submitted_by_user?.name || expense.submitted_by_name || '',
    approvedBy: expense.approved_by || null,
    approverName: expense.approved_by_user?.name || expense.approver?.name || expense.approved_by_name || '',
    reviewedAt: expense.reviewed_at || expense.approved_at || null,
    // Backend field is `reject_reason`; the others are defensive aliases.
    rejectReason: expense.reject_reason || expense.clarification_note || expense.rejection_reason || '',
    clarificationNote: expense.reject_reason || expense.clarification_note || expense.rejection_reason || '',
    // Reimbursement details - only populated once lifecycleStatus === 'reimbursed'.
    reimbursedBy: expense.reimbursed_by_user?.name || expense.reimbursed_by || '',
    reimbursedAt: expense.reimbursed_at || null,
    reimbursementMethod: expense.reimbursement_method || '',
    reimbursementReference: expense.reimbursement_reference || '',
    reimbursementNotes: expense.reimbursement_notes || '',
    reimbursedAmount: expense.reimbursed_amount ?? null,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
  }
}

export async function getExpenseCategories() {
  try {
    const { data } = await apiClient.get('/expenses/categories', {
      headers: authHeader(),
    })

    return { success: true, categories: data?.categories || [] }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load expense categories. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function listExpenses(params = {}) {
  try {
    const queryParams = { page_size: params.page_size || 100 }
    if (params.page !== undefined) queryParams.page = params.page
    if (params.category) queryParams.category = params.category
    if (params.status) queryParams.status = toExpenseStatusParam(params.status)
    if (params.submitted_by) queryParams.submitted_by = params.submitted_by
    if (params.sort_by) queryParams.sort_by = params.sort_by
    if (params.sort_order) queryParams.sort_order = params.sort_order

    const { data } = await apiClient.get('/expenses', {
      headers: authHeader(),
      params: queryParams,
    })

    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
    return { success: true, expenses: rows.map(normalizeExpense), total: data?.total ?? rows.length }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load expenses. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function getExpense(expenseId) {
  try {
    const { data } = await apiClient.get(`/expenses/${expenseId}`, {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load expense details. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function createExpense(payload) {
  try {
    const { data } = await apiClient.post('/expenses', buildExpenseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to submit expense. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function updateExpense(expenseId, payload) {
  try {
    const { data } = await apiClient.patch(`/expenses/${expenseId}`, buildExpenseBody(payload), {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to update expense. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadExpenseReceipt(expenseId, file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post(`/expenses/${expenseId}/receipt`, formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    if (handleStorageLimitError(error)) {
      return { success: false, error: 'Storage limit reached.', code: 'PLAN_STORAGE_LIMIT_REACHED' }
    }

    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to attach receipt. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function approveExpense(expenseId) {
  try {
    const { data } = await apiClient.patch(`/expenses/${expenseId}/approve`, {}, {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to approve expense. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function rejectExpense(expenseId, reason) {
  try {
    const { data } = await apiClient.patch(`/expenses/${expenseId}/reject`, { reason }, {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to reject expense. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Canonical reimbursement payment methods (POST /expenses/{id}/reimburse `payment_method`).
export const REIMBURSEMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
]

// Only an approved expense can be reimbursed; the backend returns 400/403/409 for an invalid
// transition. `amount` is deliberately not sent - it's an optional validation-only field on the
// backend (must exactly equal net_payable if sent, partial reimbursement unsupported), so
// omitting it avoids a false mismatch while the UI still shows the amount read-only.
export async function reimburseExpense(expenseId, payload = {}) {
  try {
    const body = { payment_method: payload.paymentMethod || payload.payment_method }
    const reference = payload.paymentReference ?? payload.payment_reference
    if (reference) body.payment_reference = reference
    const paidAt = payload.paidAt ?? payload.paid_at
    if (paidAt) body.paid_at = paidAt
    if (payload.notes) body.notes = payload.notes

    const { data } = await apiClient.post(`/expenses/${expenseId}/reimburse`, body, {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to record this reimbursement. Please try again.',
    )

    return { success: false, error: message, status: error.response?.status }
  }
}

export async function requestExpenseClarification(expenseId, reason) {
  try {
    const { data } = await apiClient.patch(`/expenses/${expenseId}/request-clarification`, { reason }, {
      headers: authHeader(),
    })

    return { success: true, expense: normalizeExpense(data) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to request clarification. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function deleteExpense(expenseId) {
  try {
    await apiClient.delete(`/expenses/${expenseId}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to delete expense. Please try again.',
    )

    return { success: false, error: message }
  }
}
