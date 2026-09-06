import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Search, Truck, CheckCircle2, PackageX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { usePermission } from '../../auth/usePermission'
import { PURCHASE_RETURNS_DEMO_ENABLED, getDemoPurchaseReturns } from './purchaseReturnDemoData'
import { PR_STATUS_FILTERS, PURCHASE_RETURN_BACKEND_LATER, prStatusMeta, totalReturnQty } from './purchaseReturnHelpers'

const basePath = '/admin/purchase-returns'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function PurchaseReturnList() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('purchases', 'create')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const returns = useMemo(() => (PURCHASE_RETURNS_DEMO_ENABLED ? getDemoPurchaseReturns() : []), [])

  const stats = useMemo(() => {
    const by = (key) => returns.filter((pr) => prStatusMeta(pr.status).key === key).length
    return {
      total: returns.length,
      draft: by('draft'),
      inProgress: by('confirmed') + by('dispatched'),
      completed: by('completed'),
    }
  }, [returns])

  const filtered = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return returns.filter((pr) => {
      const matchesStatus = statusFilter === 'all' || prStatusMeta(pr.status).key === statusFilter
      const matchesSearch =
        !search ||
        [pr.returnNumber, pr.supplierName, pr.purchaseNumber, pr.grnNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      return matchesStatus && matchesSearch
    })
  }, [returns, searchTerm, statusFilter])

  // Real mode: no backend Purchase Return module yet — a truthful future-state, never fake rows.
  if (!PURCHASE_RETURNS_DEMO_ENABLED) {
    return (
      <div className="space-y-5">
        <Card>
          <EmptyState
            icon={PackageX}
            title="Purchase Returns tracking isn't available yet"
            description="Returning received goods to a supplier will be available once the Purchase Return backend is enabled. Until then, the Purchases module records what was ordered and received."
          />
        </Card>
        <Card title="Needs backend support" subtitle="What a real Purchase Return module requires">
          <ul className="grid grid-cols-1 gap-1.5 text-sm text-neutral-600 sm:grid-cols-2">
            {PURCHASE_RETURN_BACKEND_LATER.map((entry) => (
              <li key={entry} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden="true" />
                {entry}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={RotateCcw} iconVariant="primary" label="Total Returns" value={String(stats.total)} />
        <StatCard icon={PackageX} iconVariant="neutral" label="Draft" value={String(stats.draft)} />
        <StatCard icon={Truck} iconVariant="warning" label="In Progress" value={String(stats.inProgress)} />
        <StatCard icon={CheckCircle2} iconVariant="success" label="Completed" value={String(stats.completed)} />
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search return #, supplier, purchase # or GRN #"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={PR_STATUS_FILTERS}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="sm:w-40"
                triggerClassName="h-9 bg-neutral-50 py-1.5"
              />
            </div>
            {canCreate && (
              <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}>
                <Plus className="size-4" aria-hidden="true" />
                New Return
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">
                {returns.length === 0 ? 'No purchase returns yet.' : 'No returns match these filters.'}
              </p>
              {returns.length === 0 && canCreate && (
                <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/new`)}>
                  <Plus className="size-4" aria-hidden="true" />
                  New Return
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Return</th>
                  <th className="whitespace-nowrap px-4 py-3">Supplier</th>
                  <th className="whitespace-nowrap px-4 py-3">Purchase / GRN</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Items</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Return Qty</th>
                  <th className="whitespace-nowrap px-4 py-3">Return Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pr) => {
                  const meta = prStatusMeta(pr.status)
                  return (
                    <tr
                      key={pr.id}
                      onClick={() => navigate(`${basePath}/${encodeURIComponent(pr.id)}`)}
                      className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                    >
                      <td className="px-4 py-3.5 font-semibold text-neutral-900">{pr.returnNumber}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{pr.supplierName || '—'}</td>
                      <td className="px-4 py-3.5 text-neutral-600">
                        {pr.purchaseNumber || '—'}
                        {pr.grnNumber ? <span className="text-neutral-400"> · {pr.grnNumber}</span> : ''}
                      </td>
                      <td className="px-4 py-3.5 text-right text-neutral-600">{pr.items.length}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-neutral-900">{totalReturnQty(pr)}</td>
                      <td className="px-4 py-3.5 text-neutral-600">{formatDate(pr.returnDate)}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-400">
          <span>{filtered.length === 0 ? '0' : `1 to ${filtered.length}`} of {returns.length}</span>
          <span>Purchase Returns · demo</span>
        </div>
      </Card>
    </div>
  )
}
