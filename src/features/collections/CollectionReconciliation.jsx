import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, Ban, Eye, HandCoins, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
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
  // No dedicated `collections` permission module exists in the catalog - reconciling a
  // collection creates a customer payment, so payments:create is the honest gate. (BACKEND/
  // PERMISSION LATER: a dedicated collections:reconcile action.)
  const canReconcile = can('payments', 'create')

  const [collections, setCollections] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Collection Reconciliation</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Review driver collections before they are posted as customer payments.
        </p>
      </div>

      {unavailable ? (
        <Card>
          <div className="flex items-start gap-3 p-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Couldn&apos;t load collections</p>
              <p className="mt-1 text-sm text-neutral-500">
                The delivery collections service didn&apos;t respond. Please retry in a moment.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={HandCoins} iconVariant="warning" label="Recorded Collections" value={String(stats.recordedCount)} />
            <StatCard icon={Wallet} iconVariant="primary" label="Recorded Amount" value={formatCurrency(stats.recordedAmount)} />
            <StatCard icon={BadgeCheck} iconVariant="success" label="Reconciled Today" value={String(stats.reconciledToday)} />
            <StatCard icon={Ban} iconVariant="neutral" label="Voided" value={String(stats.voided)} />
          </div>

          <Card
            title="Collections"
            actions={
              <Select
                options={COLLECTION_STATUS_FILTERS}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-40"
                triggerClassName="bg-white"
              />
            }
          >
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
                <div className="space-y-3 md:hidden">
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
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canReconcile && isReconcilable(row) && (
                            <Button type="button" size="sm" onClick={() => { setActionError(''); setReconcileTarget(row) }}>
                              Reconcile
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => setDetail(row)}>
                            View Details
                          </Button>
                          {canReconcile && isVoidable(row) && (
                            <Button type="button" size="sm" variant="secondary" onClick={() => { setActionError(''); setVoidReason(''); setVoidTarget(row) }}>
                              Void
                            </Button>
                          )}
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
