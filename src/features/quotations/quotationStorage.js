const STORAGE_KEY = 'saas-crm-quotations'

export function readStoredQuotations() {
  if (typeof window === 'undefined') return []

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredQuotation(quotation) {
  if (typeof window === 'undefined') return

  const storedQuotations = readStoredQuotations()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([quotation, ...storedQuotations]))
}
