import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CalendarCheck2,
  ClipboardList,
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
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import SocialLinks from '../../components/ui/SocialLinks'
import { useToast } from '../../components/ui/toastContext'
import { ROLES } from '../../auth/roles'
import {
  deleteCustomer,
  getCustomer,
  getCustomerAccountStatement,
  getCustomerPaymentReceipt,
  getCustomerPayments,
  listCustomerDocuments,
  updateCustomer,
  voidCustomerPayment,
} from '../../api/customers'
import { listUsers } from '../../api/users'
import { listOrders } from '../../api/orders'
import { ORDER_STATUS_VARIANT, formatOrderStatus, getDeliveryStatus } from '../orders/orderHelpers'
import { getCustomerFollowUps, getCustomerVisits } from '../../api/visits'
import { useAuthStore } from '../../store/authStore'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'
import RecordPaymentDrawer from './RecordPaymentDrawer'
import { customerBasePathByRole } from './customerConstants'

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
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
]

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
  receiptNumber: payment.receipt_number || '',
  orderId: payment.order_id || '',
  invoiceId: payment.invoice_id || '',
  invoice: payment.invoice,
  amount: payment.amount || 0,
  paymentMode: payment.payment_mode || '',
  reference: payment.reference || '',
  note: payment.note || '',
  receivedOn: payment.received_on,
  createdAt: payment.created_at,
  // 5-part payment snapshot (Order Amount / Previous Pending / Amount Collected / Payment
  // Method / Remaining Receivable) - orderAmount is null for advance/on-account payments.
  orderAmount: payment.order_amount ?? null,
  previousPending: payment.previous_pending ?? null,
  remainingReceivable: payment.remaining_receivable ?? null,
  // Method-specific details - only ever one of these is populated, matching
  // whichever paymentMode was used. Null for cash, or for older payments
  // recorded before the backend persisted these.
  upiId: payment.upi_id || '',
  cardType: payment.card_type || '',
  cardLastFour: payment.card_last_four || '',
  collectionInstructions: payment.collection_instructions || '',
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

// Date-only values (e.g. a follow-up due date) show just the date; datetimes show date + time.
function formatWhen(value) {
  if (!value) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) ? formatDate(value) : formatDateTime(value)
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

// Soft pastel accents for the overview metric cards - kept faint so the page still reads calm.
const METRIC_TONES = {
  neutral: { card: 'border-neutral-100 bg-white', chip: 'bg-primary-50 text-primary-700' },
  emerald: { card: 'border-emerald-100 bg-emerald-50/70', chip: 'bg-emerald-100 text-emerald-700' },
  sky: { card: 'border-sky-100 bg-sky-50/70', chip: 'bg-sky-100 text-sky-700' },
  amber: { card: 'border-amber-100 bg-amber-50/70', chip: 'bg-amber-100 text-amber-700' },
  violet: { card: 'border-violet-100 bg-violet-50/70', chip: 'bg-violet-100 text-violet-700' },
  rose: { card: 'border-rose-100 bg-rose-50/70', chip: 'bg-rose-100 text-rose-700' },
}

function MetricCard({ icon: Icon, label, value, subValue, valueClassName = '', action, tone = 'neutral' }) {
  const toneStyle = METRIC_TONES[tone] || METRIC_TONES.neutral
  return (
    <div className={`rounded-2xl border p-4 shadow-(--shadow-card) ${toneStyle.card}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-neutral-500">{label}</p>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${toneStyle.chip}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className={`mt-3 truncate text-xl font-semibold tracking-tight text-neutral-900 ${valueClassName}`}>{value}</p>
      {subValue && <p className="mt-0.5 truncate text-xs font-medium text-neutral-400">{subValue}</p>}
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

function DocumentPreviewCard({ document }) {
  const [imageFailed, setImageFailed] = useState(false)
  const isImage = typeof document.content_type === 'string' && document.content_type.startsWith('image/')
  const showImage = isImage && document.url && !imageFailed

  return (
    <a
      href={document.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-2.5 hover:border-primary-200 hover:bg-primary-50/40"
    >
      {showImage ? (
        <img
          src={document.url}
          alt={document.name}
          onError={() => setImageFailed(true)}
          className="size-14 shrink-0 rounded-lg border border-neutral-100 object-cover"
        />
      ) : (
        <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-neutral-100 bg-white">
          <FileText className="size-6 text-primary-600" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900" title={document.name}>{document.name}</p>
        <p className="text-xs text-neutral-400">{formatLabel(document.document_type)}</p>
      </div>
    </a>
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
          <p className="text-sm font-semibold text-neutral-900">{number != null ? `${number}. ` : ''}{title}</p>
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

const CUSTOMER_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'contact', label: 'Contact Information' },
  { key: 'orders', label: 'Orders' },
  { key: 'activities', label: 'Activities' },
  { key: 'payments', label: 'Payments' },
  { key: 'documents', label: 'Documents' },
  { key: 'notes', label: 'Notes & Preferences' },
]

const followUpStatusVariant = { pending: 'warning', completed: 'success', cancelled: 'neutral' }
const visitStatusVariant = { planned: 'info', completed: 'success', cancelled: 'neutral' }

function FollowUpRow({ task }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-800">{task.title || 'Follow-up task'}</p>
        {task.dueDate && <p className="text-xs text-neutral-400">Due {formatDate(task.dueDate)}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.priority && <Badge variant="neutral">{formatLabel(task.priority)}</Badge>}
        <Badge variant={followUpStatusVariant[task.status] || 'neutral'}>{formatLabel(task.status)}</Badge>
      </div>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const basePath = customerBasePathByRole[currentUser?.role] || '/sales/customers'

  const [customer, setCustomer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [payments, setPayments] = useState([])
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false)
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
  const [documents, setDocuments] = useState([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [documentsError, setDocumentsError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [visits, setVisits] = useState([])
  const [standaloneFollowUps, setStandaloneFollowUps] = useState([])
  const [visitsLoaded, setVisitsLoaded] = useState(false)
  const [isLoadingVisits, setIsLoadingVisits] = useState(false)
  const [visitsError, setVisitsError] = useState('')

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
      setIsLoadingDocuments(true)
      setDocumentsError('')

      const usersPromise = currentUser?.role === ROLES.SALES_OFFICER ? Promise.resolve({ success: true, users: [] }) : listUsers()
      const [result, paymentsResult, usersResult, ordersResult, ledgerResult, documentsResult] = await Promise.all([
        getCustomer(id),
        getCustomerPayments(id),
        usersPromise,
        listOrders({ customer_id: id }),
        getCustomerAccountStatement(id),
        listCustomerDocuments(id),
      ])

      if (!isMounted) return

      setIsLoading(false)
      setIsLoadingPayments(false)
      setIsLoadingOrders(false)
      setIsLoadingLedger(false)
      setIsLoadingDocuments(false)

      if (documentsResult.success) {
        setDocuments(documentsResult.documents)
      } else {
        setDocumentsError(documentsResult.error)
      }

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

  // Visits + follow-ups are loaded lazily the first time the tab is opened - keeps the
  // initial page load lean since most visits to this page don't open that tab.
  const loadVisits = async () => {
    setIsLoadingVisits(true)
    setVisitsError('')

    const [visitsResult, followUpsResult] = await Promise.all([
      getCustomerVisits(id),
      getCustomerFollowUps(id),
    ])

    setIsLoadingVisits(false)
    setVisitsLoaded(true)

    if (!visitsResult.success) {
      setVisitsError(visitsResult.error)
      return
    }

    setVisits(visitsResult.visits)
    // Follow-ups not attached to any visit (created standalone against the customer).
    const visitLinkedIds = new Set(
      visitsResult.visits.flatMap((visit) => (visit.followUps || []).map((task) => task.id)),
    )
    setStandaloneFollowUps(
      (followUpsResult.success ? followUpsResult.followUps : []).filter((task) => !task.visitId || !visitLinkedIds.has(task.id)),
    )
  }

  useEffect(() => {
    // Overview shows an "Upcoming Activities" widget, and the Activities tab shows the full list.
    if ((activeTab === 'overview' || activeTab === 'activities') && !visitsLoaded && !isLoadingVisits) {
      loadVisits()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, visitsLoaded, isLoadingVisits])

  const handlePaymentRecorded = async (amount) => {
    setIsRecordPaymentOpen(false)
    loadPayments()

    const result = await getCustomer(id)
    if (result.success) {
      setCustomer(normalizeCustomer(result.customer))
    }

    showToast({
      title: 'Payment recorded',
      message: `${formatCurrency(amount)} recorded for ${customer?.businessName || customer?.name || 'this customer'}.`,
    })
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
  const lifetimeSales = customer.totalPurchases || customer.totalBilled || 0
  const avgOrderValue = totalOrdersCount > 0 ? lifetimeSales / totalOrdersCount : 0

  // Next few open follow-ups + scheduled visits, soonest first — for the Overview widget.
  const doneStatuses = ['completed', 'done', 'closed', 'cancelled']
  const upcomingActivities = [
    ...standaloneFollowUps,
    ...visits.flatMap((visit) => visit.followUps || []),
  ]
    .filter((task) => task.dueDate && !doneStatuses.includes(String(task.status || '').toLowerCase()))
    .map((task) => ({
      id: `followup-${task.id}`,
      icon: Phone,
      title: task.title || 'Follow-up',
      subtitle: task.priority ? `${formatLabel(task.priority)} priority` : 'Follow-up task',
      date: task.dueDate,
    }))
    .concat(
      visits
        .filter((visit) => visit.visitDate && ['scheduled', 'planned', 'pending', 'upcoming'].includes(String(visit.status || '').toLowerCase()))
        .map((visit) => ({
          id: `visit-${visit.id}`,
          icon: CalendarCheck2,
          title: `Visit${visit.visitType ? ` · ${formatLabel(visit.visitType)}` : ''}`,
          subtitle: visit.purpose || 'Scheduled visit',
          date: visit.visitDate,
        })),
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4)

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

  // Prefer real coordinates when the customer has them (pinned via the map picker) - falls
  // back to whatever text was pasted (an address string, or a Maps link) otherwise.
  const mapQuery =
    typeof customer.mapsLatitude === 'number' && typeof customer.mapsLongitude === 'number'
      ? `${customer.mapsLatitude},${customer.mapsLongitude}`
      : customer.googleMapsLocation
  const mapEmbedUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : ''
  const mapSearchUrl = mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : ''

  const goToEdit = () => {
    if (isAdmin) {
      navigate(`/admin/customers/edit/${customer.id}`)
      return
    }

    setIsFormOpen(true)
  }

  // Jump to Create Order with this customer pre-selected (see CreateSalesOrder's ?customerId=).
  const orderCreatePath = basePath.replace(/\/customers$/, '/orders/create')
  const goToCreateOrder = () => navigate(`${orderCreatePath}?customerId=${customer.id}`)

  return (
    <div className="space-y-5">
      {customer.status === 'active' && (
        <button
          type="button"
          onClick={goToCreateOrder}
          className="fixed bottom-6 right-10 z-30 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-(--shadow-glow-primary) transition-transform hover:-translate-y-0.5 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500/25"
          aria-label={`Create an order for ${customer.name}`}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          Create Order
        </button>
      )}

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
            <Button variant="outline" size="sm" onClick={() => setIsRecordPaymentOpen(true)}>
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
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-lg font-semibold text-primary-700 ring-1 ring-primary-100">
              {customer.profileImage ? (
                <img src={customer.profileImage} alt={customer.name} className="size-full object-cover" />
              ) : (
                getInitials(customer.name)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-900">{customer.name}</p>
              {customer.displayName && customer.displayName !== customer.name && (
                <p className="text-sm text-neutral-500">Display Name: {customer.displayName}</p>
              )}
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
            <TopInfoItem icon={Calendar} label="Last Updated" value={formatDateTime(customer.updatedAt)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
        <div className="flex gap-1 overflow-x-auto px-3">
          {CUSTOMER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            tone="emerald"
            icon={TrendingUp}
            label="Lifetime Sales"
            value={
              <>
                {formatCurrency(lifetimeSales)}
                <span className="text-base font-medium text-neutral-400"> / {totalOrdersCount}</span>
              </>
            }
            subValue="Sales / Orders"
            action={{ label: 'View Orders', onClick: () => setActiveTab('orders') }}
          />
          <MetricCard tone="sky" icon={Wallet} label="Total Received" value={formatCurrency(customer.totalReceived || 0)} action={{ label: 'View Payments', onClick: () => setActiveTab('payments') }} />
          <MetricCard tone="amber" icon={Wallet} label="Outstanding Balance" value={formatCurrency(customer.outstandingBalance)} valueClassName={customer.outstandingBalance > 0 ? 'text-amber-600' : ''} action={{ label: 'View Payments', onClick: () => setActiveTab('payments') }} />
          <MetricCard tone="violet" icon={Calendar} label="Last Order Date" value={formatDate(customer.lastPurchaseDate) || '-'} action={{ label: 'View Orders', onClick: () => setActiveTab('orders') }} />
          <MetricCard tone="rose" icon={Banknote} label="Avg. Order Value" value={formatCurrency(avgOrderValue)} />
        </div>
      )}

      {activeTab === 'contact' && (
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Contact Information" icon={Phone}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Primary Phone" value={customer.phone} />
            <Field label="Alternate Mobile" value={customer.alternateMobileNumber} />
            <Field label="Email Address" value={customer.email} />
            <Field label="Primary Contact Person" value={customer.primaryContactPerson} />
            <Field label="Designation" value={customer.designation} />
            <Field label="Communication Preference" value={customer.preferredCommunication} />
          </div>
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-400">Social Media</p>
            <div className="mt-2">
              <SocialLinks
                links={{
                  website: customer.website,
                  facebook: customer.facebook,
                  instagram: customer.instagram,
                  linkedin: customer.linkedin,
                  twitter: customer.twitter,
                  youtube: customer.youtube,
                }}
              />
            </div>
          </div>
        </Section>

        <Section title="Business & Tax Information" icon={Building2}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Business Type" value={formatLabel(customer.customerType)} />
            <Field label="Legal Business Name" value={customer.legalBusinessName} />
            <Field label="Industry" value={formatLabel(customer.industry)} />
            <Field label="GST Number" value={customer.gstNumber} />
            <Field label="PAN / Registration No." value={customer.panBusinessRegistrationNo} />
            <Field label="Tax Category" value={formatLabel(customer.taxCategory)} />
            <Field label="Tax Exempt" value={customer.taxExempt ? 'Yes' : 'No'} />
            <Field label="Currency" value={customer.currency} />
          </div>
        </Section>

        <Section title="Address Information" icon={MapPin}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-1 gap-y-4">
              <Field label="Billing Address" value={billingAddressLine} />
              <Field label="Shipping Address" value={shippingAddressLine} />
              <Field label="Country" value={customer.country} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">Google Maps Location</p>
              {mapEmbedUrl ? (
                <div className="mt-1 overflow-hidden rounded-xl border border-neutral-100">
                  <iframe
                    title="Customer location"
                    src={mapEmbedUrl}
                    className="h-24 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    href={mapSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 border-t border-neutral-100 bg-white py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50/60"
                  >
                    <MapPin className="size-3.5" aria-hidden="true" />
                    View on Map
                  </a>
                </div>
              ) : (
                <p className="mt-1 text-sm font-medium text-neutral-900">-</p>
              )}
            </div>
          </div>
        </Section>
      </div>
      )}

      {activeTab === 'overview' && (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Financial Summary" icon={Banknote}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Outstanding Balance" value={formatCurrency(customer.outstandingBalance)} />
            <Field label="Available Credit" value={formatCurrency(customer.availableCredit)} />
            <Field label="Total Received" value={formatCurrency(customer.totalReceived || 0)} />
            <Field label="Total Billed" value={formatCurrency(customer.totalBilled || 0)} />
            <Field label="Opening Balance" value={formatCurrency(customer.openingBalance || 0)} />
            <Field label="Total Purchases" value={formatCurrency(customer.totalPurchases || 0)} />
            <div className="col-span-2">
              <Field label="Customer Lifetime Value" value={formatCurrency(customer.customerLifetimeValue || 0)} />
            </div>
          </div>
        </Section>

        <Section title="Sales & Relationship Details" icon={UserRound}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Field label="Assigned Sales Officer" value={assignedSalesOfficer?.name || 'Unassigned'} />
            <Field label="Lead Source" value={formatLabel(customer.leadSource)} />
            <Field label="Territory" value={customer.territory} />
            <Field label="Customer Priority" value={formatLabel(customer.customerPriority)} />
            <Field label="Customer Since" value={formatDate(customer.customerSince)} />
            <Field label="Customer Tags" value={customer.customerTags} />
          </div>
        </Section>

        <div className="space-y-4">
          <Section
            title="Upcoming Activities"
            icon={Calendar}
            actions={
              <button
                type="button"
                onClick={() => setActiveTab('activities')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
              >
                View All →
              </button>
            }
          >
            {isLoadingVisits && !visitsLoaded ? (
              <p className="py-4 text-sm text-neutral-400">Loading activities…</p>
            ) : upcomingActivities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <CalendarCheck2 className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm text-neutral-400">No follow-ups or visits scheduled.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('activities')}
                  className="text-sm font-semibold text-primary-700 hover:underline"
                >
                  Add an activity →
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {upcomingActivities.map((activity) => {
                  const ActivityIcon = activity.icon
                  return (
                    <li key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <ActivityIcon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-800">{activity.title}</p>
                        <p className="truncate text-xs text-neutral-400">{activity.subtitle}</p>
                      </div>
                      <p className="shrink-0 text-right text-xs text-neutral-500">{formatWhen(activity.date)}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Recent Orders"
            icon={ShoppingBag}
            actions={
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
              >
                View All →
              </button>
            }
          >
            {isLoadingOrders ? (
              <p className="py-4 text-sm text-neutral-400">Loading orders…</p>
            ) : customerOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <ShoppingBag className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm text-neutral-400">No orders yet.</p>
                {customer.status === 'active' && (
                  <button
                    type="button"
                    onClick={goToCreateOrder}
                    className="text-sm font-semibold text-primary-700 hover:underline"
                  >
                    Create the first order →
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {customerOrders.slice(0, 4).map((order) => (
                  <li
                    key={order.id}
                    onClick={() => setActiveTab('orders')}
                    className="-mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors first:pt-0 last:pb-0 hover:bg-primary-50/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-800">{order.orderNumber}</p>
                      <p className="text-xs text-neutral-400">{order.orderDate ? order.orderDate.slice(0, 10) : '—'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={ORDER_STATUS_VARIANT[order.status] || 'neutral'}>{formatOrderStatus(order.status)}</Badge>
                      <span className="text-sm font-medium text-neutral-900">{formatCurrency(order.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {customer.outstandingBalance > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-(--shadow-card)">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">Action Required</p>
                <p className="mt-0.5 text-sm text-neutral-600">
                  This customer has an outstanding balance of {formatCurrency(customer.outstandingBalance)}.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
                >
                  View Payments →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === 'payments' && (
      <div className="space-y-4">
        <Section
          title="Payment History"
          icon={CreditCard}
          actions={isAdmin && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsRecordPaymentOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Record
            </Button>
          )}
        >
          <div>
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
                    {(payment.upiId || payment.cardLastFour || payment.collectionInstructions) && (
                      <p className="mt-1 text-xs text-neutral-500">
                        {payment.upiId && `UPI · ${payment.upiId}`}
                        {payment.cardLastFour && `${payment.cardType ? `${payment.cardType} card` : 'Card'} •••• ${payment.cardLastFour}`}
                        {payment.collectionInstructions && `Collection note: ${payment.collectionInstructions}`}
                      </p>
                    )}
                    {(payment.orderAmount != null || payment.previousPending != null || payment.remainingReceivable != null) && (
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-2 text-[0.7rem]">
                        <div>
                          <p className="text-neutral-400">Order Amt</p>
                          <p className="font-medium text-neutral-700">
                            {payment.orderAmount != null ? formatCurrency(payment.orderAmount) : 'On Account'}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-400">Prev. Pending</p>
                          <p className="font-medium text-neutral-700">
                            {payment.previousPending != null ? formatCurrency(payment.previousPending) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-neutral-400">Remaining</p>
                          <p className="font-medium text-neutral-700">
                            {payment.remainingReceivable != null ? formatCurrency(payment.remainingReceivable) : '—'}
                          </p>
                        </div>
                      </div>
                    )}
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
      )}

      {activeTab === 'orders' && (
        <Section title="Order History" icon={ShoppingBag}>
          <div>
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
                      <th className="whitespace-nowrap px-4 py-2.5">Order Status</th>
                      <th className="whitespace-nowrap px-4 py-2.5">Delivery Status</th>
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
                          <Badge variant={ORDER_STATUS_VARIANT[order.status] || 'neutral'}>{formatOrderStatus(order.status)}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{getDeliveryStatus(order).label}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>
      )}

      {activeTab === 'activities' && (
        visitsError ? (
          <Section title="Activities" icon={ClipboardList}>
            <div className="py-6 text-center">
              <p className="text-sm text-red-600">{visitsError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadVisits}>Retry</Button>
            </div>
          </Section>
        ) : isLoadingVisits || !visitsLoaded ? (
          <Section title="Activities" icon={ClipboardList}>
            <LoadingSpinner label="Loading activities..." />
          </Section>
        ) : (
          <div className="space-y-4">
            <Section title="Visits" icon={MapPin}>
              {visits.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">No visits recorded for this customer yet.</p>
              ) : (
                <div className="space-y-3">
                  {visits.map((visit) => (
                    <div key={visit.id} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">
                            {formatLabel(visit.visitType)}{visit.purpose ? ` · ${visit.purpose}` : ''}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {formatDateTime(visit.visitDate)}{visit.userName ? ` · ${visit.userName}` : ''}
                          </p>
                        </div>
                        <Badge variant={visitStatusVariant[visit.status] || 'neutral'}>{formatLabel(visit.status)}</Badge>
                      </div>
                      {visit.notes && (
                        <p className="mt-2 whitespace-pre-line border-t border-neutral-100 pt-2 text-sm text-neutral-700">{visit.notes}</p>
                      )}
                      {visit.outcome && (
                        <p className="mt-2 text-sm text-neutral-600"><span className="font-medium text-neutral-800">Outcome:</span> {visit.outcome}</p>
                      )}
                      {visit.followUps.length > 0 && (
                        <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Follow-ups from this visit</p>
                          {visit.followUps.map((task) => <FollowUpRow key={task.id} task={task} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Follow-ups" icon={ClipboardList}>
              {standaloneFollowUps.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">No standalone follow-ups for this customer.</p>
              ) : (
                <div className="space-y-1.5">
                  {standaloneFollowUps.map((task) => <FollowUpRow key={task.id} task={task} />)}
                </div>
              )}
            </Section>
          </div>
        )
      )}

      {activeTab === 'notes' && (
      <div className="space-y-4">
        <Section title="Notes & Preferences" icon={StickyNote} actions={
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
                {customer.preferredPaymentMethod === 'UPI' && customer.upiId && <li>UPI ID: {customer.upiId}</li>}
                {customer.preferredPaymentMethod === 'Bank Transfer' && (customer.bankName || customer.accountNumber || customer.ifscSwiftCode) && (
                  <>
                    {customer.bankName && <li>Bank Name: {customer.bankName}</li>}
                    {customer.accountNumber && <li>Account Number: {customer.accountNumber}</li>}
                    {customer.ifscSwiftCode && <li>IFSC/SWIFT Code: {customer.ifscSwiftCode}</li>}
                  </>
                )}
              </ul>
            </div>
            {(customer.dateOfBirth || customer.anniversaryDate || customer.loyaltyNumber || customer.referralCustomer) && (
              <div className="border-t border-neutral-100 pt-4">
                <p className="text-xs text-neutral-400">Additional Details</p>
                <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
                  {customer.dateOfBirth && <li>Date of Birth: {formatDate(customer.dateOfBirth)}</li>}
                  {customer.anniversaryDate && <li>Anniversary: {formatDate(customer.anniversaryDate)}</li>}
                  {customer.loyaltyNumber && <li>Loyalty Number: {customer.loyaltyNumber}</li>}
                  {customer.referralCustomer && <li>Referred By: {customer.referralCustomer}</li>}
                </ul>
              </div>
            )}
          </div>
        </Section>
      </div>
      )}

      {activeTab === 'payments' && (
      <Section
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
      )}

      {activeTab === 'documents' && (
      <Section
        title="Documents"
        icon={FileText}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={goToEdit}>
            <Plus className="size-4" aria-hidden="true" />
            Manage
          </Button>
        }
      >
        {documentsError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600">{documentsError}</p>
          </div>
        ) : isLoadingDocuments ? (
          <LoadingSpinner label="Loading documents..." />
        ) : documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No documents uploaded for this customer yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {documents.map((document) => (
              <DocumentPreviewCard key={document.id} document={document} />
            ))}
          </div>
        )}
      </Section>
      )}

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

      <RecordPaymentDrawer
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        customer={customer}
        onSaved={handlePaymentRecorded}
      />
    </div>
  )
}
