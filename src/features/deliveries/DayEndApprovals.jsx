import { ListDataTable as DataTable } from '../../components/ui/ListPresentation'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, CalendarCheck2, Eye, Search, Wallet, XCircle } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { resolveDateRange } from '../../utils/dateRange'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { useAuthStore } from '../../store/authStore'
import useSubmitLock from '../../hooks/useSubmitLock'
import { listDeliveryPartners } from '../../api/deliveries'
import { formatCurrency } from '../../utils/format'
import DayEndDetailDrawer from './DayEndDetailDrawer'
import {
  DAY_END_STATUS_FILTERS,
  DAY_END_STATUS_LABEL,
  DAY_END_STATUS_VARIANT,
  approveDayEnd,
  listDayEnds,
  rejectDayEnd,
} from '../../api/deliveryDayEnd'

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Admin "Day-End Approvals" - the submitted-session queue for the new Delivery Day-End
// workflow. Separate from Collection Reconciliation (per-transaction) and Cash Reconciliation
// (hidden from nav) - this reviews one daily session per delivery partner.
export default function DayEndApprovals() {
  const { showToast } = useToast()
  const { can, fullAccess } = usePermission()
  const currentUser = useAuthStore((state) => state.currentUser)
  // Day-End is a Deliveries-module feature in the backend (GET/approve/reject all answer 403 "view deliveries" without it); there is
  // no separate Day-End or delivery_collections permission. Reviewing a Day-End is Admin only in the backend ("Only an Admin can
  // review a Day-End", even for a role that holds deliveries:approve, e.g. Accountant), so Approve / Reject are shown to an Admin
  // (full access) only. Nobody approves their own day-end.
  const canReview = Boolean(fullAccess) && can('deliveries', 'approve')
  const canReviewRow = (row) => canReview && row.deliveryPartnerId !== currentUser?.id

  const [dayEnds, setDayEnds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [statusFilter, setStatusFilter] = useState('submitted')
  const [partnerFilter, setPartnerFilter] = useState('all')
  const [partners, setPartners] = useState([])
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  // The approval queue opens on "Submitted"; that is the default, so Clear Filters returns to it.
  const appliedFilters = { statusFilter, partnerFilter, datePreset, customFrom, customTo }
  const defaultFilters = { statusFilter: 'submitted', partnerFilter: 'all', datePreset: 'all', customFrom: '', customTo: '' }
  const applyFilters = (next) => {
    setStatusFilter(next.statusFilter)
    setPartnerFilter(next.partnerFilter)
    setDatePreset(next.datePreset)
    setCustomFrom(next.customFrom)
    setCustomTo(next.customTo)
  }
  const hasExtraFilters = partnerFilter !== 'all' || datePreset !== 'all'

  // Approval History: every approved (= closed) day-end, newest first, independent of the queue's status filter.
  const [history, setHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState('')

  const [detail, setDetail] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)
  // One request at a time however fast Approve / Reject is clicked; the lock is released on success, 4xx/5xx, network error and timeout.
  const { begin, end } = useSubmitLock(setIsActing)

  useEffect(() => {
    listDeliveryPartners().then((result) => {
      if (result.success) setPartners(result.partners)
    })
  }, [])

  // Status/partner/date are real backend filters - loaded server-side (page_size large enough
  // to cover a single admin's working set, same "fetch the filtered set in one page, then
  // search/sort client-side" pattern used by the other list pages in this app, e.g.
  // listSuperAdminOrganizations' page_size:100 convention).
  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    listDayEnds({
      status: statusFilter || undefined,
      deliveryPartnerId: partnerFilter !== 'all' ? partnerFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      pageSize: 100,
    }).then((result) => {
      setIsLoading(false)
      if (!result.success) {
        setDayEnds([])
        setLoadError(result.error)
        return
      }
      setDayEnds(result.dayEnds)
    })
  }, [statusFilter, partnerFilter, dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  const loadHistory = useCallback(() => {
    setIsLoadingHistory(true)
    setHistoryError('')
    listDayEnds({
      status: 'approved',
      deliveryPartnerId: partnerFilter !== 'all' ? partnerFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      pageSize: 100,
    }).then((result) => {
      setIsLoadingHistory(false)
      if (!result.success) {
        setHistory([])
        setHistoryError(result.error)
        return
      }
      setHistory([...result.dayEnds].sort((a, b) => String(b.reviewedAt || b.businessDate).localeCompare(String(a.reviewedAt || a.businessDate))))
    })
  }, [partnerFilter, dateFrom, dateTo])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const stats = useMemo(() => {
    const submitted = dayEnds.filter((d) => d.status === 'submitted')
    return {
      submittedCount: submitted.length,
      totalCollection: dayEnds.reduce((sum, d) => sum + d.handedOverTotal, 0),
      totalVariance: dayEnds.reduce((sum, d) => sum + d.varianceTotal, 0),
      approvedCount: dayEnds.filter((d) => d.status === 'approved').length,
    }
  }, [dayEnds])

  const partnerOptions = useMemo(
    () => [{ value: 'all', label: 'All partners' }, ...partners.map((p) => ({ value: p.id, label: p.name }))],
    [partners],
  )

  const rows = useMemo(
    () =>
      dayEnds.map((d) => ({
        ...d,
        _dateLabel: formatDate(d.businessDate),
      })),
    [dayEnds],
  )

  // Defensive: only replace the open detail if the mutation actually returned the updated
  // day-end object. If the backend ever responds to approve/reject without a body, the open
  // drawer just keeps its last-known state instead of crashing or going blank - load() below
  // still refreshes the list either way.
  const refreshDetailIfOpen = (updated) => {
    if (!updated?.id) return
    setDetail((current) => (current && current.id === updated.id ? updated : current))
  }

  const openApprove = (dayEnd) => {
    setActionError('')
    setApproveNote('')
    setApproveTarget(dayEnd)
  }
  const openReject = (dayEnd) => {
    setActionError('')
    setRejectReason('')
    setRejectTarget(dayEnd)
  }

  const runApprove = async () => {
    if (!begin()) return
    setActionError('')
    let result
    try {
      result = await approveDayEnd(approveTarget.id, approveNote.trim() || undefined)
    } finally {
      end()
    }
    if (!result.success) {
      setActionError(result.error)
      if (result.status === 403) showToast({ title: "You don't have permission", message: 'Only an Admin can approve a day-end.', variant: 'error' })
      return
    }
    showToast({ title: 'Day-end approved', message: `${approveTarget.deliveryPartnerName || 'Delivery partner'}'s ${approveTarget.businessDate} day-end was approved.` })
    setApproveTarget(null)
    refreshDetailIfOpen(result.dayEnd)
    load()
    loadHistory()
  }

  const runReject = async () => {
    if (!rejectReason.trim()) {
      setActionError('Enter a reason for rejecting this day-end.')
      return
    }
    if (!begin()) return
    setActionError('')
    let result
    try {
      result = await rejectDayEnd(rejectTarget.id, rejectReason.trim())
    } finally {
      end()
    }
    if (!result.success) {
      setActionError(result.error)
      if (result.status === 403) showToast({ title: "You don't have permission", message: 'Only an Admin can reject a day-end.', variant: 'error' })
      return
    }
    showToast({ title: 'Day-end rejected', message: `${rejectTarget.deliveryPartnerName || 'Delivery partner'} can correct and resubmit.` })
    setRejectTarget(null)
    refreshDetailIfOpen(result.dayEnd)
    load()
  }

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Day-End Approvals</h1>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Submitted', value: String(stats.submittedCount), detail: 'awaiting review', icon: CalendarCheck2 },
            { label: 'Total Collection', value: formatCurrency(stats.totalCollection), detail: 'handed over (filtered set)', icon: Wallet },
            { label: 'Total Variance', value: formatCurrency(stats.totalVariance), detail: 'expected vs handed over', icon: AlertTriangle },
            { label: 'Approved and Closed', value: String(stats.approvedCount), detail: 'in the filtered set', icon: BadgeCheck },
          ].map(({ label, value, detail: detailText, icon: Icon }) => (
            <div key={label} className="min-h-32 border-neutral-100 px-5 py-4 lg:border-r lg:px-6 lg:last:border-r-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-fg-muted">{label}</p>
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-fg-muted"><Icon className="size-4" aria-hidden="true" /></span>
              </div>
              <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-fg">{isLoading ? '—' : value}</p>
              <p className="mt-2 text-xs font-medium text-emerald-600">{detailText}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:m-5">
        {loadError && (
          <div className="m-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
            <Button type="button" variant="outline" size="sm" className="ml-3" onClick={load}>Retry</Button>
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner variant="table" columns={['Delivery Person', 'Date', 'Assigned', 'Delivered', 'Returned', 'Pending', 'Total Collection', 'Variance', 'Status']} label="Loading day-ends…" />
        ) : (
          <div className="hidden md:block">
            <DataTable
              resetKey={`${statusFilter}-${partnerFilter}-${datePreset}-${customFrom}-${customTo}`}
              renderToolbar={({ search, onSearchChange, resultCount }) => (
                <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight text-neutral-900">Day-Ends</h3>
                    <span className="text-xs text-neutral-400" aria-live="polite">{resultCount} {resultCount === 1 ? 'result' : 'results'}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="relative w-full sm:w-60">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                      <input type="search" value={search} onChange={onSearchChange} placeholder="Search by delivery partner..." aria-label="Search day-ends"
                        className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
                    </div>
                    <ListFilterPanel title="Filter Day-Ends" applied={appliedFilters} defaults={defaultFilters} onApply={applyFilters}>
                      {({ draft, set, errors }) => (
                        <>
                          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                            <Select options={DAY_END_STATUS_FILTERS} value={draft.statusFilter} onChange={(event) => set('statusFilter', event.target.value)} />
                          </label>
                          <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Delivery Partner
                            <Select searchable options={partnerOptions} value={draft.partnerFilter} onChange={(event) => set('partnerFilter', event.target.value)} />
                          </label>
                          <FilterDateRange label="Business Date" draft={draft} set={set} errors={errors} />
                        </>
                      )}
                    </ListFilterPanel>
                  </div>
                </div>
              )}
              columns={[
                { key: 'deliveryPartnerName', header: 'Delivery Person', sortable: true, render: (r) => r.deliveryPartnerName || '—' },
                { key: '_dateLabel', header: 'Date', sortable: true },
                { key: 'assigned', header: 'Assigned', align: 'right', render: (r) => r.deliveries.assigned },
                { key: 'delivered', header: 'Delivered', align: 'right', render: (r) => r.deliveries.delivered },
                { key: 'returned', header: 'Returned', align: 'right', render: (r) => r.deliveries.returned },
                { key: 'pending', header: 'Pending', align: 'right', render: (r) => r.deliveries.pending },
                { key: 'handedOverTotal', header: 'Total Collection', sortable: true, align: 'right', render: (r) => formatCurrency(r.handedOverTotal) },
                {
                  key: 'varianceTotal',
                  header: 'Variance',
                  sortable: true,
                  align: 'right',
                  render: (r) => (
                    <span className={r.varianceTotal < 0 ? 'text-red-600' : r.varianceTotal > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {r.varianceTotal === 0 ? '—' : formatCurrency(r.varianceTotal)}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (r) => <Badge variant={DAY_END_STATUS_VARIANT[r.status] || 'neutral'} dot>{DAY_END_STATUS_LABEL[r.status] || r.status}</Badge>,
                },
              ]}
              data={rows}
              searchKeys={['deliveryPartnerName']}
              searchPlaceholder="Search by delivery partner..."
              onRowClick={(row) => setDetail(row)}
              emptyTitle={
                statusFilter === 'submitted'
                  ? 'No day-ends waiting for review.'
                  : dayEnds.length === 0
                    ? 'No day-ends recorded yet.'
                    : 'No day-ends match these filters.'
              }
              actions={(row) => [
                { label: 'View Details', icon: Eye, onClick: () => setDetail(row) },
                ...(canReviewRow(row) && row.status === 'submitted'
                  ? [
                      { label: 'Approve', icon: BadgeCheck, onClick: () => openApprove(row) },
                      { label: 'Reject', icon: XCircle, danger: true, onClick: () => openReject(row) },
                    ]
                  : []),
              ]}
            />
          </div>
        )}

        {/* Mobile: cards */}
        {!isLoading && (
          <div className="space-y-3 px-5 pb-4 md:hidden">
            {rows.length === 0 ? (
              <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                {dayEnds.length === 0 ? 'No day-ends recorded yet.' : 'No day-ends match these filters.'}
              </p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setDetail(row)}
                  className="block w-full rounded-2xl border border-neutral-100 bg-surface p-4 text-left shadow-(--shadow-xs)"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{row.deliveryPartnerName || '—'}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{row._dateLabel}</p>
                    </div>
                    <Badge variant={DAY_END_STATUS_VARIANT[row.status] || 'neutral'} dot>{DAY_END_STATUS_LABEL[row.status] || row.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-neutral-900">{formatCurrency(row.handedOverTotal)}</span>
                    <span className={row.varianceTotal < 0 ? 'text-red-600' : row.varianceTotal > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {row.varianceTotal === 0 ? 'No variance' : formatCurrency(row.varianceTotal)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:m-5">
        {historyError && (
          <div className="m-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {historyError}
            <Button type="button" variant="outline" size="sm" className="ml-3" onClick={loadHistory}>Retry</Button>
          </div>
        )}
        {isLoadingHistory ? (
          <LoadingSpinner variant="table" columns={['Date', 'Delivery Person', 'Assigned', 'Delivered', 'Returned', 'Pending', 'Status', 'Approved By', 'Approved At']} label="Loading approval history…" />
        ) : (
          <DataTable
            resetKey={`${partnerFilter}-${datePreset}-${customFrom}-${customTo}`}
            title="Approval History"
            subtitle="Every day-end that was approved and closed."
            columns={[
              { key: '_dateLabel', header: 'Date', sortable: true },
              { key: 'deliveryPartnerName', header: 'Delivery Person', sortable: true, render: (r) => r.deliveryPartnerName || '—' },
              { key: 'assigned', header: 'Assigned', align: 'right', render: (r) => r.deliveries.assigned },
              { key: 'delivered', header: 'Delivered', align: 'right', render: (r) => r.deliveries.delivered },
              { key: 'returned', header: 'Returned', align: 'right', render: (r) => r.deliveries.returned },
              { key: 'pending', header: 'Pending', align: 'right', render: (r) => r.deliveries.pending },
              { key: 'status', header: 'Status', render: (r) => <Badge variant={DAY_END_STATUS_VARIANT[r.status] || 'neutral'} dot>{DAY_END_STATUS_LABEL[r.status] || r.status}</Badge> },
              { key: 'reviewedByName', header: 'Approved By', sortable: true, render: (r) => r.reviewedByName || '—' },
              { key: '_approvedAt', header: 'Approved At', sortable: true },
            ]}
            data={history.map((d) => ({ ...d, _dateLabel: formatDate(d.businessDate), _approvedAt: formatDateTime(d.reviewedAt) }))}
            searchKeys={['deliveryPartnerName', 'reviewedByName']}
            searchPlaceholder="Search by delivery partner or approver..."
            onRowClick={(row) => setDetail(row)}
            emptyTitle="No approved day-ends yet."
            emptyDescription="Approved and closed days will be listed here."
          />
        )}
      </Card>

      <DayEndDetailDrawer
        dayEnd={detail}
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        canReview={canReview && detail?.deliveryPartnerId !== currentUser?.id}
        busy={isActing}
        onApprove={openApprove}
        onReject={openReject}
      />

      <Modal
        isOpen={Boolean(approveTarget)}
        onClose={() => !isActing && setApproveTarget(null)}
        title="Approve day-end"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={runApprove}>Approve</Button>
          </>
        }
      >
        {approveTarget && (
          <div className="space-y-3 text-sm text-neutral-600">
            <p>
              Approve <span className="font-semibold text-neutral-900">{approveTarget.deliveryPartnerName}</span>&apos;s{' '}
              {approveTarget.businessDate} day-end — {formatCurrency(approveTarget.handedOverTotal)} handed over
              {approveTarget.varianceTotal !== 0 && <> ({formatCurrency(approveTarget.varianceTotal)} variance)</>}?
            </p>
            <p className="text-neutral-500">This is final — the amounts can no longer be edited once approved.</p>
            <Input label="Note (optional)" as="textarea" value={approveNote} onChange={(event) => setApproveNote(event.target.value)} />
            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => !isActing && setRejectTarget(null)}
        title="Reject day-end"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={runReject}>Reject</Button>
          </>
        }
      >
        {rejectTarget && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Reject <span className="font-semibold text-neutral-900">{rejectTarget.deliveryPartnerName}</span>&apos;s {rejectTarget.businessDate} day-end?
              They&apos;ll be able to correct the handed-over amounts / notes and resubmit.
            </p>
            <Input label="Reason" as="textarea" required value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Why is this day-end being rejected?" />
            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
