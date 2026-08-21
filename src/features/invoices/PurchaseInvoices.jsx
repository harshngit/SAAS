import { useCallback, useEffect, useMemo, useState } from 'react'
import { IndianRupee } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { listPurchases, PURCHASE_PAYMENT_STATUS_OPTIONS, updatePurchasePaymentStatus } from '../../api/purchases'
import { formatCurrency } from '../../utils/format'

const statusVariant = { pending: 'warning', approved: 'success', cancelled: 'danger' }
const paymentStatusVariant = { unpaid: 'danger', partial: 'warning', paid: 'success' }

export default function PurchaseInvoices() {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const loadInvoices = useCallback(async () => {
    setIsLoading(true)
    setListError('')

    const result = await listPurchases()

    if (!result.success) {
      setInvoices([])
      setListError(result.error)
      setIsLoading(false)
      return
    }

    setInvoices(result.purchases)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const openPaymentModal = (invoice) => {
    setPaymentError('')
    setPaymentStatus(invoice.paymentStatus || 'unpaid')
    setPaymentAmount(String(invoice.amountPaid ?? 0))
    setPaymentTarget(invoice)
  }

  const handleUpdatePayment = async () => {
    if (!paymentTarget) return

    setIsUpdatingPayment(true)
    setPaymentError('')

    const result = await updatePurchasePaymentStatus(paymentTarget.id, {
      paymentStatus,
      amountPaid: paymentAmount === '' ? undefined : paymentAmount,
    })

    if (!result.success) {
      setPaymentError(result.error)
      setIsUpdatingPayment(false)
      return
    }

    setIsUpdatingPayment(false)
    setPaymentTarget(null)
    loadInvoices()
  }

  const columns = useMemo(
    () => [
      { key: 'invoiceNumber', header: 'Invoice #', sortable: true },
      { key: 'supplierName', header: 'Supplier', sortable: true },
      {
        key: 'invoiceDate',
        header: 'Date',
        sortable: true,
        render: (row) => {
          if (!row.invoiceDate) return '—'
          const date = new Date(row.invoiceDate)
          return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        },
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'}>{row.status}</Badge>,
      },
      {
        key: 'paymentStatus',
        header: 'Payment',
        sortable: true,
        render: (row) => <Badge variant={paymentStatusVariant[row.paymentStatus] || 'neutral'} dot>{row.paymentStatus}</Badge>,
      },
      { key: 'total', header: 'Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total) },
      { key: 'outstandingAmount', header: 'Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.outstandingAmount) },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Purchase Invoices</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage all supplier purchase invoices</p>
      </div>

      {listError ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm text-red-600">{listError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadInvoices}>Retry</Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Card>
          <LoadingSpinner label="Loading purchase invoices..." />
        </Card>
      ) : (
        <Card title="Purchase Invoices">
          <DataTable
            columns={columns}
            data={invoices}
            searchKeys={['invoiceNumber', 'supplierName', 'status', 'paymentStatus']}
            searchPlaceholder="Search purchase invoices..."
            actions={(row) => [
              { label: 'Update Payment Status', icon: IndianRupee, onClick: () => openPaymentModal(row) },
            ]}
          />
        </Card>
      )}

      <Modal isOpen={Boolean(paymentTarget)} onClose={() => !isUpdatingPayment && setPaymentTarget(null)} title="Update Payment Status">
        <div className="space-y-4">
          {paymentError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{paymentError}</div>
          )}
          <p className="text-sm text-neutral-500">{paymentTarget?.invoiceNumber}</p>
          <Select
            label="Payment Status"
            options={PURCHASE_PAYMENT_STATUS_OPTIONS}
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
          />
          <Input
            label="Amount Paid"
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isUpdatingPayment} onClick={() => setPaymentTarget(null)}>Cancel</Button>
            <Button type="button" loading={isUpdatingPayment} onClick={handleUpdatePayment}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
