// Platform roles are independent of tenant roles/workspaces.
export function platformRoleForUser(user) {
  if (!user || user.organization_id != null || user.orgId != null) return null
  if (user.system_role === 'super_admin') return 'super_admin'
  if (user.system_role === 'sales_manager' && user.organization_id === null) return 'sales_manager'
  // Preserve existing Super Admin sessions from before system_role was exposed.
  if (!user.system_role && user.role === 'super_admin') return 'super_admin'
  return null
}
export function platformHomeForUser(user) {
  const role = platformRoleForUser(user)
  return role === 'super_admin' ? '/superadmin/dashboard' : role === 'sales_manager' ? '/platform/organizations' : null
}
export function platformBaseForUser(user) {
  return platformRoleForUser(user) === 'sales_manager' ? '/platform' : '/superadmin'
}

export function hasPlatformAccess(user, superAdminOnly = false) {
  const role = platformRoleForUser(user)
  return Boolean(role) && (!superAdminOnly || role === 'super_admin')
}
