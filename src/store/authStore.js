import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { users as seedUsers } from '../mockData/users'
import { organizations as seedOrganizations } from '../mockData/organizations'

export const DEMO_PASSWORD = 'demo123'
export const AUTH_PROFILE_STORAGE_KEY = 'aquapure-auth-profile'

let orgSequence = seedOrganizations.length + 1
let userSequence = seedUsers.length + 1

function readStoredAuthProfile() {
  if (typeof window === 'undefined') return null

  try {
    const storedProfile = window.localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)
    return storedProfile ? JSON.parse(storedProfile) : null
  } catch {
    return null
  }
}

function saveAuthProfile(authProfile) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(authProfile))
  } catch {
    // The persisted Zustand store still keeps the app usable if explicit storage is blocked.
  }
}

function removeAuthProfile() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures; in-memory auth is still cleared below.
  }
}

const storedAuthProfile = readStoredAuthProfile()

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: storedAuthProfile?.user || null,
      currentOrganization: storedAuthProfile?.organization || null,
      authProfile: storedAuthProfile,
      authTokens: null,
      users: seedUsers,
      organizations: seedOrganizations,

      login: ({ email, phone, password, otp }) => {
        const normalizedPhone = phone?.replace(/\D/g, '')
        const user = get().users.find((u) => {
          if (email) {
            return u.email.toLowerCase() === email.toLowerCase()
          }
          const userPhone = u.phone?.replace(/\D/g, '')
          return userPhone && normalizedPhone && (userPhone === normalizedPhone || userPhone.endsWith(normalizedPhone))
        })
        const validCredential = email ? password === DEMO_PASSWORD : /^\d{6}$/.test(otp || '')
        if (!user || !validCredential) {
          return { success: false, error: email ? 'Invalid email or password' : 'Invalid phone number or OTP' }
        }
        set({ currentUser: user })
        return { success: true, user }
      },

      setAuthenticatedSession: ({ user, organization, tokens, access_token, refresh_token, token_type }) => {
        const nextTokens =
          tokens ||
          (access_token && refresh_token
            ? {
                access_token,
                refresh_token,
                token_type: token_type || 'bearer',
              }
            : null)

        const normalizedUser = {
          ...user,
          orgId: user.organization_id,
          status: user.is_active ? 'active' : 'inactive',
          joinedAt: user.created_at,
        }

        const normalizedOrganization = organization
          ? {
              ...organization,
              legalName: organization.legal_name,
              industry: organization.industry,
              businessType: organization.business_type,
              gstNumber: organization.gst_number,
              panNumber: organization.pan_number,
              financialYear: organization.financial_year,
              createdAt: organization.created_at,
            }
          : null
        const authProfile = {
          user: normalizedUser,
          organization: normalizedOrganization,
        }

        saveAuthProfile(authProfile)

        set((state) => ({
          currentUser: normalizedUser,
          currentOrganization: normalizedOrganization,
          authProfile,
          authTokens: nextTokens || state.authTokens,
          users: state.users.some((existingUser) => existingUser.id === normalizedUser.id)
            ? state.users.map((existingUser) => (existingUser.id === normalizedUser.id ? normalizedUser : existingUser))
            : [...state.users, normalizedUser],
          organizations: normalizedOrganization
            ? state.organizations.some((existingOrg) => existingOrg.id === normalizedOrganization.id)
              ? state.organizations.map((existingOrg) => (existingOrg.id === normalizedOrganization.id ? normalizedOrganization : existingOrg))
              : [...state.organizations, normalizedOrganization]
            : state.organizations,
        }))
      },

      setAuthTokens: (tokens) => {
        set({ authTokens: tokens })
      },

      registerOrganization: (payload) => {
        const existing = get().users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase())
        if (existing) {
          return { success: false, error: 'An account with this email already exists' }
        }

        const orgId = `org-${orgSequence++}`
        const userId = `usr-${userSequence++}`
        const createdAt = new Date().toISOString().slice(0, 10)

        const organization = {
          id: orgId,
          name: payload.companyName,
          slug: payload.companyName.toLowerCase().trim().replace(/\s+/g, '-'),
          plan: 'Free',
          status: 'trial',
          businessType: payload.businessType,
          gstNumber: payload.gstNumber,
          panNumber: payload.panNumber || null,
          billingAddress: payload.billingAddress,
          shippingAddress: payload.sameAsBilling ? payload.billingAddress : payload.shippingAddress || payload.billingAddress,
          phone: payload.phone,
          alternatePhone: payload.alternatePhone || null,
          email: payload.email,
          website: payload.website || null,
          financialYear: payload.financialYear,
          invoicePrefix: payload.invoicePrefix,
          invoiceStartNumber: payload.invoiceStartNumber,
          createdAt,
          subscriptionRenewsAt: null,
        }

        const user = {
          id: userId,
          name: payload.adminName,
          email: payload.email,
          role: 'admin',
          orgId,
          phone: payload.phone,
          status: 'active',
          joinedAt: createdAt,
        }
        const authProfile = { user, organization }

        saveAuthProfile(authProfile)

        set((state) => ({
          organizations: [...state.organizations, organization],
          users: [...state.users, user],
          currentUser: user,
          currentOrganization: organization,
          authProfile,
        }))

        return { success: true, user, organization }
      },

      logout: () => {
        removeAuthProfile()
        set({ currentUser: null, currentOrganization: null, authProfile: null, authTokens: null })
      },
    }),
    { name: 'aquapure-auth-storage' },
  ),
)
