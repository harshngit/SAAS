// Lightweight shared cache + in-flight dedup for GET-ish calls that many independent
// components each trigger on their own mount (e.g. /auth/me from Layout + AdminTrialPopup +
// PlatformGuard, /notifications/unread-count from polling). No React Query in this project -
// this is the minimal dependency-free equivalent of its staleTime+dedup behavior for the
// specific endpoints that were firing duplicate requests.
//
// Only successful results are cached - a failed call never poisons other callers with a sticky
// error for the staleTime window, it just lets the next caller retry immediately.
const cache = new Map()

export function dedupeRequest(key, fetcher, { staleTime = 30000 } = {}) {
  const entry = cache.get(key)
  const now = Date.now()

  if (entry?.promise) return entry.promise
  if (entry && now - entry.timestamp < staleTime) return Promise.resolve(entry.result)

  const promise = fetcher()
    .then((result) => {
      if (result?.success) cache.set(key, { result, timestamp: Date.now() })
      else cache.delete(key)
      return result
    })
    .catch((error) => {
      cache.delete(key)
      throw error
    })

  cache.set(key, { promise, timestamp: now })
  return promise
}

export function invalidateRequest(key) {
  cache.delete(key)
}
