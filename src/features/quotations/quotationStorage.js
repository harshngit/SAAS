import { quotations as seedQuotations } from '../../mockData/quotations'

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

// Replaces the stored copy of a quotation (or adds one, e.g. the first time a seed
// quotation's status is changed) so edits always take precedence over seed data.
export function upsertStoredQuotation(quotation) {
  if (typeof window === 'undefined') return

  const storedQuotations = readStoredQuotations()
  const withoutExisting = storedQuotations.filter((item) => item.id !== quotation.id)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([quotation, ...withoutExisting]))
}

// Combined list with stored edits overriding seed rows sharing the same id, so a
// status change never shows up as a duplicate entry alongside the original seed row.
export function getAllQuotations() {
  const storedQuotations = readStoredQuotations()
  const storedIds = new Set(storedQuotations.map((quotation) => quotation.id))
  const seedOnly = seedQuotations.filter((quotation) => !storedIds.has(quotation.id))
  return [...storedQuotations, ...seedOnly]
}

export function getQuotationById(id) {
  return getAllQuotations().find((quotation) => quotation.id === id) || null
}
