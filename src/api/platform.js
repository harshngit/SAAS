import { apiClient } from './client'
import { formatApiError } from './superadmin'
import { normalizePayment } from './billing'
import { useAuthStore } from '../store/authStore'

const idPath = (id) => encodeURIComponent(id)
export async function platformRequest(method, path, { params, body } = {}) {
  try {
    const { data } = await apiClient.request({ method, url: `/platform${path}`, params, data: body })
    return { success: true, data }
  } catch (error) {
    const status = error.response?.status
    if (status === 401) useAuthStore.getState().logout()
    const detail = error.response?.data?.detail ?? error.response?.data
    const message = formatApiError(detail, 'Unable to load Platform Operations. Please retry.')
    const fieldErrors = {}
    if (Array.isArray(detail)) for (const issue of detail) {
      const field = issue.loc?.filter(part => part !== 'body').at(-1)
      if (field) fieldErrors[field] = issue.msg
    }
    if (status === 409 && /email/i.test(message)) fieldErrors.email = message
    return { success: false, status, error: status === 403 ? `You don't have access. ${message}` : message, fieldErrors }
  }
}
function query(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null))
}
async function list(path, key, params = {}) {
  const result = await platformRequest('get', path, { params: query(params) })
  if (!result.success) return result
  const data = result.data
  const rows = Array.isArray(data) ? data : data?.items ?? data?.[key]
  if (!Array.isArray(rows)) return { success: false, error: 'The platform returned an unexpected list response. Please refresh.' }
  return { success: true, [key]: rows, total: data?.total ?? rows.length }
}
export const listPlatformStaff = params => list('/staff', 'staff', params)
export const createPlatformStaff = body => platformRequest('post', '/staff', { body })
export const updatePlatformStaff = (id, body) => platformRequest('patch', `/staff/${idPath(id)}`, { body })
// Permanent delete (Super Admin only) - 204 on success, 404 if the id is not platform staff
// (already deleted, or a Super Admin/tenant id, which this route never touches).
export const deletePlatformStaff = id => platformRequest('delete', `/staff/${idPath(id)}`)
// All-or-nothing: a 404 here means NONE of the ids were deleted (detail.ids lists the bad ones).
export const bulkDeletePlatformStaff = ids => platformRequest('post', '/staff/bulk-delete', { body: { ids } })
export const listPlatformOrganizations = params => list('/organizations', 'organizations', { page_size: 100, ...params })
export async function getPlatformOrganization(id) {
  const result = await platformRequest('get', `/organizations/${idPath(id)}`)
  return result.success ? { success: true, organization: result.data } : result
}
export const listPlatformPlans = () => list('/plans', 'plans')
export const listPlatformFeatures = () => list('/features', 'features')
export const getPlatformEntitlements = id => platformRequest('get', `/organizations/${idPath(id)}/entitlements`)
export async function getPlatformPayments(id) {
  const result = await list(`/organizations/${idPath(id)}/subscription-payments`, 'payments')
  return result.success ? { ...result, payments: result.payments.map(normalizePayment) } : result
}
export const listPlatformRequests = (kind, params) => list(`/${kind}-requests`, 'requests', { page_size: 100, ...params })
export const createPlatformUpgrade = (id, body) => platformRequest('post', `/organizations/${idPath(id)}/upgrade-requests`, { body })
export const createPlatformFeature = (id, body) => platformRequest('post', `/organizations/${idPath(id)}/feature-requests`, { body })
export const decidePlatformRequest = (kind, id, decision, note) => platformRequest('post', `/${kind}-requests/${idPath(id)}/${decision}`, { body: { note: note || '' } })

export function changedStaffFields(original, draft) {
  const body = {}
  for (const field of ['name', 'email', 'phone', 'role', 'is_active']) {
    if (draft[field] !== undefined && draft[field] !== original[field]) body[field] = draft[field]
  }
  if (draft.password) body.password = draft.password
  return body
}
