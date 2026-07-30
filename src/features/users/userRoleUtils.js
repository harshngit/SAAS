import { ROLES } from '../../auth/roles'

export const staffRoleOptions = [
  ROLES.SALES_OFFICER,
  ROLES.DELIVERY_PARTNER,
  ROLES.ACCOUNTANT,
]

export const roleNameToSystemRole = {
  superadmin: ROLES.SUPER_ADMIN,
  super_admin: ROLES.SUPER_ADMIN,
  admin: ROLES.ADMIN,
  salesofficer: ROLES.SALES_OFFICER,
  sales_officer: ROLES.SALES_OFFICER,
  deliverypartner: ROLES.DELIVERY_PARTNER,
  delivery_partner: ROLES.DELIVERY_PARTNER,
  accountant: ROLES.ACCOUNTANT,
}

export function getSystemRoleFromRoleName(name = '') {
  const normalizedName = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const compactName = normalizedName.replace(/_/g, '')
  return roleNameToSystemRole[normalizedName] || roleNameToSystemRole[compactName] || normalizedName
}

export function normalizeApiUser(user) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name),
    role_id: user.role_id,
    roleId: user.role_id,
    roleDetail: user.role_detail,
    status: user.is_active ? 'active' : 'inactive',
    createdAt: user.created_at,
  }
}
