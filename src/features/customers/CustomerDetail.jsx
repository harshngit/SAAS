import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CalendarCheck2,
  CreditCard,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  StickyNote,
  Trash2,
  TrendingUp,
  Undo2,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { ROLES } from '../../auth/roles'
import {
  deleteCustomer,
  getCustomer,
  getCustomerAccountStatement,
  getCustomerPaymentReceipt,
  getCustomerPayments,
  recordCustomerPayment,
  updateCustomer,
  voidCustomerPayment,
} from '../../api/customers'
import { listUsers } from '../../api/users'
import { listOrders } from '../../api/orders'
import { useAuthStore } from '../../store/authStore'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'
import { customerBasePathByRole } from './customerConstants'

const orderStatusVariant = {
  draft: 'neutral',
  placed: 'info',
  awaiting_approval: 'warning',
  processing: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

const ledgerTransactionVariant = {
  invoice: 'primary',
  payment: 'success',
  credit_note: 'purple',
  opening_balance: 'neutral',
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

const normalizeUser = (user) => ({
  id: user.id,
  name: user.name,
  role: user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name),
  status: user.is_active === false || user.status === 'inactive' ? 'inactive' : 'active',
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

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function formatDate(value) {
  if (!value) return ''

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(value) {
  if (!value) return ''

  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function formatLabel(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function TopInfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="truncate text-sm font-semibold text-neutral-900" title={value || '-'}>{value || '-'}</p>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, valueClassName = '', action }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-(--shadow-card)">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-neutral-500">{label}</p>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className={`mt-3 truncate text-xl font-semibold tracking-tight text-neutral-900 ${valueClassName}`}>{value}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 text-xs font-medium text-primary-700 hover:underline"
        >
          {action.label} →
        </button>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-neutral-900" title={value || '-'}>{value || '-'}</p>
    </div>
  )
}

function Section({ number, title, icon: Icon, actions, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-neutral-900">{number}. {title}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

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
  const [staffUsers, setStaffUsers] = useState([])
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)
  const [customerOrders, setCustomerOrders] = useState([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [ledger, setLedger] = useState(null)
  const [isLoadingLedger, setIsLoadingLedger] = useState(true)
  const [ledgerError, setLedgerError] = useState('')
  const [statementDateFrom, setStatementDateFrom] = useState('')
  const [statementDateTo, setStatementDateTo] = useState('')

  const loadLedger = async (params = {}) => {
    setIsLoadingLedger(true)
    setLedgerError('')

    const result = await getCustomerAccountStatement(id, params)

    setIsLoadingLedger(false)

    if (!result.success) {
      setLedger(null)
      setLedgerError(result.error)
      return
    }

    setLedger(result.ledger)
  }

  const handleApplyStatementFilter = () => {
    loadLedger({ dateFrom: statementDateFrom || undefined, dateTo: statementDateTo || undefined })
  }

  const handleClearStatementFilter = () => {
    setStatementDateFrom('')
    setStatementDateTo('')
    loadLedger()
  }

  useEffect(() => {
    let isMounted = true

    async function loadCustomer() {
      setIsLoading(true)
      setLoadError('')
      setIsLoadingPayments(true)
      setPaymentsError('')
      setIsLoadingOrders(true)
      setIsLoadingLedger(true)
      setLedgerError('')

      const usersPromise = currentUser?.role === ROLES.SALES_OFFICER ? Promise.resolve({ success: true, users: [] }) : listUsers()
      const [result, paymentsResult, usersResult, ordersResult, ledgerResult] = await Promise.all([
        getCustomer(id),
        getCustomerPayments(id),
        usersPromise,
        listOrders({ customer_id: id }),
        getCustomerAccountStatement(id),
      ])

      if (!isMounted) return

      setIsLoading(false)
      setIsLoadingPayments(false)
      setIsLoadingOrders(false)
      setIsLoadingLedger(false)

      if (currentUser?.role === ROLES.SALES_OFFICER) {
        setStaffUsers(
          currentUser?.id
            ? [
                {
                  id: currentUser.id,
                  name: currentUser.name || 'Current user',
                  role: ROLES.SALES_OFFICER,
                  status: 'active',
                },
              ]
            : [],
        )
      } else if (usersResult.success) {
        setStaffUsers(usersResult.users.map(normalizeUser))
      }

      if (ordersResult.success) {
        setCustomerOrders(ordersResult.orders)
      }

      if (ledgerResult.success) {
        setLedger(ledgerResult.ledger)
      } else {
        setLedgerError(ledgerResult.error)
      }

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
  }, [currentUser?.id, currentUser?.name, currentUser?.role, id])

  const salesOfficers = useMemo(
    () => staffUsers.filter((user) => user.role === ROLES.SALES_OFFICER && user.status === 'active'),
    [staffUsers],
  )

  const assignedSalesOfficer =
    customer?.assignedSalesOfficer || staffUsers.find((user) => user.id === customer?.assignedSalesOfficerId)

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

  const totalOrdersCount = customer.totalOrders || customerOrders.length
  const avgOrderValue = totalOrdersCount > 0 ? (customer.totalPurchases || customer.totalBilled || 0) / totalOrdersCount : 0

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

  const handleToggleStatus = async () => {
    setIsStatusSaving(true)
    setLoadError('')

    const nextStatus = customer.status === 'active' ? 'inactive' : 'active'
    const result = await updateCustomer(customer.id, { ...customer, status: nextStatus })

    setIsStatusSaving(false)

    if (!result.success) {
      setLoadError(result.error)
      return
    }

    setCustomer((current) => normalizeCustomer({ ...current, ...result.customer }))
  }

  const handleConfirmDelete = async () => {
    setDeleteError('')
    setIsDeletingCustomer(true)

    const result = await deleteCustomer(customer.id)

    setIsDeletingCustomer(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    navigate(basePath)
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

  const billingAddressLine = [customer.billingAddress || customer.address, customer.city, customer.state, customer.pinZipCode]
    .filter(Boolean)
    .join(', ')
  const shippingAddressLine = [customer.deliveryAddress || customer.shippingAddress, customer.city, customer.state, customer.pinZipCode]
    .filter(Boolean)
    .join(', ')

  const goToEdit = () => {
    if (isAdmin) {
      navigate(`/admin/customers/edit/${customer.id}`)
      return
    }

    setIsFormOpen(true)
  }

  return (
    <div className="space-y-5">
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeletingCustomer) return
          setIsDeleteModalOpen(false)
          setDeleteError('')
        }}
        title="Delete Customer"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete {customer.name}? This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isDeletingCustomer} onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete} loading={isDeletingCustomer}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">Customer Details</h1>
          <p className="mt-1 text-sm text-neutral-500">
            <button type="button" onClick={() => navigate(basePath)} className="text-neutral-500 hover:text-primary-700">Customers</button>
            <span className="mx-1.5">/</span>
            <span className="text-neutral-700">{customer.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Customers
          </Button>
          <Button size="sm" onClick={goToEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit Customer
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleOpenPaymentModal}>
              <Plus className="size-4" aria-hidden="true" />
              Record Payment
            </Button>
          )}
          {isAdmin && (
            <ActionMenu
              items={[
                { label: customer.status === 'active' ? 'Set Inactive' : 'Set Active', icon: RefreshCw, onClick: isStatusSaving ? undefined : handleToggleStatus },
                { label: 'Delete Customer', icon: Trash2, danger: true, onClick: () => setIsDeleteModalOpen(true) },
              ]}
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card)">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex items-start gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-semibold text-primary-700 ring-1 ring-primary-100">
              {getInitials(customer.name)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-900">{customer.name}</p>
              <p className="text-sm text-neutral-500">Customer ID: {customer.customerId || '-'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={customer.status === 'active' ? 'success' : 'danger'}>{customer.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                {customer.type && <Badge variant="primary">{customer.type}</Badge>}
              </div>
              <div className="mt-3 space-y-1 text-sm text-neutral-600">
                {customer.phone && <p className="flex items-center gap-1.5"><Phone className="size-3.5 text-neutral-400" aria-hidden="true" />{customer.phone}</p>}
                {customer.email && <p className="flex items-center gap-1.5"><Mail className="size-3.5 text-neutral-400" aria-hidden="true" />{customer.email}</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-4 border-t border-neutral-100 pt-5 sm:grid-cols-3 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <TopInfoItem icon={ShieldCheck} label="GST Number" value={customer.gstNumber} />
            <TopInfoItem icon={UserRound} label="Assigned Sales Officer" value={assignedSalesOfficer?.name} />
            <TopInfoItem icon={CalendarCheck2} label="Credit Terms" value={customer.paymentTerms} />
            <TopInfoItem icon={CreditCard} label="Payment Type" value={formatLabel(customer.preferredPaymentMethod)} />
            <TopInfoItem icon={Calendar} label="Customer Since" value={formatDate(customer.customerSince)} />
            <TopInfoItem icon={Calendar} label="Created On" value={formatDateTime(customer.createdAt)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={ShoppingBag}
          label="Total Orders"
          value={totalOrdersCount}
          action={{ label: 'View Orders', onClick: () => document.getElementById('order-history')?.scrollIntoView({ behavior: 'smooth' }) }}
        />
        <MetricCard
          icon={Wallet}
          label="Total Received"
          value={formatCurrency(customer.totalReceived || 0)}
          action={{ label: 'View Payments', onClick: () => document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth' }) }}
        />
        <MetricCard
          icon={CreditCard}
          label="Credit Limit"
          value={formatCurrency(customer.creditLimit)}
          action={{ label: 'Edit Limit', onClick: goToEdit }}
        />
        <MetricCard
          icon={Wallet}
          label="Outstanding Balance"
          value={formatCurrency(customer.outstandingBalance)}
          valueClassName={customer.outstandingBalance > 0 ? 'text-amber-600' : ''}
          action={{ label: 'View Payments', onClick: () => document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth' }) }}
        />
        <MetricCard
          icon={Calendar}
          label="Last Order Date"
          value={formatDate(customer.lastPurchaseDate) || '-'}
          action={{ label: 'View Orders', onClick: () => document.getElementById('order-history')?.scrollIntoView({ behavior: 'smooth' }) }}
        />
        <MetricCard icon={TrendingUp} label="Avg. Order Value" value={formatCurrency(avgOrderValue)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section number={1} title="Contact Information" icon={Phone}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Primary Phone" value={customer.phone} />
            <Field label="Alternate Mobile" value={customer.alternateMobileNumber} />
            <Field label="Email Address" value={customer.email} />
            <Field label="Website" value={customer.website} />
            <Field label="Primary Contact Person" value={customer.primaryContactPerson} />
            <Field label="Designation" value={customer.designation} />
            <Field label="Communication Preference" value={customer.preferredCommunication} />
          </div>
        </Section>

        <Section number={2} title="Business & Tax Information" icon={Building2}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Business Type" value={formatLabel(customer.customerType)} />
            <Field label="Industry" value={formatLabel(customer.industry)} />
            <Field label="GST Number" value={customer.gstNumber} />
            <Field label="PAN / Registration No." value={customer.panBusinessRegistrationNo} />
            <Field label="Tax Category" value={formatLabel(customer.taxCategory)} />
            <Field label="Tax Exempt" value={customer.taxExempt ? 'Yes' : 'No'} />
            <Field label="Currency" value={customer.currency} />
          </div>
        </Section>

        <Section number={3} title="Address Information" icon={MapPin}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-4">
            <Field label="Billing Address" value={billingAddressLine} />
            <Field label="Shipping Address" value={shippingAddressLine} />
            <Field label="Country" value={customer.country} />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section number={4} title="Financial Summary" icon={Banknote}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Credit Limit" value={formatCurrency(customer.creditLimit)} />
            <Field label="Outstanding Balance" value={formatCurrency(customer.outstandingBalance)} />
            <Field label="Available Credit" value={formatCurrency(customer.availableCredit)} />
            <Field label="Total Received" value={formatCurrency(customer.totalReceived || 0)} />
            <Field label="Total Billed" value={formatCurrency(customer.totalBilled || 0)} />
            <Field label="Opening Balance" value={formatCurrency(customer.openingBalance || 0)} />
          </div>
        </Section>

        <Section number={5} title="Sales & Relationship Details" icon={UserRound}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Assigned Sales Officer" value={assignedSalesOfficer?.name || 'Unassigned'} />
            <Field label="Lead Source" value={formatLabel(customer.leadSource)} />
            <Field label="Territory" value={customer.territory} />
            <Field label="Customer Priority" value={formatLabel(customer.customerPriority)} />
            <Field label="Customer Since" value={formatDate(customer.customerSince)} />
            <Field label="Customer Tags" value={customer.customerTags} />
          </div>
        </Section>

        <Section
          number={6}
          title="Payment History"
          icon={CreditCard}
          className="xl:col-span-1"
          actions={isAdmin && (
            <Button type="button" variant="ghost" size="sm" onClick={handleOpenPaymentModal}>
              <Plus className="size-4" aria-hidden="true" />
              Record
            </Button>
          )}
        >
          <div id="payment-history" className="scroll-mt-6">
            {paymentsError ? (
              <div className="py-6 text-center">
                <p className="text-sm text-red-600">{paymentsError}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadPayments}>Retry</Button>
              </div>
            ) : isLoadingPayments ? (
              <LoadingSpinner label="Loading payment history..." />
            ) : payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No payments recorded for this customer yet.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{formatCurrency(payment.amount)}</p>
                      <Badge variant="neutral">
                        {paymentModeOptions.find((option) => option.value === payment.paymentMode)?.label || payment.paymentMode || '-'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {payment.receivedOn ? new Date(payment.receivedOn).toLocaleDateString() : '-'}
                      {payment.invoice?.invoice_number || payment.invoiceId ? ` · ${payment.invoice?.invoice_number || payment.invoiceId}` : ''}
                    </p>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleOpenReceipt(payment)} loading={downloadingReceiptId === payment.id}>
                        <FileText className="size-3.5" aria-hidden="true" />
                        Receipt
                      </Button>
                      {isAdmin && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setVoidTarget(payment)}>
                          <Undo2 className="size-3.5" aria-hidden="true" />
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section number={7} title="Order History" icon={ShoppingBag} className="xl:col-span-2">
          <div id="order-history" className="scroll-mt-6">
            {isLoadingOrders ? (
              <LoadingSpinner label="Loading orders..." />
            ) : customerOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">No orders recorded for this customer yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-100">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="whitespace-nowrap px-4 py-2.5">Order #</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Date</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Fulfilment</th>
                      <th className="whitespace-nowrap px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {customerOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className="cursor-pointer transition-colors hover:bg-primary-50/35"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-800">{order.orderNumber}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{order.orderDate ? order.orderDate.slice(0, 10) : '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={orderStatusVariant[order.status] || 'neutral'}>{order.status?.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{order.fulfilmentStatus?.replace(/_/g, ' ')}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        <Section number={8} title="Notes & Preferences" icon={StickyNote} actions={
          <Button type="button" variant="ghost" size="sm" onClick={goToEdit}>Edit</Button>
        }>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-neutral-400">Customer Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-neutral-800">{customer.notes || 'No notes added yet.'}</p>
            </div>
            <div className="border-t border-neutral-100 pt-4">
              <p className="text-xs text-neutral-400">Preferences</p>
              <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                <li>Communication: {customer.preferredCommunication || '-'}</li>
                <li>Payment Method: {formatLabel(customer.preferredPaymentMethod) || '-'}</li>
                <li>Tags: {customer.customerTags || '-'}</li>
              </ul>
            </div>
          </div>
        </Section>
      </div>

      <Section
        number={9}
        title="Account Statement"
        icon={Landmark}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <DatePicker
              label="From"
              value={statementDateFrom}
              onChange={setStatementDateFrom}
              className="w-36"
            />
            <DatePicker
              label="To"
              value={statementDateTo}
              onChange={setStatementDateTo}
              className="w-36"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleApplyStatementFilter}>Apply</Button>
            {(statementDateFrom || statementDateTo) && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearStatementFilter}>Clear</Button>
            )}
          </div>
        }
      >
        {ledgerError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600">{ledgerError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => loadLedger()}>Retry</Button>
          </div>
        ) : isLoadingLedger ? (
          <LoadingSpinner label="Loading account statement..." />
        ) : !ledger ? null : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400">Total Billed</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(ledger.summary.totalBilled)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400">Total Received</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(ledger.summary.totalReceived)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400">Outstanding</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(ledger.summary.outstanding)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400">Overdue</p>
                <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(ledger.summary.overdueAmount)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400">Available Credit</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(ledger.summary.availableCredit)}</p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <p className="text-xs text-neutral-400">Credit Limit</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(ledger.summary.creditLimit)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Ageing Analysis</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {['0-30', '31-60', '61-90', '90+'].map((bucket) => (
                  <div key={bucket} className="rounded-xl border border-neutral-100 px-4 py-3">
                    <p className="text-xs text-neutral-400">{bucket} days</p>
                    <p className="mt-1 text-base font-semibold text-neutral-900">{formatCurrency(ledger.ageing[bucket])}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Transaction History</p>
              {ledger.transactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">No ledger transactions recorded yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-100">
                  <table className="w-full min-w-2xl text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                        <th className="whitespace-nowrap px-4 py-2.5">Date</th>
                        <th className="whitespace-nowrap px-4 py-2.5">Type</th>
                        <th className="whitespace-nowrap px-4 py-2.5">Description</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right">Debit</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right">Credit</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {ledger.transactions.map((entry, index) => (
                        <tr key={`${entry.type}-${entry.date}-${index}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{entry.date ? entry.date.slice(0, 10) : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <Badge variant={ledgerTransactionVariant[entry.type] || 'neutral'}>{formatLabel(entry.type)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{entry.description || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-neutral-700">{entry.debit ? formatCurrency(entry.debit) : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-neutral-700">{entry.credit ? formatCurrency(entry.credit) : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(entry.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      <Modal isOpen={isPaymentModalOpen} onClose={handleClosePaymentModal} title="Record Customer Payment" className="max-w-lg">
        <form onSubmit={handleRecordPayment} className="space-y-5">
          {paymentFormError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {paymentFormError}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">Customer</p>
              <p className="truncate text-sm font-medium text-neutral-900">{customer.businessName || customer.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-neutral-400">Outstanding</p>
              <p className={`text-sm font-semibold ${customer.outstandingBalance > 0 ? 'text-amber-600' : 'text-neutral-900'}`}>
                {formatCurrency(customer.outstandingBalance)}
              </p>
            </div>
          </div>

          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={paymentForm.amount}
            onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
            inputClassName="text-lg font-semibold"
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-400">Settle Against (Optional)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Invoice ID"
                placeholder="Leave blank for advance"
                value={paymentForm.invoiceId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, invoiceId: event.target.value }))}
              />
              <Input
                label="Order ID"
                placeholder="Optional order ID"
                value={paymentForm.orderId}
                onChange={(event) => setPaymentForm((current) => ({ ...current, orderId: event.target.value }))}
              />
            </div>
          </div>

          <Input
            label="Reference"
            placeholder="Transaction ID, cheque no., etc."
            value={paymentForm.reference}
            onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
          />
          <Input
            label="Note"
            as="textarea"
            placeholder="Optional note about this payment"
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
