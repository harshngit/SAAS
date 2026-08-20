import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Plus, RotateCw, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { QUOTATION_STATUS_OPTIONS, deleteQuotation, listQuotations } from '../../api/quotations'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'danger',
  converted: 'purple',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function QuotationList() {
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales/quotations' : '/admin/quotations'
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadQuotations = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listQuotations()

    if (!result.success) {
      setQuotations([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setQuotations(result.quotations)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadQuotations()
  }, [loadQuotations])

  const filteredQuotations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return quotations.filter((quotation) => {
      const matchesSearch =
        !search ||
        [quotation.quotationNumber, quotation.customerName, quotation.salespersonName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [quotations, searchTerm, statusFilter])

  const handleDeleteQuotation = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteQuotation(deleteTarget.id)

    if (!result.success) {
      setDeleteError(result.error)
      setIsDeleting(false)
      return
    }

    setQuotations((current) => current.filter((quotation) => quotation.id !== deleteTarget.id))
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search quotations"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={[{ value: 'all', label: 'All status' }, ...QUOTATION_STATUS_OPTIONS]}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="sm:w-40"
                triggerClassName="h-9 bg-neutral-50 py-1.5"
              />
            </div>
            <Button type="button" size="sm" className="h-9 rounded-2xl px-3.5" onClick={() => navigate(`${basePath}/new`)}>
              <Plus className="size-4" aria-hidden="true" />
              New Quotation
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {listError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{listError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadQuotations}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <LoadingSpinner label="Loading quotations..." />
          ) : filteredQuotations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No quotations found</p>
              <p className="mt-1 text-sm text-neutral-500">Create a quotation estimate for a customer.</p>
              <Button type="button" className="mt-4" onClick={() => navigate(`${basePath}/new`)}>
                <Plus className="size-4" aria-hidden="true" />
                New Quotation
              </Button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Quotation</th>
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Salesperson</th>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Valid Until</th>
                  <th className="whitespace-nowrap px-4 py-3">Amount</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((quotation) => (
                  <tr
                    key={quotation.id}
                    onClick={() => navigate(`${basePath}/${encodeURIComponent(quotation.id)}`)}
                    className="cursor-pointer bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-neutral-900">{quotation.quotationNumber}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{quotation.itemCount} item(s)</p>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{quotation.customerName || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{quotation.salespersonName || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{formatDate(quotation.quotationDate)}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{formatDate(quotation.validUntil)}</td>
                    <td className="px-4 py-3.5 font-medium text-neutral-900">{formatCurrency(quotation.total)}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusVariant[quotation.status] || 'neutral'}>{quotation.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: 'View Details',
                            icon: Eye,
                            onClick: () => navigate(`${basePath}/${encodeURIComponent(quotation.id)}`),
                          },
                          ...(quotation.status !== 'converted'
                            ? [
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  danger: true,
                                  onClick: () => setDeleteTarget(quotation),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-400">
          <span>
            {filteredQuotations.length === 0 ? '0' : `1 to ${filteredQuotations.length}`} of {quotations.length}
          </span>
          <span>Quotations</span>
        </div>
      </Card>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
        title="Delete Quotation"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {deleteTarget?.quotationNumber || 'this quotation'}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
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
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDeleteQuotation}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
