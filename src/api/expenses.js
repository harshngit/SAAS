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

  return {
    id: expense.id,
    expenseId: expense.expense_id || expense.id,
    expenseNumber: expense.expense_number || '',
    category: expense.category || '',
    description: expense.description || '',
    amount: expense.amount ?? 0,
    expenseDate: expense.expense_date,
    paymentMode: expense.payment_mode || '',
    receiptUrl: expense.receipt_url || '',
    expenseStatus: expense.expense_status || 'Submitted',
    approvalStatus: expense.approval_status || 'Pending',
    paymentStatus: expense.payment_status || 'Pending',
    submittedBy: expense.submitted_by || '',
    submittedByName: expense.submitted_by_user?.name || '',
    approvedBy: expense.approved_by || null,
    approverName: expense.approved_by_user?.name || expense.approver?.name || '',
    reviewedAt: expense.reviewed_at || expense.approved_at || null,
    clarificationNote: expense.clarification_note || expense.rejection_reason || '',
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
    const queryParams = {}
    if (params.category) queryParams.category = params.category
    if (params.status) queryParams.status = params.status
    if (params.submitted_by) queryParams.submitted_by = params.submitted_by

    const { data } = await apiClient.get('/expenses', {
      headers: authHeader(),
      params: queryParams,
    })

    const expenses = Array.isArray(data) ? data : data?.expenses || []
    return { success: true, expenses: expenses.map(normalizeExpense) }
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
