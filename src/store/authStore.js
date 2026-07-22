import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { users as seedUsers } from '../mockData/users'
import { organizations as seedOrganizations } from '../mockData/organizations'

export const DEMO_PASSWORD = 'demo123'

let orgSequence = seedOrganizations.length + 1
let userSequence = seedUsers.length + 1

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null,
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

        set((state) => ({
          organizations: [...state.organizations, organization],
          users: [...state.users, user],
          currentUser: user,
        }))

        return { success: true, user, organization }
      },

      logout: () => set({ currentUser: null }),
    }),
    { name: 'aquapure-auth-storage' },
  ),
)
