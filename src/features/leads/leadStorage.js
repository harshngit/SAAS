const STORAGE_KEY = 'saas-crm-leads'

export function readStoredLeads() {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredLead(lead) {
  if (typeof window === 'undefined') return

  const storedLeads = readStoredLeads()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([lead, ...storedLeads]))
}
