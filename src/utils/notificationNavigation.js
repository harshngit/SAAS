import { ROLES, resolveWorkspaceRole } from '../auth/roles'
import { hasPlatformAccess, platformBaseForUser } from '../auth/platformRoles'

// Centralized notification -> frontend route mapper (notification contract §5). The backend's
// `action_url` is REST-shaped (e.g. `/sales-orders/{id}`) and doesn't know this app's actual
// route names/prefixes per role, so every notification click goes through here instead of each
// caller re-deriving its own mapping. A shape this app has no real page for (payment receipts,
// expenses, leaves, follow-ups - all list+modal pages with no per-id detail URL) resolves to the
// closest existing list page for that role, never a guessed/invented URL. A shape not recognised
// at all - and no usable entity_type/entity_id fallback - resolves to '' (do nothing) rather than
// pushing an unsupported backend path straight into the router.

function buildFromTable(table, role, id) {
  const base = table?.[role]
  if (!base) return ''
  return id ? `${base}/${id}` : base
}

// Resources with a real per-id detail route in this app today.
const DETAIL_ROUTES = {
  order: { [ROLES.ADMIN]: '/admin/orders', [ROLES.SALES_OFFICER]: '/sales/orders' },
  delivery: { [ROLES.ADMIN]: '/admin/deliveries', [ROLES.DELIVERY_PARTNER]: '/delivery/deliveries' },
  invoice: { [ROLES.ADMIN]: '/admin/invoices', [ROLES.ACCOUNTANT]: '/accounts/invoices/sales' },
  lead: { [ROLES.ADMIN]: '/admin/leads', [ROLES.SALES_OFFICER]: '/sales/leads' },
  quotation: { [ROLES.ADMIN]: '/admin/quotations', [ROLES.SALES_OFFICER]: '/sales/quotations' },
}

// Resources that only exist as a list+modal page (no standalone detail URL) - lands on the list,
// not a focused row. Documented as a known limitation, not silently pretended away.
const LIST_ROUTES = {
  expense: {
    [ROLES.ADMIN]: '/admin/expenses',
    [ROLES.SALES_OFFICER]: '/sales/expenses',
    [ROLES.DELIVERY_PARTNER]: '/delivery/expenses',
    [ROLES.ACCOUNTANT]: '/accounts/expenses/approval',
  },
  leave: {
    [ROLES.ADMIN]: '/admin/leaves',
    [ROLES.SALES_OFFICER]: '/sales/leaves',
    [ROLES.DELIVERY_PARTNER]: '/delivery/leaves',
    [ROLES.ACCOUNTANT]: '/accounts/leaves',
  },
  // Follow-ups only exist as a Sales Officer surface - there is no Admin/Accountant equivalent.
  followUp: { [ROLES.SALES_OFFICER]: '/sales/followups' },
  // A payment-receipts action_url means the backend had no invoice_id to point at - the closest
  // real surface is that role's invoice list (receipts are shown inline there / on Customer
  // Detail's payment history, never on their own URL).
  paymentReceipt: { [ROLES.ADMIN]: '/admin/invoices', [ROLES.ACCOUNTANT]: '/accounts/invoices/sales' },
}

function resolveStockDestination(role, params) {
  const productId = params?.get('product_id') || ''
  if (role === ROLES.ADMIN) return productId ? `/admin/inventory/${productId}` : '/admin/inventory'
  if (role === ROLES.SALES_OFFICER) return '/sales/stock'
  return ''
}

// Neither the Delivery Partner's own screen nor the Admin/Accountant approval queue has a
// per-id detail URL - "current" and "{id}" both resolve to the one surface each role has.
function resolveDayEndDestination(role) {
  if (role === ROLES.DELIVERY_PARTNER) return '/delivery/day-end'
  if (role === ROLES.ADMIN) return '/admin/day-end-approvals'
  if (role === ROLES.ACCOUNTANT) return '/accounts/day-end-approvals'
  return ''
}

function resolveOrganizationDestination(currentUser, id) {
  if (!hasPlatformAccess(currentUser)) return ''
  return `${platformBaseForUser(currentUser)}/organizations/${id}`
}

// No per-id upgrade-request detail route exists for either platform shell - lands on the list.
function resolveUpgradeRequestDestination(currentUser) {
  if (!hasPlatformAccess(currentUser)) return ''
  return `${platformBaseForUser(currentUser)}/upgrade-requests`
}

// Org side: one universal detail route, reachable by every authenticated role (Admin and Staff
// alike) - no per-role table needed, same path the backend's own action_url already uses.
function resolveSupportTicketDestination(ticketId) {
  return ticketId ? `/support/tickets/${ticketId}` : '/support/tickets'
}

// Platform side: same /platform-vs-/superadmin prefix split as every other platform surface.
function resolvePlatformSupportTicketDestination(currentUser, ticketId) {
  if (!hasPlatformAccess(currentUser)) return ''
  const base = `${platformBaseForUser(currentUser)}/support-tickets`
  return ticketId ? `${base}/${ticketId}` : base
}

const PATH_MATCHERS = [
  { re: /^\/sales-orders\/([^/]+)$/, resolve: (m, role) => buildFromTable(DETAIL_ROUTES.order, role, m[1]) },
  { re: /^\/deliveries\/([^/]+)$/, resolve: (m, role) => buildFromTable(DETAIL_ROUTES.delivery, role, m[1]) },
  { re: /^\/invoices\/([^/]+)$/, resolve: (m, role) => buildFromTable(DETAIL_ROUTES.invoice, role, m[1]) },
  { re: /^\/payment-receipts\/([^/]+)$/, resolve: (m, role) => buildFromTable(LIST_ROUTES.paymentReceipt, role) },
  { re: /^\/expenses\/([^/]+)$/, resolve: (m, role) => buildFromTable(LIST_ROUTES.expense, role) },
  { re: /^\/leaves\/([^/]+)$/, resolve: (m, role) => buildFromTable(LIST_ROUTES.leave, role) },
  { re: /^\/leads\/([^/]+)$/, resolve: (m, role) => buildFromTable(DETAIL_ROUTES.lead, role, m[1]) },
  { re: /^\/follow-ups\/([^/]+)$/, resolve: (m, role) => buildFromTable(LIST_ROUTES.followUp, role) },
  { re: /^\/quotations\/([^/]+)$/, resolve: (m, role) => buildFromTable(DETAIL_ROUTES.quotation, role, m[1]) },
  { re: /^\/delivery-day-ends\/current$/, resolve: (m, role) => resolveDayEndDestination(role) },
  { re: /^\/delivery-day-ends\/([^/]+)$/, resolve: (m, role) => resolveDayEndDestination(role) },
  { re: /^\/warehouses\/stock$/, resolve: (m, role, params) => resolveStockDestination(role, params) },
  // Backend's own action_url already uses the Super Admin's frontend prefix for these two -
  // also accept a bare `/organizations/{id}` / `/upgrade-requests` in case that changes.
  { re: /^(?:\/superadmin)?\/organizations\/([^/]+)$/, resolve: (m, _role, _params, currentUser) => resolveOrganizationDestination(currentUser, m[1]) },
  { re: /^(?:\/platform)?\/upgrade-requests(?:\/[^/]+)?$/, resolve: (m, _role, _params, currentUser) => resolveUpgradeRequestDestination(currentUser) },
  { re: /^\/support\/tickets\/([^/]+)$/, resolve: (m) => resolveSupportTicketDestination(m[1]) },
  { re: /^\/platform\/support\/tickets\/([^/]+)$/, resolve: (m, _role, _params, currentUser) => resolvePlatformSupportTicketDestination(currentUser, m[1]) },
]

// Entity-based last resort for a notification whose action_url doesn't match any known shape
// above, but whose structured entity_type/entity_id fields (never body text) are still one of
// the documented ones - keeps a future minor action_url drift from silently going nowhere.
const ENTITY_DETAIL_ROUTES = {
  order: DETAIL_ROUTES.order,
  delivery: DETAIL_ROUTES.delivery,
  invoice: DETAIL_ROUTES.invoice,
  lead: DETAIL_ROUTES.lead,
  quotation: DETAIL_ROUTES.quotation,
}

function parsePath(rawUrl) {
  try {
    const parsed = new URL(rawUrl, 'https://notification.local')
    return { pathname: parsed.pathname.replace(/\/+$/, '') || '/', params: parsed.searchParams }
  } catch {
    const [path, query] = rawUrl.split('?')
    return { pathname: (path || '/').replace(/\/+$/, '') || '/', params: new URLSearchParams(query || '') }
  }
}

// `context` = { currentUser, role } - `role` is the raw role object from usePermission() (used
// by resolveWorkspaceRole for custom-role safety), `currentUser` is the authStore user.
export function resolveNotificationDestination(notification, context = {}) {
  const { currentUser } = context
  const resolvedRole = resolveWorkspaceRole(context) || currentUser?.role || ''
  const rawUrl = String(notification?.actionUrl || notification?.action_url || notification?.link || '').trim()
  if (!rawUrl) return ''

  // Legacy rows: `link` used to be a bare delivery id (no leading slash), not a path at all -
  // preserve that exact old resolution so any notification still in that shape keeps working.
  if (!rawUrl.startsWith('/') && !rawUrl.startsWith('http')) {
    if (notification?.type === 'delivery') {
      if (resolvedRole === ROLES.DELIVERY_PARTNER) return `/delivery/deliveries/${rawUrl}`
      if (resolvedRole === ROLES.ADMIN) return `/admin/deliveries/${rawUrl}`
    }
    return ''
  }

  const { pathname, params } = parsePath(rawUrl)

  for (const matcher of PATH_MATCHERS) {
    const match = pathname.match(matcher.re)
    if (!match) continue
    // Matched a known shape - resolve it (possibly to '' if this role has no surface for it) and
    // stop. Never fall through to pushing the raw backend path into the router.
    return matcher.resolve(match, resolvedRole, params, currentUser) || ''
  }

  const entityType = notification?.entityType || notification?.entity_type
  const entityId = notification?.entityId || notification?.entity_id
  if (entityType && entityId) {
    return buildFromTable(ENTITY_DETAIL_ROUTES[entityType], resolvedRole, entityId)
  }

  return ''
}

export function isPlatformNotification(notification) {
  return notification?.scope === 'platform'
}
