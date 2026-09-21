import ListFilterPanel from '../../components/ui/ListFilterPanel'
import { ListDataTable as DataTable } from '../../components/ui/ListPresentation'
import { createPortal } from 'react-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, Ban, Eye, HandCoins, Search, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { listCollections, reconcileCollection, voidCollection } from '../../api/deliveryCollections'
import { formatCurrency } from '../../utils/format'
import CollectionDetailDrawer from './CollectionDetailDrawer'
import {
  COLLECTION_STATUS_FILTERS,
  COLLECTION_STATUS_VARIANT,
  formatPaymentMode,
  formatStatus,
  isReconcilable,
  isSameDay,
  isVoidable,
} from './collectionHelpers'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CollectionReconciliation() {
  const { showToast } = useToast()
  const { can } = usePermission()
  // Canonical backend permission module: `delivery_collections`. Reconcile + Void both post to
  // the collection lifecycle endpoints, so both are gated on the `approve` action.
  const canReconcile = can('delivery_collections', 'approve')

  const [collections, setCollections] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchHost, setSearchHost] = useState(null)

  const [detail, setDetail] = useState(null)
  const [reconcileTarget, setReconcileTarget] = useState(null)
  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    setLoadError('')
    listCollections().then((result) => {
      if (!result.success) {
        setCollections([])
        setLoadError(result.error)
        setUnavailable(/did not respond \(404\)/i.test(result.error || ''))
      } else {
        setUnavailable(false)
        setCollections(result.collections)
      }
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const recorded = collections.filter((c) => c.status === 'recorded')
    return {
      recordedCount: recorded.length,
      recordedAmount: recorded.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
      reconciledToday: collections.filter((c) => c.status === 'reconciled' && isSameDay(c.reconciledAt)).length,
      voided: collections.filter((c) => c.status === 'voided').length,
    }
  }, [collections])

  const rows = useMemo(() => {
    const base = statusFilter === 'all' ? collections : collections.filter((c) => c.status === statusFilter)
    return base.map((c) => ({
      ...c,
      _amount: Number(c.amount) || 0,
      _recordedAtLabel: formatDateTime(c.recordedAt),
      _modeLabel: formatPaymentMode(c.paymentMode),
    }))
  }, [collections, statusFilter])

  const runReconcile = async (collection) => {
    if (isActing) return
    setIsActing(true)
    setActionError('')
    const result = await reconcileCollection(collection.id)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    showToast({
      title: 'Collection reconciled',
      message: result.collection?.customerPaymentNumber
        ? `Customer payment ${result.collection.customerPaymentNumber} created.`
        : 'A customer payment was created by the backend.',
    })
    setReconcileTarget(null)
    setDetail(null)
    load()
  }

  const runVoid = async () => {
    if (isActing) return
    setIsActing(true)
    setActionError('')
    const result = await voidCollection(voidTarget.id, voidReason.trim() || undefined)
    setIsActing(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    showToast({ title: 'Collection voided', message: `${voidTarget.collectionNumber} was voided.` })
    setVoidTarget(null)
    setVoidReason('')
    setDetail(null)
    load()
  }

  const rowActions = (row) => {
    const items = [{ label: 'View Details', icon: Eye, onClick: () => setDetail(row) }]
    if (canReconcile && isReconcilable(row)) {
      items.unshift({ label: 'Reconcile', icon: BadgeCheck, onClick: () => { setActionError(''); setReconcileTarget(row) } })
    }
    if (canReconcile && isVoidable(row)) {
      items.push({ label: 'Void', icon: Ban, danger: true, onClick: () => { setActionError(''); setVoidReason(''); setVoidTarget(row) } })
    }
    return items
  }

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Collection Reconciliation</h1>
              <p className="mt-1 text-xs text-neutral-400">Review driver collections before they are posted as customer payments.</p>
            </div>
            {!unavailable && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div ref={setSearchHost} className={isLoading ? 'hidden' : 'hidden w-60 md:block'} />
                <ListFilterPanel title="Filter Collections">
                  <Select label="Status" options={COLLECTION_STATUS_FILTERS} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full" triggerClassName="h-9 rounded-xl bg-white py-1.5 text-xs" />
                </ListFilterPanel>
              </div>
            )}
          </div>
        </div>
        {!unavailable && (
          <div className="grid grid-cols-2 border-t border-neutral-100 lg:grid-cols-4">
            {[
              { label: 'Recorded Collections', value: String(stats.recordedCount), detail: 'awaiting reconciliation', icon: HandCoins },
              { label: 'Recorded Amount', value: formatCurrency(stats.recordedAmount), detail: 'amount awaiting reconciliation', icon: Wallet },
              { label: 'Reconciled Today', value: String(stats.reconciledToday), detail: 'collections reconciled today', icon: BadgeCheck },
              { label: 'Voided', value: String(stats.voided), detail: 'voided collections', icon: Ban },
            ].map(({ label, value, detail, icon: Icon }, index) => (
              <div key={label} className={`min-h-32 border-neutral-100 px-5 py-4 lg:px-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b lg:border-b-0' : ''} ${index < 3 ? 'lg:border-r' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium text-[#6b86ad]">{label}</p>
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f7fb] text-[#55749f]"><Icon className="size-4" aria-hidden="true" /></span>
                </div>
                <p className="mt-4 font-(--font-display) text-[2rem] font-semibold leading-none tracking-tight text-[#082445]">{value}</p>
                <p className="mt-2 text-xs font-medium text-emerald-600">{detail}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {unavailable ? (
        <Card>
          <div className="flex items-start gap-3 p-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Couldn&apos;t load collections</p>
              <p className="mt-1 text-xs text-neutral-400">
                The delivery collections service didn&apos;t respond. Please retry in a moment.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0" bodyClassName="[&>div.mb-4]:m-5">
            <div className={isLoading ? 'px-5 py-4' : 'px-5 py-4 md:hidden'}>
              <h3 className="text-base font-semibold tracking-tight text-neutral-900">Collections</h3>
            </div>
            {loadError && !unavailable && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
            )}

            {isLoading ? (
              <LoadingSpinner label="Loading collections…" />
            ) : (
              <>
                {/* Desktop / tablet: compact table */}
                <div className="hidden md:block">
                  <DataTable
                    renderToolbar={({ search, onSearchChange, resultCount }) => (
                      <>
                        <div className="flex items-center gap-2 px-5 py-3">
                          <h3 className="text-base font-semibold tracking-tight text-neutral-900">Collections</h3>
                          <span className="text-xs text-neutral-400" aria-live="polite">{resultCount} {resultCount === 1 ? 'result' : 'results'}</span>
                        </div>
                        {searchHost && createPortal(
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                            <input type="search" value={search} onChange={onSearchChange} placeholder="Search collections..." aria-label="Search collections"
                              className="h-9 w-full rounded-xl border border-neutral-100 bg-white py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12" />
                          </div>, searchHost,
                        )}
                      </>
                    )}
                    columns={[
                      { key: 'collectionNumber', header: 'Collection #', sortable: true },
                      { key: 'deliveryNumber', header: 'Delivery #', sortable: true, render: (r) => r.deliveryNumber || '—' },
                      { key: 'orderNumber', header: 'Order #', sortable: true, render: (r) => r.orderNumber || '—' },
                      { key: 'customerName', header: 'Customer', sortable: true, render: (r) => r.customerName || '—' },
                      { key: 'deliveryPartnerName', header: 'Delivery Partner', render: (r) => r.deliveryPartnerName || '—' },
                      { key: '_amount', header: 'Amount', sortable: true, align: 'right', render: (r) => formatCurrency(r._amount) },
                      { key: '_modeLabel', header: 'Payment Mode' },
                      { key: '_recordedAtLabel', header: 'Recorded At', sortable: true },
                      {
                        key: 'status',
                        header: 'Status',
                        sortable: true,
                        render: (r) => (
                          <Badge variant={COLLECTION_STATUS_VARIANT[r.status] || 'neutral'} dot>{formatStatus(r)}</Badge>
                        ),
                      },
                    ]}
                    data={rows}
                    searchKeys={['collectionNumber', 'deliveryNumber', 'orderNumber', 'customerName', 'reference']}
                    searchPlaceholder="Search collections..."
                    onRowClick={(row) => setDetail(row)}
                    emptyTitle={
                      statusFilter === 'recorded'
                        ? 'No collections waiting for reconciliation.'
                        : statusFilter === 'reconciled'
                          ? 'No reconciled collections yet.'
                          : statusFilter === 'voided'
                            ? 'No voided collections.'
                            : collections.length === 0
                              ? 'No collections recorded yet.'
                              : 'No collections match these filters.'
                    }
                    actions={rowActions}
                  />
                </div>

                {/* Mobile: cards, same actions */}
                <div className="space-y-3 px-5 pb-4 md:hidden">
                  {rows.length === 0 ? (
                    <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                      {collections.length === 0 ? 'No collections recorded yet.' : 'No collections match these filters.'}
                    </p>
                  ) : (
                    rows.map((row) => (
                      <div key={row.id} className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-xs)">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900">{row.customerName || '—'}</p>
                            <p className="mt-0.5 text-xs text-neutral-400">
                              {row.collectionNumber} · {row.deliveryNumber || '—'}
                            </p>
                          </div>
                          <Badge variant={COLLECTION_STATUS_VARIANT[row.status] || 'neutral'} dot>{formatStatus(row)}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="font-semibold text-neutral-900">{formatCurrency(row._amount)}</span>
                          <span className="text-neutral-500">{row._modeLabel}</span>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <ActionMenu items={[
                            ...(canReconcile && isReconcilable(row) ? [{ label: 'Reconcile', icon: BadgeCheck, onClick: () => { setActionError(''); setReconcileTarget(row) } }] : []),
                            { label: 'View Details', icon: Eye, onClick: () => setDetail(row) },
                            ...(canReconcile && isVoidable(row) ? [{ label: 'Void', icon: Ban, danger: true, onClick: () => { setActionError(''); setVoidReason(''); setVoidTarget(row) } }] : []),
                          ]} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <CollectionDetailDrawer
        collection={detail}
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        canReconcile={canReconcile}
        busy={isActing}
        onReconcile={(c) => { setActionError(''); setReconcileTarget(c) }}
        onVoid={(c) => { setActionError(''); setVoidReason(''); setVoidTarget(c) }}
      />

      <Modal
        isOpen={Boolean(reconcileTarget)}
        onClose={() => !isActing && setReconcileTarget(null)}
        title="Reconcile collection"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setReconcileTarget(null)}>Cancel</Button>
            <Button type="button" loading={isActing} onClick={() => runReconcile(reconcileTarget)}>Reconcile</Button>
          </>
        }
      >
        {reconcileTarget && (
          <div className="space-y-3 text-sm text-neutral-600">
            <p>
              Reconcile <span className="font-semibold text-neutral-900">{reconcileTarget.collectionNumber}</span> —{' '}
              {formatCurrency(reconcileTarget.amount)} from {reconcileTarget.customerName || 'this customer'}?
            </p>
            <p className="text-neutral-500">
              The backend creates exactly one customer payment and updates the customer / invoice balance. This can&apos;t be undone here.
            </p>
            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(voidTarget)}
        onClose={() => !isActing && setVoidTarget(null)}
        title="Void collection"
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isActing} onClick={() => setVoidTarget(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={runVoid}>Void Collection</Button>
          </>
        }
      >
        {voidTarget && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Void <span className="font-semibold text-neutral-900">{voidTarget.collectionNumber}</span> ({formatCurrency(voidTarget.amount)})?
              Only a collection that has not been reconciled can be voided.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Reason</label>
              <textarea
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                maxLength={300}
                className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                placeholder="Why is this collection being voided?"
              />
            </div>
            {actionError && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
