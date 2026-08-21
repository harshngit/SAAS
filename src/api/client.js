import axios from 'axios'
import { showGlobalToast } from '../components/ui/toastContext'
import { useAuthStore } from '../store/authStore'

export const API_BASE_URL = 'https://saasbackend-1-f6v3.onrender.com/'

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
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh')

    if (!isUnauthorized || !originalRequest || originalRequest._retry || isAuthRequest) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const tokens = await refreshAuthTokens()
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      useAuthStore.getState().logout()
      redirectToLogin()
      return Promise.reject(refreshError)
    }
  },
)
