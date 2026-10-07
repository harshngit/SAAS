import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Check, CheckCircle2, Clock, Copy, Download, Eye, Search, SlidersHorizontal, X, XCircle } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  approveOrganizationUpgrade,
  listSuperAdminOrganizations,
  rejectOrganizationUpgrade,
} from '../../api/superadmin'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'

const tabOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

const upgradeStatusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function StatTile({ label, value, detail, icon: Icon }) {
  return (
    <div className="min-h-32 border-neutral-100 px-5 py-4 lg:px-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-fg">{value}</p>
      <p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p>
    </div>
  )
}

function exportUpgradeRequestsCsv(rows) {
  const csvRows = [
    ['Organization', 'Current Plan', 'Requested Plan', 'Decision', 'Requested', 'Contact'],
    ...rows.map((organization) => [
      organization.name,
      organization.plan?.name || 'No plan',
      organization.requested_plan?.name || 'Requested plan',
      organization.upgrade_status || 'none',
      formatDate(organization.upgrade_requested_at),
      organization.email || '',
    ]),
  ]
  const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'upgrade-requests.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function UpgradeRequests() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pending')
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [actionError, setActionError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const loadRequests = async () => {
    setIsLoading(true)
    setListError('')

    const result = await listSuperAdminOrganizations({ upgrade_status: activeTab })

    setIsLoading(false)

    if (!result.success) {
      setListError(result.error)
      return
    }

    const organizations = activeTab
      ? result.organizations || []
      : (result.organizations || []).filter((organization) => organization.upgrade_status && organization.upgrade_status !== 'none')

    setRequests(organizations)
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleApprove = async (organization) => {
    setActionError('')
    setApprovingId(organization.id)
    const result = await approveOrganizationUpgrade(organization.id)
    setApprovingId(null)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    await loadRequests()
  }

  const openRejectModal = (organization) => {
    setRejectReason('')
    setRejectError('')
    setRejectTarget(organization)
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for the organization admin.')
      return
    }

    setRejectError('')
    setIsRejecting(true)
    const result = await rejectOrganizationUpgrade(rejectTarget.id, rejectReason.trim())
    setIsRejecting(false)

    if (!result.success) {
      setRejectError(result.error)
      return
    }

    setRejectTarget(null)
    await loadRequests()
  }

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const dateFilteredRequests = useMemo(
    () => requests.filter((organization) => isWithinDateRange(organization.upgrade_requested_at, dateFrom, dateTo)),
    [requests, dateFrom, dateTo],
  )

  const visibleRequests = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    if (!search) return dateFilteredRequests
    return dateFilteredRequests.filter((organization) =>
      [organization.name, organization.email, organization.plan?.name, organization.requested_plan?.name, organization.upgrade_status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    )
  }, [dateFilteredRequests, searchTerm])

  const requestSummary = useMemo(() => ({
    total: dateFilteredRequests.length,
    pending: dateFilteredRequests.filter((organization) => organization.upgrade_status === 'pending').length,
    approved: dateFilteredRequests.filter((organization) => organization.upgrade_status === 'approved').length,
    rejected: dateFilteredRequests.filter((organization) => organization.upgrade_status === 'rejected').length,
  }), [dateFilteredRequests])

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Upgrade Requests</h1>
                <p className="mt-1 text-xs text-neutral-400">{visibleRequests.length} requests in view</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative w-full sm:w-60">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search requests..."
                    className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => setIsFilterOpen((open) => !open)}>
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Filter
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportUpgradeRequestsCsv(visibleRequests)}>
                  <Download className="size-4" aria-hidden="true" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          <div className="-mx-5 -mb-5 mt-5 grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Total Requests', value: requestSummary.total, detail: 'all requests', icon: Copy },
              { label: 'Pending', value: requestSummary.pending, detail: 'awaiting review', icon: Clock },
              { label: 'Approved', value: requestSummary.approved, detail: 'accepted upgrades', icon: CheckCircle2 },
              { label: 'Rejected', value: requestSummary.rejected, detail: 'declined requests', icon: XCircle },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`border-neutral-100 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}
              >
                <StatTile {...stat} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onClick={() => setIsFilterOpen(false)}>
          <aside
            className="h-full w-full max-w-sm border-l border-surface-border bg-surface p-6 shadow-[0_24px_70px_-32px_rgb(15_23_42/0.6)]"
            onClick={(event) => event.stopPropagation()}
            aria-label="Upgrade request filters"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-(--font-display) text-lg font-semibold tracking-tight text-fg">Filters</h2>
                <p className="mt-1 text-sm text-fg-muted">Refine upgrade requests by decision status and requested date.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                aria-label="Close filters"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-fg">Status</label>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    {tabOptions.map((tab) => (
                      <TabsTrigger key={tab.value || 'all'} value={tab.value}>
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fg">Requested</label>
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
              <Button type="button" onClick={() => setIsFilterOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-surface px-0 py-0">
          {listError ? (
            <div className="py-8 text-center"><p className="text-sm text-red-600">{listError}</p></div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading upgrade requests..." />
          ) : visibleRequests.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No upgrade requests found</p>
              <p className="mt-1 text-sm text-neutral-500">Try changing the search, status, or date range.</p>
            </div>
          ) : (
            <table className="listing-table w-full min-w-[72rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-muted">
                  <th className="whitespace-nowrap px-6 py-6">Organization</th>
                  <th className="whitespace-nowrap px-6 py-6">Current Plan</th>
                  <th className="whitespace-nowrap px-6 py-6">Requested Plan</th>
                  <th className="whitespace-nowrap px-6 py-6">Requested</th>
                  <th className="whitespace-nowrap px-6 py-6">Contact</th>
                  <th className="whitespace-nowrap px-6 py-6">Status</th>
                  <th className="whitespace-nowrap px-6 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((organization) => (
                  <tr
                    key={organization.id}
                    onClick={() => navigate(`/superadmin/organizations/${organization.id}`)}
                    className="cursor-pointer bg-surface transition-colors hover:bg-primary-50/30"
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-neutral-900">{organization.name}</p>
                      <p className="mt-0.5 text-3xs text-neutral-400">{organization.id}</p>
                    </td>
                    <td className="px-6 py-5 text-neutral-600">{organization.plan?.name || 'No plan'}</td>
                    <td className="px-6 py-5 font-medium text-neutral-900">{organization.requested_plan?.name || 'Requested plan'}</td>
                    <td className="px-6 py-5 text-neutral-600">{formatDate(organization.upgrade_requested_at)}</td>
                    <td className="px-6 py-5 text-neutral-600">{organization.email || '-'}</td>
                    <td className="px-6 py-5">
                      <Badge variant={upgradeStatusVariant[organization.upgrade_status] || 'neutral'}>{organization.upgrade_status || 'none'}</Badge>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2.5" onClick={() => navigate(`/superadmin/organizations/${organization.id}`)}>
                          <Eye className="size-4" aria-hidden="true" />
                          View
                        </Button>
                        {organization.upgrade_status === 'pending' && (
                          <>
                            <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-2.5" onClick={() => openRejectModal(organization)} disabled={approvingId === organization.id}>
                              <X className="size-4" aria-hidden="true" />
                              Reject
                            </Button>
                            <Button type="button" size="sm" className="h-8 rounded-lg px-2.5" onClick={() => handleApprove(organization)} loading={approvingId === organization.id}>
                              <Check className="size-4" aria-hidden="true" />
                              Approve
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => {
          if (isRejecting) return
          setRejectTarget(null)
        }}
        title="Reject Upgrade Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Rejecting the upgrade request from <span className="font-semibold text-neutral-900">{rejectTarget?.name}</span>.
          </p>
          <Input
            label="Reason"
            as="textarea"
            placeholder="Explain why this upgrade request is being rejected..."
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            error={rejectError}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isRejecting} onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleReject} loading={isRejecting}>
              Reject Upgrade
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
