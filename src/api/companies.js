import { useAuthStore } from '../store/authStore'
import { apiClient } from './client'

// =============================================================================
// Companies - lightweight list for the dashboard "Company" scope filter.
//   GET /companies?active=true  ->  [{ id, name, is_active }]
// Returns an empty list on any failure so the dropdown falls back to
// "All Companies" without breaking the dashboard.
// =============================================================================

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

function normalizeCompany(row) {
  return {
    id: row.id || row.company_id || row.uuid || '',
    name: row.name || row.company_name || row.title || '',
    isActive: row.is_active !== false,
  }
}

export async function listCompanies({ active = true } = {}) {
  try {
    const { data } = await apiClient.get('/companies', {
      headers: authHeader(),
      params: active ? { active: true } : {},
    })
    const rows = Array.isArray(data) ? data : data?.companies || data?.items || data?.results || []
    return { success: true, companies: rows.map(normalizeCompany).filter((company) => company.id) }
  } catch {
    return { success: false, companies: [] }
  }
}
