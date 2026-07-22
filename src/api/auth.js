import { useAuthStore } from '../store/authStore'

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export async function login({ email, phone, password, otp }) {
  await delay()
  return useAuthStore.getState().login({ email, phone, password, otp })
}

export async function registerOrganization(payload) {
  await delay()
  return useAuthStore.getState().registerOrganization(payload)
}

export async function logout() {
  useAuthStore.getState().logout()
}
