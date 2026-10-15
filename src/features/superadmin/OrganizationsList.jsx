import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  IndianRupee,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ActionMenu from '../../components/ui/ActionMenu'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { deleteOrganization, listSuperAdminOrganizations } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { exportRowsToExcel } from '../../utils/exportToExcel'

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

const ROWS_PER_PAGE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
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

function exportOrganizations(rows) {
  const headers = ['Organization', 'Admin Contact', 'Plan', 'MRR', 'Status', 'Upgrade Request', 'Created']
  const dataRows = rows.map((row) => [
    row.name,
    row.adminName,
    row.plan,
    row.mrr,
    row.status,
    row.upgradeStatus,
    row.createdAtLabel,
  ])
  exportRowsToExcel('organizations', [headers, ...dataRows])
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
  // Plan/Business Type have no backend query param (confirmed against the live API - only
  // status/upgrade_status/search/page/page_size are real filters on GET /superadmin/organizations),
  // so these two are applied client-side over the already-fully-loaded page, same approach the
  // Created date filter already uses below.
  const [planFilter, setPlanFilter] = useState('')
  const [businessTypeFilter, setBusinessTypeFilter] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // The Filters drawer is a STAGE - nothing above takes effect until "Apply Filters" commits it.
  // Previously every Select applied instantly while the Apply button did nothing, which is the
  // inconsistency that made the panel feel broken: it visibly offers a staged "configure, then
  // Apply" flow but didn't behave like one.
  const [draftStatus, setDraftStatus] = useState(statusFilter)
  const [draftUpgradeStatus, setDraftUpgradeStatus] = useState(upgradeStatusFilter)
  const [draftPlan, setDraftPlan] = useState(planFilter)
  const [draftBusinessType, setDraftBusinessType] = useState(businessTypeFilter)
  const [draftDatePreset, setDraftDatePreset] = useState(datePreset)
  const [draftCustomFrom, setDraftCustomFrom] = useState(customFrom)
  const [draftCustomTo, setDraftCustomTo] = useState(customTo)

  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const { sortBy, sortOrder, toggleSort, sortParams } = useSortState()

  const handleSort = (field) => {
    toggleSort(field)
    setCurrentPage(1)
  }

  // Single-row delete (reuses the same DELETE /superadmin/organizations/{id} OrganizationDetail.jsx
  // already calls) and bulk delete (no bulk-delete endpoint exists - this loops the same real
  // single-delete call per selected row and reports partial failures honestly rather than
  // pretending a bulk endpoint exists).
  const [deleteTarget, setDeleteTarget] = useState(null) // { ids: string[], names: string[] }
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  const openFilters = () => {
    // Re-seed the drafts from the currently ACTIVE filters every time the drawer opens, so
    // reopening it never shows a stale in-progress edit from a previous open-then-close-without-
    // applying.
    setDraftStatus(statusFilter)
    setDraftUpgradeStatus(upgradeStatusFilter)
    setDraftPlan(planFilter)
    setDraftBusinessType(businessTypeFilter)
    setDraftDatePreset(datePreset)
    setDraftCustomFrom(customFrom)
    setDraftCustomTo(customTo)
    setShowFilters(true)
  }

  const applyFilters = () => {
    setStatusFilter(draftStatus)
    setUpgradeStatusFilter(draftUpgradeStatus)
    setPlanFilter(draftPlan)
    setBusinessTypeFilter(draftBusinessType)
    setDatePreset(draftDatePreset)
    setCustomFrom(draftCustomFrom)
    setCustomTo(draftCustomTo)
    setShowFilters(false)
  }

  const resetFilters = () => {
    setDraftStatus('')
    setDraftUpgradeStatus('')
    setDraftPlan('')
    setDraftBusinessType('')
    setDraftDatePreset('all')
    setDraftCustomFrom('')
    setDraftCustomTo('')
  }

  const activeFilterCount = [statusFilter, upgradeStatusFilter, planFilter, businessTypeFilter, datePreset !== 'all' ? datePreset : ''].filter(Boolean).length

  useEffect(() => {
    let isMounted = true

    async function loadOrganizations() {
      setIsLoadingOrganizations(true)
      setListError('')

      const result = await listSuperAdminOrganizations({
        status: statusFilter,
        upgrade_status: upgradeStatusFilter,
        ...sortParams,
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
  }, [statusFilter, upgradeStatusFilter, sortParams])

  // Options are derived from whatever is actually loaded - never a guessed/hardcoded list - so a
  // plan or business type that doesn't currently exist on any organization never appears as a
  // dead filter option.
  const planOptions = useMemo(() => {
    const distinct = Array.from(new Set(organizations.map((organization) => organization.plan).filter((plan) => plan && plan !== 'No plan')))
    distinct.sort((a, b) => a.localeCompare(b))
    return [{ value: '', label: 'All plans' }, { value: 'No plan', label: 'No plan' }, ...distinct.map((plan) => ({ value: plan, label: plan }))]
  }, [organizations])

  const businessTypeOptions = useMemo(() => {
    const distinct = Array.from(new Set(organizations.map((organization) => organization.businessType).filter((type) => type && type !== '-')))
    distinct.sort((a, b) => a.localeCompare(b))
    return [{ value: '', label: 'All business types' }, ...distinct.map((type) => ({ value: type, label: type }))]
  }, [organizations])

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const dateFilteredOrganizations = useMemo(
    () =>
      organizations
        .filter((organization) => isWithinDateRange(organization.createdAt, dateFrom, dateTo))
        .filter((organization) => !planFilter || organization.plan === planFilter)
        .filter((organization) => !businessTypeFilter || organization.businessType === businessTypeFilter),
    [organizations, dateFrom, dateTo, planFilter, businessTypeFilter],
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
  }, [searchTerm, statusFilter, upgradeStatusFilter, planFilter, businessTypeFilter, datePreset, customFrom, customTo, rowsPerPage])

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

  const openDeleteConfirm = (rows) => {
    setDeleteError('')
    setDeleteTarget({ ids: rows.map((row) => row.id), names: rows.map((row) => row.name) })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const results = await Promise.all(deleteTarget.ids.map((id) => deleteOrganization(id)))
    const failedIndexes = results.map((result, index) => (result.success ? null : index)).filter((index) => index !== null)
    const deletedIds = deleteTarget.ids.filter((_, index) => !failedIndexes.includes(index))

    setIsDeleting(false)

    if (deletedIds.length > 0) {
      setOrganizations((current) => current.filter((organization) => !deletedIds.includes(organization.id)))
      setSelectedIds((current) => current.filter((id) => !deletedIds.includes(id)))
    }

    if (failedIndexes.length > 0) {
      const failedNames = failedIndexes.map((index) => deleteTarget.names[index])
      const firstError = results.find((result) => !result.success)?.error
      setDeleteError(
        deletedIds.length > 0
          ? `Deleted ${deletedIds.length} of ${deleteTarget.ids.length}. Could not delete ${failedNames.join(', ')}: ${firstError}`
          : `Could not delete ${failedNames.join(', ')}: ${firstError}`,
      )
      // Keep the modal open so the failure (and which orgs are still pending) stays visible.
      setDeleteTarget((current) => (current ? { ids: deleteTarget.ids.filter((_, index) => failedIndexes.includes(index)), names: failedNames } : current))
      return
    }

    setDeleteTarget(null)
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
              onClick={openFilters}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
                <Button
              type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl px-3.5"
              onClick={() => exportOrganizations(visibleOrganizations)}
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
            className="flex h-full w-full max-w-sm flex-col border-l border-surface-border bg-surface shadow-[0_24px_70px_-32px_rgb(15_23_42/0.6)]"
            onClick={(event) => event.stopPropagation()}
            aria-label="Organization filters"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border p-6">
              <div>
                <h2 className="font-(--font-display) text-lg font-semibold tracking-tight text-fg">Filters</h2>
                <p className="mt-1 text-sm text-fg-muted">Refine organizations by status, upgrade request, plan, business type and created date.</p>
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

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <Select label="Status" options={statusFilterOptions} value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} />
              <Select
                label="Upgrade request"
                options={upgradeStatusFilterOptions}
                value={draftUpgradeStatus}
                onChange={(event) => setDraftUpgradeStatus(event.target.value)}
              />
              <Select label="Plan" options={planOptions} value={draftPlan} onChange={(event) => setDraftPlan(event.target.value)} searchable />
              <Select
                label="Business type"
                options={businessTypeOptions}
                value={draftBusinessType}
                onChange={(event) => setDraftBusinessType(event.target.value)}
                searchable
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fg">Created</label>
                <DateRangeFilter
                  preset={draftDatePreset}
                  onPresetChange={setDraftDatePreset}
                  customFrom={draftCustomFrom}
                  customTo={draftCustomTo}
                  onCustomChange={({ from, to }) => {
                    setDraftCustomFrom(from)
                    setDraftCustomTo(to)
                  }}
                />
              </div>
            </div>

            <div className="flex shrink-0 justify-between gap-3 border-t border-surface-border p-6">
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Reset
              </Button>
              <Button type="button" onClick={applyFilters}>
                Apply Filters
              </Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-5 py-3">
          <p className="text-sm font-medium text-primary-900">{selectedIds.length} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportOrganizations(organizations.filter((organization) => selectedIds.includes(organization.id)))}
            >
              <Download className="size-4" aria-hidden="true" />
              Export Selected
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => openDeleteConfirm(organizations.filter((organization) => selectedIds.includes(organization.id)))}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete Selected
            </Button>
            <button type="button" onClick={() => setSelectedIds([])} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
              Clear
            </button>
          </div>
        </div>
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
              <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                <th className="w-14 px-6 py-6">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    aria-label="Select all organizations"
                  />
                </th>
                <SortableHeaderCell label="Organization" sortKey="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                <SortableHeaderCell label="Admin Contact" sortKey="email" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                <th className="whitespace-nowrap px-6 py-6">Plan</th>
                <th className="whitespace-nowrap px-6 py-6">MRR</th>
                <SortableHeaderCell label="Status" sortKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                <SortableHeaderCell label="Upgrade" sortKey="upgrade_status" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
                <SortableHeaderCell label="Created" sortKey="created_at" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-6 py-6" />
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
                      <p className="mt-0.5 text-3xs text-neutral-400">{organization.id}</p>
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
                              onClick: () => exportOrganizations([organization]),
                            },
                            {
                              label: 'Delete',
                              icon: Trash2,
                              danger: true,
                              onClick: () => openDeleteConfirm([organization]),
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
                <Select
                  options={ROWS_PER_PAGE_OPTIONS}
                  value={String(rowsPerPage)}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  triggerClassName="h-8 bg-surface py-1 text-xs"
                  className="w-20"
                />
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

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title={deleteTarget && deleteTarget.ids.length > 1 ? `Delete ${deleteTarget.ids.length} Organizations` : 'Delete Organization'}
      >
        <div className="space-y-5">
          {deleteTarget && deleteTarget.ids.length > 1 ? (
            <>
              <p className="text-sm leading-6 text-neutral-600">
                This permanently removes all users, customers, products, and data for the following{' '}
                <span className="font-semibold text-neutral-900">{deleteTarget.ids.length} organizations</span>. This cannot be undone.
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                {deleteTarget.names.map((name, index) => (
                  <li key={deleteTarget.ids[index] || name} className="flex items-center gap-2 text-sm text-neutral-700">
                    <span className="size-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden="true" />
                    <span className="truncate">{name}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm leading-6 text-neutral-600">
              Delete <span className="font-semibold text-neutral-900">{deleteTarget?.names?.[0] || 'this organization'}</span>? This
              permanently removes all of its users, customers, products, and data. This cannot be undone.
            </p>
          )}
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('')
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
