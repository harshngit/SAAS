import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  FileText,
  IndianRupee,
  Loader2,
  Package,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { usePermission } from '../../auth/usePermission'
import { ROLES } from '../../auth/roles'
import { listCustomers } from '../../api/customers'
import { listOrders } from '../../api/orders'
import { listQuotations } from '../../api/quotations'
import { listInvoices } from '../../api/invoices'
import { listLeads } from '../../api/leads'
import { listProducts } from '../../api/products'
import { listSuperAdminOrganizations } from '../../api/superadmin'

const RESULTS_PER_DOMAIN = 5
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

// The topbar carries .theme-glass (backdrop-filter: blur) in Image background mode, and a
// Chromium compositing quirk corrupts/blurs text in descendants of a backdrop-filter ancestor -
// same issue already documented on Topbar.jsx's notifications/menu panels. Portaling this
// dropdown to document.body, positioned from the input's own rect, is the real fix.
function usePortalPosition(isOpen, triggerRef) {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const updateRect = () => {
      if (!triggerRef.current) return
      const bounds = triggerRef.current.getBoundingClientRect()
      setRect({ top: bounds.bottom + 8, left: bounds.left, width: bounds.width })
    }

    updateRect()
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [isOpen, triggerRef])

  return rect
}

// Each domain's list base path per role - a domain is only ever searched for a role it has an
// entry for here, so results always land on a route that role actually has (no 404s, no extra
// calls to endpoints a role can't reach).
const DOMAINS = [
  {
    key: 'customers',
    label: 'Customers',
    module: 'customers',
    icon: Users,
    basePathByRole: { [ROLES.ADMIN]: '/admin/customers', [ROLES.SALES_OFFICER]: '/sales/customers' },
    search: (query) => listCustomers({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.customers,
    getId: (row) => row.id,
    getTitle: (row) => row.name || 'Unnamed customer',
    getSubtitle: (row) => row.phone || row.email || '',
  },
  {
    key: 'orders',
    label: 'Orders',
    module: 'sales_orders',
    icon: ShoppingCart,
    basePathByRole: { [ROLES.ADMIN]: '/admin/orders', [ROLES.SALES_OFFICER]: '/sales/orders' },
    search: (query) => listOrders({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.orders,
    getId: (row) => row.id,
    getTitle: (row) => row.orderNumber,
    getSubtitle: (row) => row.customerName || '',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    module: 'quotations',
    icon: FileText,
    basePathByRole: { [ROLES.ADMIN]: '/admin/quotations', [ROLES.SALES_OFFICER]: '/sales/quotations' },
    search: (query) => listQuotations({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.quotations,
    getId: (row) => row.id,
    getTitle: (row) => row.quotationNumber,
    getSubtitle: (row) => row.customerName || row.leadName || '',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    module: 'invoices',
    icon: Receipt,
    basePathByRole: { [ROLES.ADMIN]: '/admin/invoices', [ROLES.ACCOUNTANT]: '/accounts/invoices/sales' },
    search: (query) => listInvoices({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.invoices,
    getId: (row) => row.id,
    getTitle: (row) => row.invoiceNumber,
    getSubtitle: (row) => row.customerName || row.walkInName || '',
  },
  {
    key: 'leads',
    label: 'Leads',
    module: 'leads',
    icon: UserPlus,
    basePathByRole: { [ROLES.ADMIN]: '/admin/leads', [ROLES.SALES_OFFICER]: '/sales/leads' },
    search: (query) => listLeads({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.leads,
    getId: (row) => row.id,
    getTitle: (row) => row.name || 'Unnamed lead',
    getSubtitle: (row) => row.contactPerson || row.email || '',
  },
  {
    key: 'products',
    label: 'Products',
    module: 'products',
    icon: Package,
    basePathByRole: { [ROLES.ADMIN]: '/admin/products' },
    // GET /products returns raw rows (not run through a normalizer elsewhere in this app).
    search: (query) => listProducts({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.products,
    getId: (row) => row.id,
    getTitle: (row) => row.name || 'Unnamed product',
    getSubtitle: (row) => row.sku || row.code || row.barcode || '',
  },
  {
    key: 'organizations',
    label: 'Organizations',
    module: null, // superadmin has fullAccess, no module permission gate applies
    icon: Building2,
    basePathByRole: { [ROLES.SUPER_ADMIN]: '/superadmin/organizations' },
    search: (query) => listSuperAdminOrganizations({ search: query, page_size: RESULTS_PER_DOMAIN }),
    getItems: (result) => result.organizations,
    getId: (row) => row.id,
    getTitle: (row) => row.name || 'Unnamed organization',
    getSubtitle: (row) => row.email || '',
  },
]

// Related/quick-nav suggestions - matched against a query synchronously (no network round trip),
// so a term like "invoice" that matches no literal record (invoice numbers read "IN-10001-...",
// never the word "invoice") still surfaces somewhere useful instead of a bare "No results".
// Same per-role basePath gating as DOMAINS, so a suggestion never points somewhere that role
// can't open.
const QUICK_LINKS = [
  { label: 'Sales Invoices', keywords: ['invoice', 'invoices', 'bill', 'billing'], icon: Receipt, pathByRole: { [ROLES.ADMIN]: '/admin/invoices', [ROLES.ACCOUNTANT]: '/accounts/invoices/sales' } },
  { label: 'Invoice Settings', keywords: ['invoice settings', 'invoice template', 'pdf template', 'branding'], icon: Settings, pathByRole: { [ROLES.ADMIN]: '/admin/invoices/settings' } },
  { label: 'Receivables', keywords: ['receivable', 'receivables', 'outstanding', 'due amount', 'overdue'], icon: IndianRupee, pathByRole: { [ROLES.ADMIN]: '/admin/receivables', [ROLES.ACCOUNTANT]: '/accounts/receivables' } },
  { label: 'Orders', keywords: ['order', 'orders', 'job', 'jobs', 'sales order'], icon: ShoppingCart, pathByRole: { [ROLES.ADMIN]: '/admin/orders', [ROLES.SALES_OFFICER]: '/sales/orders' } },
  { label: 'Quotations', keywords: ['quote', 'quotes', 'quotation', 'quotations'], icon: FileText, pathByRole: { [ROLES.ADMIN]: '/admin/quotations', [ROLES.SALES_OFFICER]: '/sales/quotations' } },
  { label: 'Customers', keywords: ['customer', 'customers', 'client', 'clients'], icon: Users, pathByRole: { [ROLES.ADMIN]: '/admin/customers', [ROLES.SALES_OFFICER]: '/sales/customers' } },
  { label: 'Leads', keywords: ['lead', 'leads'], icon: UserPlus, pathByRole: { [ROLES.ADMIN]: '/admin/leads', [ROLES.SALES_OFFICER]: '/sales/leads' } },
  { label: 'Products', keywords: ['product', 'products', 'inventory', 'stock'], icon: Package, pathByRole: { [ROLES.ADMIN]: '/admin/products' } },
  { label: 'Organizations', keywords: ['organization', 'organizations', 'tenant', 'tenants'], icon: Building2, pathByRole: { [ROLES.SUPER_ADMIN]: '/superadmin/organizations' } },
]

export default function UniversalSearch({ className = '', inputClassName = '', placeholder }) {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const { can } = usePermission()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [groups, setGroups] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const containerRef = useRef(null)
  const panelRef = useRef(null)
  const requestIdRef = useRef(0)
  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LENGTH
  const dropdownPosition = usePortalPosition(showDropdown, containerRef)

  const activeDomains = DOMAINS.filter((domain) => {
    const basePath = domain.basePathByRole[currentUser?.role]
    if (!basePath) return false
    return domain.module ? can(domain.module, 'view') : true
  })

  const matchingQuickLinks = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (term.length < MIN_QUERY_LENGTH) return []
    return QUICK_LINKS.filter((link) => {
      const path = link.pathByRole[currentUser?.role]
      if (!path) return false
      return link.label.toLowerCase().includes(term) || link.keywords.some((keyword) => keyword.includes(term))
    })
  }, [query, currentUser?.role])

  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_QUERY_LENGTH) {
      setGroups([])
      setIsLoading(false)
      setHasSearched(false)
      return undefined
    }

    const requestId = ++requestIdRef.current
    setIsLoading(true)

    const timer = setTimeout(async () => {
      const results = await Promise.all(
        activeDomains.map(async (domain) => {
          const result = await domain.search(term)
          if (!result.success) return { domain, items: [] }
          // Defensive cap - most list endpoints honor page_size server-side, but a couple of
          // demo-mode fallbacks (e.g. invoices) resolve locally and don't slice by it.
          return { domain, items: (domain.getItems(result) || []).slice(0, RESULTS_PER_DOMAIN) }
        }),
      )

      if (requestIdRef.current !== requestId) return // a newer keystroke superseded this request

      setGroups(results.filter((group) => group.items.length > 0))
      setIsLoading(false)
      setHasSearched(true)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, currentUser?.role])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleClickOutside = (event) => {
      const outsideContainer = !containerRef.current || !containerRef.current.contains(event.target)
      const outsidePanel = !panelRef.current || !panelRef.current.contains(event.target)
      if (outsideContainer && outsidePanel) setIsOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleSelect = (domain, row) => {
    const basePath = domain.basePathByRole[currentUser?.role]
    setIsOpen(false)
    setQuery('')
    navigate(`${basePath}/${domain.getId(row)}`)
  }

  const handleSelectQuickLink = (link) => {
    const path = link.pathByRole[currentUser?.role]
    setIsOpen(false)
    setQuery('')
    navigate(path)
  }

  const handleClear = () => {
    setQuery('')
    setGroups([])
    setHasSearched(false)
  }

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-fg-muted" />
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-surface-border bg-(--input-bg) py-2.5 pl-11 text-sm text-fg shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/10 ${
          query ? 'pr-9' : 'pr-4'
        } ${inputClassName}`}
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600"
        >
          <X className="size-3.5" />
        </button>
      )}

      {showDropdown &&
        dropdownPosition &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
            className="app-scrollbar z-50 max-h-104 overflow-y-auto rounded-2xl border border-surface-border bg-(--modal-bg) shadow-(--shadow-popover)"
          >
          {matchingQuickLinks.length > 0 && (
            <div className="border-b border-neutral-50 py-1.5">
              <p className="px-4 pb-1 pt-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-neutral-400">
                Go to
              </p>
              {matchingQuickLinks.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => handleSelectQuickLink(link)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-neutral-50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <link.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{link.label}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-neutral-300" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-neutral-400">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Searching...
            </div>
          ) : groups.length === 0 ? (
            matchingQuickLinks.length === 0 && (
              hasSearched ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-400">
                  No results for &ldquo;{query.trim()}&rdquo;
                </p>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-neutral-400">Keep typing to search...</p>
              )
            )
          ) : (
            groups.map(({ domain, items }) => (
              <div key={domain.key} className="border-b border-neutral-50 py-1.5 last:border-b-0">
                <p className="px-4 pb-1 pt-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-neutral-400">
                  {domain.label}
                </p>
                {items.map((row) => (
                  <button
                    key={domain.getId(row)}
                    type="button"
                    onClick={() => handleSelect(domain, row)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-neutral-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                      <domain.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">{domain.getTitle(row)}</span>
                      {domain.getSubtitle(row) && (
                        <span className="block truncate text-xs text-neutral-400">{domain.getSubtitle(row)}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
          </div>,
          document.body,
        )}
    </div>
  )
}
