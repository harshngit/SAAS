import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Edit, FileText, Plus, ShoppingBag, Undo2, UsersRound, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { ROLES } from '../../auth/roles'
import { getCustomer, getCustomerPaymentReceipt, getCustomerPayments, recordCustomerPayment, updateCustomer, voidCustomerPayment } from '../../api/customers'
import { orders } from '../../mockData/orders'
import { users } from '../../mockData/users'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'
import { customerBasePathByRole } from './customerConstants'

const statusVariant = {
  Draft: 'neutral',
  Confirmed: 'info',
  'Out for Delivery': 'warning',
  Delivered: 'success',
  Cancelled: 'danger',
}

const paymentVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
]

const today = () => new Date().toISOString().slice(0, 10)

const emptyPaymentForm = {
  amount: '',
  paymentMode: 'cash',
  reference: '',
  note: '',
  orderId: '',
  invoiceId: '',
  receivedOn: today(),
}

function openReceiptDocument(receipt) {
  const receiptValue = String(receipt || '').trim()

  if (!receiptValue) return false

  if (receiptValue.startsWith('http://') || receiptValue.startsWith('https://') || receiptValue.startsWith('data:')) {
    window.open(receiptValue, '_blank', 'noopener,noreferrer')
    return true
  }

  try {
    const binary = window.atob(receiptValue)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    window.open(objectUrl, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    return true
  } catch {
    return false
  }
}

const normalizeCustomer = (customer) => ({
  ...customer,
  organizationId: customer.organization_id || customer.organizationId,
  businessName: customer.business_name || customer.businessName || customer.name,
  type: customer.category || customer.type || '',
  billingAddress: customer.billing_address || customer.billingAddress || customer.address || '',
  deliveryAddress: customer.delivery_address || customer.deliveryAddress || customer.address || '',
  assignedSalesOfficerId: customer.assigned_sales_officer_id || customer.assignedSalesOfficerId || '',
  assignedSalesOfficer: customer.assigned_sales_officer || customer.assignedSalesOfficer,
  outstandingBalance: customer.outstanding_balance || customer.outstandingBalance || 0,
  openingBalance: customer.opening_balance || customer.openingBalance || 0,
  totalBilled: customer.total_billed || customer.totalBilled || 0,
  totalReceived: customer.total_received || customer.totalReceived || 0,
  creditLimit: customer.credit_limit ?? customer.creditLimit ?? 0,
  gstNumber: customer.gst_number || customer.gstNumber || '',
  joinedAt: customer.created_at || customer.joinedAt,
  updatedAt: customer.updated_at || customer.updatedAt,
  notes: customer.notes || '',
  isActive: customer.is_active ?? customer.isActive,
  status: customer.is_active === false || customer.status === 'inactive' ? 'inactive' : 'active',
})

const normalizeCustomerPayment = (payment) => ({
  id: payment.id,
  customerId: payment.customer_id,
  orderId: payment.order_id || '',
  invoiceId: payment.invoice_id || '',
  invoice: payment.invoice,
  amount: payment.amount || 0,
  paymentMode: payment.payment_mode || '',
  reference: payment.reference || '',
  note: payment.note || '',
  receivedOn: payment.received_on,
  createdAt: payment.created_at,
})

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const basePath = customerBasePathByRole[currentUser?.role] || '/sales/customers'

  const [customer, setCustomer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [paymentFormError, setPaymentFormError] = useState('')
  const [payments, setPayments] = useState([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [paymentsError, setPaymentsError] = useState('')
  const [downloadingReceiptId, setDownloadingReceiptId] = useState('')
  const [voidTarget, setVoidTarget] = useState(null)
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidError, setVoidError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadCustomer() {
      setIsLoading(true)
      setLoadError('')
      setIsLoadingPayments(true)
      setPaymentsError('')

      const [result, paymentsResult] = await Promise.all([
        getCustomer(id),
        getCustomerPayments(id),
      ])

      if (!isMounted) return

      setIsLoading(false)
      setIsLoadingPayments(false)

      if (!result.success) {
        setCustomer(null)
        setLoadError(result.error)
        return
      }

      setCustomer(normalizeCustomer(result.customer))

      if (!paymentsResult.success) {
        setPayments([])
        setPaymentsError(paymentsResult.error)
        return
      }

      setPayments(paymentsResult.payments.map(normalizeCustomerPayment))
    }

    loadCustomer()

    return () => {
      isMounted = false
    }
  }, [id])

  const customerOrders = useMemo(
    () => (customer ? orders.filter((order) => order.customerId === customer.id) : []),
    [customer],
  )

  const salesOfficers = useMemo(
    () => users.filter((user) => user.role === ROLES.SALES_OFFICER && user.status === 'active'),
    [],
  )

  const assignedSalesOfficer = customer?.assignedSalesOfficer || users.find((user) => user.id === customer?.assignedSalesOfficerId)

  const loadPayments = async () => {
    setIsLoadingPayments(true)
    setPaymentsError('')

    const result = await getCustomerPayments(id)

    setIsLoadingPayments(false)

    if (!result.success) {
      setPaymentsError(result.error)
      return
    }

    setPayments(result.payments.map(normalizeCustomerPayment))
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading customer details..." />
  }

  if (!customer) {
    return (
      <Card>
        <EmptyState
          icon={UsersRound}
          title="Customer not found"
          description={loadError || 'This customer may have been deleted or the link is out of date.'}
          action={{ label: 'Back to Customers', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const lifetimeValue = customerOrders.reduce((sum, order) => sum + order.total, 0)

  const handleSaveCustomer = async (customerData) => {
    setIsSaving(true)
    setFormError('')

    const result = await updateCustomer(customer.id, {
      ...customer,
      ...customerData,
    })

    if (!result.success) {
      setFormError(result.error)
      setIsSaving(false)
      return
    }

    setCustomer((current) => normalizeCustomer({
      ...current,
      ...customerData,
      ...result.customer,
    }))
    setIsSaving(false)
    setIsFormOpen(false)
  }

  const handleOpenPaymentModal = () => {
    setPaymentForm(emptyPaymentForm)
    setPaymentFormError('')
    setIsPaymentModalOpen(true)
  }

  const handleClosePaymentModal = () => {
    if (isSavingPayment) return
    setIsPaymentModalOpen(false)
    setPaymentFormError('')
  }

  const handleRecordPayment = async (event) => {
    event.preventDefault()
    setPaymentFormError('')

    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      setPaymentFormError('Enter a valid payment amount.')
      return
    }

    setIsSavingPayment(true)

    const result = await recordCustomerPayment(customer.id, {
      amount,
      paymentMode: paymentForm.paymentMode,
      reference: paymentForm.reference.trim(),
      note: paymentForm.note.trim(),
      orderId: paymentForm.orderId.trim(),
      invoiceId: paymentForm.invoiceId.trim(),
      receivedOn: paymentForm.receivedOn ? `${paymentForm.receivedOn}T00:00:00.000Z` : undefined,
    })

    setIsSavingPayment(false)

    if (!result.success) {
      setPaymentFormError(result.error)
      return
    }

    setCustomer((current) => normalizeCustomer({
      ...current,
      ...result.customer,
    }))
    setIsPaymentModalOpen(false)
    await loadPayments()
  }

  const handleOpenReceipt = async (payment) => {
    setPaymentsError('')
    setDownloadingReceiptId(payment.id)

    const result = await getCustomerPaymentReceipt(customer.id, payment.id)

    setDownloadingReceiptId('')

    if (!result.success) {
      setPaymentsError(result.error)
      return
    }

    if (!openReceiptDocument(result.receipt)) {
      setPaymentsError('Receipt downloaded, but the response could not be opened.')
    }
  }

  const handleVoidPayment = async () => {
    if (!voidTarget) return

    setIsVoiding(true)
    setVoidError('')

    const result = await voidCustomerPayment(customer.id, voidTarget.id)

    setIsVoiding(false)

    if (!result.success) {
      setVoidError(result.error)
      return
    }

    setCustomer((current) => normalizeCustomer({
      ...current,
      ...result.customer,
    }))
    setVoidTarget(null)
    await loadPayments()
  }

  if (isFormOpen) {
    return (
      <CustomerForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        customer={customer}
        onSave={handleSaveCustomer}
        salesOfficers={salesOfficers}
        currentUser={currentUser}
        saving={isSaving}
        formError={formError}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{customer.name}</h1>
              <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>
                {customer.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="primary">{customer.type}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleOpenPaymentModal}>
              <Plus className="size-4" aria-hidden="true" />
              Record Payment
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isAdmin) {
                navigate(`/admin/customers/edit/${customer.id}`)
                return
              }

              setIsFormOpen(true)
            }}
          >
            <Edit className="size-4" aria-hidden="true" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} iconVariant="primary" label="Total Orders" value={customerOrders.length} />
        <StatCard icon={Wallet} iconVariant="success" label="Total Received" value={formatCurrency(customer.totalReceived || 0)} />
        <StatCard icon={CreditCard} iconVariant="info" label="Credit Limit" value={formatCurrency(customer.creditLimit)} />
        <StatCard
          icon={Wallet}
          iconVariant={customer.outstandingBalance > 0 ? 'warning' : 'neutral'}
          label="Outstanding Balance"
          value={formatCurrency(customer.outstandingBalance)}
        />
      </div>
      <p className="sr-only">Lifetime Value {formatCurrency(lifetimeValue)}</p>

      <Card
        title="Payments"
        subtitle="Every payment received from this customer"
        className="p-0"
        bodyClassName="p-0"
        actions={
          isAdmin ? (
            <Button type="button" size="sm" onClick={handleOpenPaymentModal}>
              <Plus className="size-4" aria-hidden="true" />
              Record Payment
            </Button>
          ) : null
        }
      >
        <div className="px-5 pb-5">
          {paymentsError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-red-600">{paymentsError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={loadPayments}>
                Retry
              </Button>
            </div>
          ) : isLoadingPayments ? (
            <LoadingSpinner label="Loading payment history..." />
          ) : payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No payments recorded for this customer yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="whitespace-nowrap px-5 py-3">Received On</th>
                    <th className="whitespace-nowrap px-5 py-3">Mode</th>
                    <th className="whitespace-nowrap px-5 py-3">Invoice</th>
                    <th className="whitespace-nowrap px-5 py-3">Order ID</th>
                    <th className="whitespace-nowrap px-5 py-3">Reference</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Amount</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {payment.receivedOn ? new Date(payment.receivedOn).toLocaleDateString() : '-'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Badge variant="neutral">
                          {paymentModeOptions.find((option) => option.value === payment.paymentMode)?.label || payment.paymentMode || '-'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {payment.invoice?.invoice_number || payment.invoiceId || '-'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{payment.orderId || '-'}</td>
                      <td className="px-5 py-3.5 text-neutral-500">{payment.reference || '-'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReceipt(payment)}
                            loading={downloadingReceiptId === payment.id}
                          >
                            <FileText className="size-4" aria-hidden="true" />
                            Receipt
                          </Button>
                          {isAdmin && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setVoidTarget(payment)}>
                              <Undo2 className="size-4" aria-hidden="true" />
                              Void
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card title="Contact Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Phone</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Email</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">GST Number</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.gstNumber || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Assigned Sales Officer</p>
            <p className="mt-1 text-sm text-neutral-800">{assignedSalesOfficer?.name || 'Unassigned'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Billing Address</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.billingAddress || customer.address || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Delivery Address</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.deliveryAddress || customer.billingAddress || customer.address || '—'}</p>
          </div>
        </div>
      </Card>

      <Card title="Order & Transaction History" subtitle="Every sales order placed by this customer" className="p-0" bodyClassName="p-0">
        {customerOrders.length === 0 ? (
          <div className="p-5">
            <p className="py-8 text-center text-sm text-neutral-500">No orders recorded for this customer yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Order #</th>
                  <th className="whitespace-nowrap px-5 py-3">Date</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                  <th className="whitespace-nowrap px-5 py-3">Payment</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Total</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {customerOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{order.orderNumber}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{order.orderDate}</td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge variant={statusVariant[order.status] || 'neutral'}>{order.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge variant={paymentVariant[order.paymentStatus] || 'neutral'} dot>
                        {order.paymentStatus}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                      {formatCurrency(order.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isPaymentModalOpen} onClose={handleClosePaymentModal} title="Record Customer Payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentFormError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {paymentFormError}
            </div>
          )}
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={paymentForm.amount}
            onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
            required
          />
          <Select
            label="Payment Mode"
            options={paymentModeOptions}
            value={paymentForm.paymentMode}
            onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMode: event.target.value }))}
            required
          />
          <DatePicker
            label="Received On"
            value={paymentForm.receivedOn}
            onChange={(value) => setPaymentForm((current) => ({ ...current, receivedOn: value }))}
          />
          <Input
            label="Invoice ID"
            placeholder="Optional invoice ID to settle"
            value={paymentForm.invoiceId}
            onChange={(event) => setPaymentForm((current) => ({ ...current, invoiceId: event.target.value }))}
          />
          <Input
            label="Order ID"
            placeholder="Optional order ID"
            value={paymentForm.orderId}
            onChange={(event) => setPaymentForm((current) => ({ ...current, orderId: event.target.value }))}
          />
          <Input
            label="Reference"
            placeholder="Transaction ID, cheque no., etc."
            value={paymentForm.reference}
            onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
          />
          <Input
            label="Note"
            as="textarea"
            value={paymentForm.note}
            onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
          />
          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={handleClosePaymentModal} disabled={isSavingPayment}>
              Cancel
            </Button>
            <Button type="submit" loading={isSavingPayment}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(voidTarget)}
        onClose={() => {
          if (isVoiding) return
          setVoidError('')
          setVoidTarget(null)
        }}
        title="Void Customer Payment"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Void the {formatCurrency(voidTarget?.amount)} payment recorded on{' '}
            {voidTarget?.receivedOn ? new Date(voidTarget.receivedOn).toLocaleDateString() : ''}? This restores the
            customer outstanding balance and cannot be undone.
          </p>
          {voidError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {voidError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isVoiding}
              onClick={() => {
                setVoidError('')
                setVoidTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isVoiding} onClick={handleVoidPayment}>
              Void Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
