import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  IndianRupee,
  Search,
  SlidersHorizontal,
  Timer,
  X,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ActionMenu from '../../components/ui/ActionMenu'
import { listSuperAdminOrganizations } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'

const statusVariant = {
  Active: 'success',
  Inactive: 'danger',
  Suspended: 'warning',
  Trial: 'info',
  Locked: 'warning',
  Unknown: 'neutral',
}

const upgradeStatusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'locked', label: 'Locked' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

const upgradeStatusFilterOptions = [
  { value: '', label: 'All upgrade requests' },
  { value: 'none', label: 'None' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function titleCase(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function normalizeOrganization(organization) {
  const status = organization.status ? titleCase(organization.status) : 'Unknown'
  return {
    id: organization.id,
    name: organization.name || 'Unnamed organization',
    adminName: organization.email || '-',
    plan: organization.plan?.name || 'No plan',
    mrr: Number(organization.plan?.price_monthly) || 0,
    status,
    email: organization.email || '-',
    phone: organization.phone || '-',
    businessType: organization.business_type || '-',
    upgradeStatus: organization.upgrade_status || 'none',
    createdAt: organization.created_at,
    createdAtLabel: formatDate(organization.created_at),
  }
}

function StatTile({ label, value, hint, icon: Icon }) {
  return (
    <div className="min-h-32 border-neutral-100 px-5 py-4 lg:px-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-fg">{value}</p>
      <p className="mt-2 text-xs font-medium text-emerald-600">{hint}</p>
    </div>
  )
}

function exportOrganizationsCsv(rows) {
  const headers = ['Organization', 'Admin Contact', 'Plan', 'MRR', 'Status', 'Upgrade Request', 'Created']
  const csvRows = rows.map((row) => [
    row.name,
    row.adminName,
    row.plan,
    row.mrr,
    row.status,
    row.upgradeStatus,
    row.createdAtLabel,
  ])
  const csv = [headers, ...csvRows]
    .map((values) => values.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'organizations.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function OrganizationsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [organizations, setOrganizations] = useState([])
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const statusFilter = searchParams.get('status') || ''
  const upgradeStatusFilter = searchParams.get('upgrade_status') || ''
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const setStatusFilter = (value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('status', value)
      else next.delete('status')
      return next
    })
  }

  const setUpgradeStatusFilter = (value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('upgrade_status', value)
      else next.delete('upgrade_status')
      return next
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadOrganizations() {
      setIsLoadingOrganizations(true)
      setListError('')

      const result = await listSuperAdminOrganizations({
        status: statusFilter,
        upgrade_status: upgradeStatusFilter,
      })

      if (!isMounted) return
      setIsLoadingOrganizations(false)

      if (!result.success) {
        setListError(result.error)
        return
      }

      setOrganizations((result.organizations || []).map(normalizeOrganization))
    }

    loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [statusFilter, upgradeStatusFilter])

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const dateFilteredOrganizations = useMemo(
    () => organizations.filter((organization) => isWithinDateRange(organization.createdAt, dateFrom, dateTo)),
    [organizations, dateFrom, dateTo],
  )

  const visibleOrganizations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return dateFilteredOrganizations
    return dateFilteredOrganizations.filter((organization) =>
      [organization.id, organization.name, organization.adminName, organization.plan, organization.status, organization.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [dateFilteredOrganizations, searchTerm])

  const totalPages = Math.max(1, Math.ceil(visibleOrganizations.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = visibleOrganizations.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1
  const pageEndIndex = Math.min(safeCurrentPage * rowsPerPage, visibleOrganizations.length)
  const paginatedOrganizations = useMemo(
    () => visibleOrganizations.slice((safeCurrentPage - 1) * rowsPerPage, safeCurrentPage * rowsPerPage),
    [visibleOrganizations, rowsPerPage, safeCurrentPage],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, upgradeStatusFilter, datePreset, customFrom, customTo, rowsPerPage])

  const stats = useMemo(
    () => ({
      total: dateFilteredOrganizations.length,
      active: dateFilteredOrganizations.filter((organization) => organization.status === 'Active').length,
      trial: dateFilteredOrganizations.filter((organization) => organization.status === 'Trial').length,
      mrr: dateFilteredOrganizations.reduce((total, organization) => total + organization.mrr, 0),
    }),
    [dateFilteredOrganizations],
  )

  const allVisibleSelected = visibleOrganizations.length > 0 && visibleOrganizations.every((organization) => selectedIds.includes(organization.id))

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleOrganizations.some((organization) => organization.id === id))
      return Array.from(new Set([...current, ...visibleOrganizations.map((organization) => organization.id)]))
    })
  }

  const toggleRow = (id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]))
  }

  const copyOrganizationId = async (id) => {
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = id
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Organizations</h1>
                <p className="mt-1 text-xs text-neutral-400">{visibleOrganizations.length} organizations in view</p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search organizations..."
                    className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
                <Button
              type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-3.5"
              onClick={() => setShowFilters((value) => !value)}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter
                </Button>
                <Button
              type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-3.5"
              onClick={() => exportOrganizationsCsv(visibleOrganizations)}
            >
              <Download className="size-4" aria-hidden="true" />
              Export
                </Button>
              </div>
            </div>
          </div>

          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Organizations', value: stats.total, hint: 'all organizations', icon: Copy },
              { label: 'Active', value: stats.active, hint: 'currently active', icon: CheckCircle2 },
              { label: 'Trial', value: stats.trial, hint: 'trial accounts', icon: Timer },
              { label: 'MRR Estimate', value: formatCurrency(stats.mrr), hint: 'current total', icon: IndianRupee },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''} border-neutral-100`}
              >
                <StatTile {...stat} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {showFilters && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onClick={() => setShowFilters(false)}>
          <aside
            className="h-full w-full max-w-sm border-l border-surface-border bg-surface p-6 shadow-[0_24px_70px_-32px_rgb(15_23_42/0.6)]"
            onClick={(event) => event.stopPropagation()}
            aria-label="Organization filters"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-(--font-display) text-lg font-semibold tracking-tight text-fg">Filters</h2>
                <p className="mt-1 text-sm text-fg-muted">Refine organizations by status, upgrade request, and created date.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                aria-label="Close filters"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <Select label="Status" options={statusFilterOptions} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />
              <Select
                label="Upgrade request"
                options={upgradeStatusFilterOptions}
                value={upgradeStatusFilter}
                onChange={(event) => setUpgradeStatusFilter(event.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fg">Created</label>
                <DateRangeFilter
                  preset={datePreset}
                  onPresetChange={setDatePreset}
                  customFrom={customFrom}
                  customTo={customTo}
                  onCustomChange={({ from, to }) => {
                    setCustomFrom(from)
                    setCustomTo(to)
                  }}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button type="button" onClick={() => setShowFilters(false)}>
                Apply Filters
              </Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-surface px-0 py-0">
          {isLoadingOrganizations ? (
            <LoadingSpinner label="Loading organizations..." />
          ) : listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
            </div>
          ) : visibleOrganizations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No organizations found</p>
              <p className="mt-1 text-sm text-neutral-500">Try changing the search or filters.</p>
            </div>
          ) : (
          <table className="listing-table w-full min-w-[72rem] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-muted">
                <th className="w-14 px-6 py-6">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    aria-label="Select all organizations"
                  />
                </th>
                <th className="whitespace-nowrap px-6 py-6">Organization</th>
                <th className="whitespace-nowrap px-6 py-6">Admin Contact</th>
                <th className="whitespace-nowrap px-6 py-6">Plan</th>
                <th className="whitespace-nowrap px-6 py-6">MRR</th>
                <th className="whitespace-nowrap px-6 py-6">Status</th>
                <th className="whitespace-nowrap px-6 py-6">Upgrade</th>
                <th className="whitespace-nowrap px-6 py-6">Created</th>
                <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrganizations.map((organization) => (
                  <tr
                    key={organization.id}
                    onClick={() => navigate(`/superadmin/organizations/${organization.id}`)}
                    className="cursor-pointer bg-surface transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5 align-middle" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(organization.id)}
                        onChange={() => toggleRow(organization.id)}
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select ${organization.name}`}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-neutral-900">{organization.name}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{organization.id}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="max-w-[16rem]">
                        <p className="truncate text-neutral-800">{organization.adminName}</p>
                        <span className="mt-0.5 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[0.62rem] font-medium text-neutral-500">
                          Admin
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{organization.plan}</td>
                    <td className="px-6 py-5 font-medium text-neutral-900">{formatCurrency(organization.mrr)}</td>
                    <td className="px-6 py-5">
                      <Badge variant={statusVariant[organization.status] || 'neutral'} dot>{organization.status}</Badge>
                    </td>
                    <td className="px-6 py-5">
                      {organization.upgradeStatus && organization.upgradeStatus !== 'none' ? (
                        <Badge variant={upgradeStatusVariant[organization.upgradeStatus] || 'neutral'}>{titleCase(organization.upgradeStatus)}</Badge>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{organization.createdAtLabel}</td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/superadmin/organizations/${organization.id}`)}
                          className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-neutral-100 hover:text-slate-950"
                          aria-label={`View ${organization.name}`}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                        </button>
                        <ActionMenu
                          triggerClassName="size-9 text-slate-400 hover:text-slate-700"
                          items={[
                            {
                              label: 'View details',
                              icon: Eye,
                              onClick: () => navigate(`/superadmin/organizations/${organization.id}`),
                            },
                            {
                              label: 'Copy ID',
                              icon: Copy,
                              onClick: () => copyOrganizationId(organization.id),
                            },
                            {
                              label: 'Export row',
                              icon: Download,
                              onClick: () => exportOrganizationsCsv([organization]),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          )}
        </div>
        {!isLoadingOrganizations && !listError && visibleOrganizations.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-surface-border px-6 py-4 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Showing <span className="font-semibold text-fg">{pageStartIndex}-{pageEndIndex}</span> of{' '}
                <span className="font-semibold text-fg">{visibleOrganizations.length}</span>
              </span>
              <span className="hidden h-4 w-px bg-surface-border sm:block" aria-hidden="true" />
              <label className="flex items-center gap-3">
                <span>Rows per page</span>
                <span className="relative">
                  <select
                    value={rowsPerPage}
                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                    className="h-10 appearance-none rounded-full border border-surface-border bg-surface py-0 pl-5 pr-10 text-sm font-medium text-fg shadow-(--shadow-xs) outline-none transition-all focus:border-primary-400 focus:ring-4 focus:ring-primary-500/12"
                  >
                    {[10, 25, 50].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
                </span>
              </label>
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="flex size-10 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <span className="font-semibold text-fg">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="flex size-10 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Next page"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
