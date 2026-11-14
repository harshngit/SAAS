import axios from 'axios'
import { showGlobalToast } from '../components/ui/toastContext'
import { useAuthStore } from '../store/authStore'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.asynk.in').replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshRequest = null

const RETRYABLE_STATUSES = [502, 503, 504]

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// One silent retry for a GET that failed transiently (network drop, or the backend/gateway
// returning 502/503/504 - a cold worker, a deploy, a timeout upstream). Never for POST/PATCH/
// PUT/DELETE: repeating a write automatically isn't safe without an idempotency key, and a
// cancelled request (route/filter changed, AbortController fired) must never be retried.
function isTransientGetFailure(error, config) {
  if (!config || config._retriedAfterFailure) return false
  if ((config.method || '').toLowerCase() !== 'get') return false
  if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return false
  if (error.response) return RETRYABLE_STATUSES.includes(error.response.status)
  // No response at all = a network-level failure (offline, DNS, connection reset) - a request
  // that timed out client-side (ECONNABORTED) is excluded, since 2s later is unlikely to help.
  return error.code !== 'ECONNABORTED'
}

// "The server never answered": no HTTP response at all (offline, DNS, connection reset, a
// response blocked for missing CORS headers / ERR_FAILED, or a client-side timeout). Cancelled
// requests are not failures. This is NOT an authentication problem, so it must never log anyone out.
function isNoResponseError(error) {
  if (!error || error.response) return false
  if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return false
  return Boolean(error.isAxiosError || error.request)
}

let lastConnectionToastAt = 0

// One friendly toast per burst - a page load fires many GETs at once and they would all fail together.
function notifyConnectionProblem(isRetrying) {
  const now = Date.now()
  if (now - lastConnectionToastAt < 6000) return
  lastConnectionToastAt = now
  showGlobalToast({
    title: 'Connection problem',
    message: isRetrying
      ? 'Server se connect nahi ho pa raha, dobara try ho raha hai'
      : 'Server se connect nahi ho pa raha, thodi der baad dobara try karein',
    duration: 5000,
  })
}

function requestHadToken(config) {
  const header = config?.headers?.Authorization || (typeof config?.headers?.get === 'function' ? config.headers.get('Authorization') : '')
  return Boolean(header || useAuthStore.getState().authTokens?.access_token)
}

function redirectToLogin() {
  if (typeof window === 'undefined' || window.location.pathname === '/login') {
    return
  }

  window.location.replace('/login')
}

export function normalizeTokens(tokenResponse) {
  if (tokenResponse?.tokens) {
    return tokenResponse.tokens
  }

  if (tokenResponse?.access_token && tokenResponse?.refresh_token) {
    return {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      token_type: tokenResponse.token_type || 'bearer',
    }
  }

  return null
}

async function refreshAuthTokens() {
  const refreshToken = useAuthStore.getState().authTokens?.refresh_token

  if (!refreshToken) {
    throw new Error('Missing refresh token')
  }

  if (!refreshRequest) {
    showGlobalToast({
      title: 'Refreshing session',
      message: 'Your access token is being refreshed.',
      duration: 2500,
    })

    refreshRequest = refreshClient
      .post('/auth/refresh', { refresh_token: refreshToken })
      .then(({ data }) => {
        const tokens = normalizeTokens(data)

        if (!tokens?.access_token) {
          throw new Error('Invalid refresh response')
        }

        useAuthStore.getState().setAuthTokens(tokens)
        return tokens
      })
      .finally(() => {
        refreshRequest = null
      })
  }

  return refreshRequest
}

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().authTokens?.access_token

  if (accessToken) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isUnauthorized = error.response?.status === 401
    const requestUrl = originalRequest?.url || ''
    if (isUnauthorized && requestUrl.startsWith('/platform/')) {
      useAuthStore.getState().logout()
      redirectToLogin()
      return Promise.reject(error)
    }
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/phone/')

    if (!isUnauthorized || !originalRequest || originalRequest._retry || isAuthRequest) {
      const noResponse = isNoResponseError(error) && requestHadToken(originalRequest)
      if (isTransientGetFailure(error, originalRequest)) {
        if (noResponse) notifyConnectionProblem(true)
        originalRequest._retriedAfterFailure = true
        await delay(2000)
        return apiClient(originalRequest)
      }
      // A write (or an already-retried GET) that never reached the server: tell the user, keep the
      // session, and do NOT replay it (repeating a POST/PUT/PATCH/DELETE isn't safe).
      if (noResponse) notifyConnectionProblem(false)
      return Promise.reject(error)
    }

    originalRequest._retry = true

    let tokens
    try {
      tokens = await refreshAuthTokens()
    } catch (refreshError) {
      // Log out only when the server actually rejected us (the 401 that got us here plus a refresh
      // token that is missing/invalid). A refresh that never got an answer (network down, CORS /
      // ERR_FAILED, timeout) or hit a 5xx/429 says nothing about the session - keep the user signed
      // in and surface the original error so the screen can retry.
      const refreshStatus = refreshError?.response?.status
      const refreshNeverAnswered = isNoResponseError(refreshError)
      const refreshServerFault = Boolean(refreshStatus) && (refreshStatus >= 500 || refreshStatus === 429)
      if (refreshNeverAnswered || refreshServerFault) {
        if (refreshNeverAnswered) notifyConnectionProblem(false)
        return Promise.reject(error)
      }
      useAuthStore.getState().logout()
      redirectToLogin()
      return Promise.reject(refreshError)
    }

    // Replay outside the refresh try/catch: a failure of the replayed request itself (network, 500,
    // a second 401) must not be mistaken for a failed token refresh and must not log the user out.
    originalRequest.headers = originalRequest.headers || {}
    originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`
    try {
      return await apiClient(originalRequest)
    } catch (replayError) {
      // A real 401 even with a freshly refreshed token = the session is genuinely invalid.
      if (replayError?.response?.status === 401) {
        useAuthStore.getState().logout()
        redirectToLogin()
      }
      throw replayError
    }
  },
)
