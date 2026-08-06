import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Select from '../../components/ui/Select'
import { quotations as seedQuotations } from '../../mockData/quotations'
import { formatCurrency } from '../../utils/format'
import { readStoredQuotations } from './quotationStorage'

const statusOptions = [
  { value: 'all', label: 'All status' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Expired', label: 'Expired' },
]

const statusVariant = {
  Draft: 'neutral',
  Sent: 'info',
  Accepted: 'success',
  Expired: 'danger',
}

function lineTotal(item) {
  const quantity = Number(item.quantity) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const discount = Number(item.discount) || 0
  const tax = Number(item.tax) || 0
  const subtotal = quantity * unitPrice
  const discounted = subtotal - subtotal * (discount / 100)
  return discounted + discounted * (tax / 100)
}

function quotationTotal(quotation) {
  return (quotation.items || []).reduce((total, item) => total + lineTotal(item), 0)
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default function QuotationList() {
  const navigate = useNavigate()
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales/quotations' : '/admin/quotations'
  const [quotations] = useState(() => [...readStoredQuotations(), ...seedQuotations])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredQuotations = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return quotations.filter((quotation) => {
      const matchesSearch =
        !search ||
        [quotation.id, quotation.customer, quotation.salesperson]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [quotations, searchTerm, statusFilter])

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
                options={statusOptions}
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
          {filteredQuotations.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id} className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-neutral-900">{quotation.id}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{quotation.items?.length || 0} item(s)</p>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{quotation.customer}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{quotation.salesperson}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{formatDate(quotation.quotationDate)}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{formatDate(quotation.validUntil)}</td>
                    <td className="px-4 py-3.5 font-medium text-neutral-900">{formatCurrency(quotationTotal(quotation))}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusVariant[quotation.status] || 'neutral'}>{quotation.status}</Badge>
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
    </div>
  )
}
