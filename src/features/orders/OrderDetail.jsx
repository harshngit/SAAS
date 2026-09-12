import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  Ban,
  Check,
  Copy,
  FileText,
  PackageCheck,
  PackageSearch,
  Pencil,
  Store,
  Truck,
  Undo2,
  Wallet,
} from 'lucide-react'
import OrderDetailView from './OrderDetailView'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/toastContext'
import {
  cancelOrder,
  confirmOrder,
  getOrder,
  pickupConfirm,
  pickupReady,
  pickupStart,
} from '../../api/orders'
import { listDeliveries, listDeliveryPartners, planDelivery } from '../../api/deliveries'
import { listCollections } from '../../api/deliveryCollections'
import { listInvoices } from '../../api/invoices'
import { listSalesReturns } from '../../api/salesReturns'
import { SALES_RETURNS_DEMO_ENABLED, getDemoSalesReturns } from '../salesReturns/salesReturnDemoData'
import { srStatusMeta, totalReturnQty } from '../salesReturns/salesReturnHelpers'
import CollectPaymentDrawer from '../collections/CollectPaymentDrawer'
import {
  COLLECTION_STATUS_VARIANT,
  formatCollectorRole,
  formatPaymentMode,
  formatStatus as formatCollectionStatus,
} from '../collections/collectionHelpers'
import { getSalesWorkflowSettings } from '../../api/settings'
import { listVehicles } from '../../api/vehicles'
import { listWarehouses } from '../../api/warehouses'
import { listProducts } from '../../api/products'
import { getFileUrl } from '../../api/files'
import { getUser, listAssignableStaff } from '../../api/users'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'
import { ROLES, roleLabels } from '../../auth/roles'
import { usePermission } from '../../auth/usePermission'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import {
  CANCEL_REASONS,
  buildOrderTimeline,
  formatOrderStatus,
  getDeliveryStatus,
  getFulfilmentLabel,
  getOrderActions,
  getOrderProgress,
  hasOrderStateMismatch,
  isStockReserved,
  isTakeawayOrder,
  orderSourceLabel,
} from './orderHelpers'
import {
  DEMO_DELIVERY_PARTNERS,
  DEMO_VEHICLES,
  DEMO_WAREHOUSES,
  buildDemoDelivery,
  buildDemoInvoice,
  duplicateDemoOrder,
  getDemoOrder,
  isDemoOrder,
  patchDemoOrder,
} from './orderDemoData'

const billableDeliveryStatuses = ['delivered', 'partially_delivered']

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

const roleName = (role) => roleLabels[role] || String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const currentUser = useAuthStore((state) => state.currentUser)
  const { can } = usePermission()
  const canViewReturns = can('sales_returns', 'view')
  const canCreateReturns = can('sales_returns', 'create')
  // Same permission the Invoice Detail "Record Payment" button uses - recording a customer
  // payment is a financial transaction, not an order action.
  const canRecordPayment = can('payments', 'create')
  const isSalesPath = window.location.pathname.startsWith('/sales')
  const basePath = isSalesPath ? '/sales/orders' : window.location.pathname.startsWith('/delivery') ? '/delivery/orders' : '/admin/orders'
  const quotationsBasePath = isSalesPath ? '/sales/quotations' : '/admin/quotations'
  const isDemo = isDemoOrder(id)

  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isActing, setIsActing] = useState(false)

  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ deliveryPartnerId: '', vehicleId: '', warehouseId: '', scheduledDate: '', deliveryAddress: '' })
  const [planItemQuantities, setPlanItemQuantities] = useState({})
  const [planError, setPlanError] = useState('')
  const [isPlanning, setIsPlanning] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNotes, setCancelNotes] = useState('')
  const [isPickupConfirmModalOpen, setIsPickupConfirmModalOpen] = useState(false)
  const [pickupItemQuantities, setPickupItemQuantities] = useState({})
  const [collectedBy, setCollectedBy] = useState('')
  const [pickupNotesInput, setPickupNotesInput] = useState('')
  const [pickupError, setPickupError] = useState('')
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false)
  const [orderInvoices, setOrderInvoices] = useState([])
  const [orderReturns, setOrderReturns] = useState([])
  const [hasMoreToInvoice, setHasMoreToInvoice] = useState(false)
  const [invoiceMode, setInvoiceMode] = useState('per_delivery')
  const [isViewDeliveryOpen, setIsViewDeliveryOpen] = useState(false)
  const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false)
  const [creator, setCreator] = useState(null)
  const [productMeta, setProductMeta] = useState({})
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = useState(false)
  const [orderPayments, setOrderPayments] = useState([])
  const [isLoadingOrderPayments, setIsLoadingOrderPayments] = useState(false)
  const [orderPaymentsError, setOrderPaymentsError] = useState('')

  const invoicedByProduct = useMemo(() => {
    const map = {}
    orderInvoices.forEach((invoice) => {
      if (invoice.isCreditNote) return
      ;(invoice.items || []).forEach((line) => {
        const key = line.productId || line.id
        if (key) map[key] = (map[key] || 0) + (Number(line.quantity) || 0)
      })
    })
    return map
  }, [orderInvoices])

  const loadOrder = async () => {
    setIsLoading(true)
    setLoadError('')

    if (isDemo) {
      const demo = getDemoOrder(id)
      setOrder(demo)
      setLoadError(demo ? '' : 'Demo order not found.')
      setIsLoading(false)
      return
    }

    const result = await getOrder(id)

    if (!result.success) {
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setOrder(result.order)
    setIsLoading(false)
  }

  useEffect(() => {
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Order items carry no image / SKU - pull those from the product catalogue for the table.
  useEffect(() => {
    if (isDemo || !order?.items?.length) return
    let active = true
    listProducts().then((result) => {
      if (!active || !result.success) return
      const map = {}
      result.products.forEach((product) => {
        map[product.id] = {
          image: getFileUrl(
            product.cover_image ||
              product.cover_image_url ||
              product.image_url ||
              (Array.isArray(product.images) ? product.images[0]?.url || product.images[0] : '') ||
              '',
          ),
          sku: product.sku || '',
        }
      })
      setProductMeta(map)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, order?.id])

  // Sales Returns raised against this order (via its invoices). Read-only cross-link (§20).
  useEffect(() => {
    if (!order?.id || !canViewReturns) {
      setOrderReturns([])
      return
    }
    if (SALES_RETURNS_DEMO_ENABLED) {
      setOrderReturns(getDemoSalesReturns().filter((sr) => sr.orderId === order.id))
      return
    }
    if (isDemo) {
      setOrderReturns([])
      return
    }
    const invoiceIds = orderInvoices.map((invoice) => invoice.id).filter(Boolean)
    if (invoiceIds.length === 0) {
      setOrderReturns([])
      return
    }
    let isMounted = true
    Promise.all(invoiceIds.slice(0, 5).map((invoiceId) => listSalesReturns({ invoice_reference_id: invoiceId }))).then(
      (results) => {
        if (!isMounted) return
        const byId = new Map()
        results.forEach((result) => {
          if (result.success) result.salesReturns.forEach((sr) => byId.set(sr.id, sr))
        })
        setOrderReturns([...byId.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)))
      },
    )
    return () => {
      isMounted = false
    }
  }, [order?.id, isDemo, orderInvoices, canViewReturns])

  useEffect(() => {
    if (!order?.id) {
      setOrderInvoices([])
      setHasMoreToInvoice(false)
      return
    }

    if (isDemo) {
      setOrderInvoices(
        order.invoiceId
          ? [{ id: order.invoiceId, invoiceNumber: order.invoiceNumber, deliveryId: null, demo: order.demoInvoice || buildDemoInvoice(order) }]
          : [],
      )
      setHasMoreToInvoice(false)
      return
    }

    let isMounted = true

    listInvoices({ order_id: order.id }).then((invoicesResult) => {
      if (!isMounted) return
      const invoices = invoicesResult.success ? invoicesResult.invoices : []
      setOrderInvoices(invoices)

      const wholeOrderInvoice = invoices.find((invoice) => !invoice.deliveryId)
      if (invoices.length === 0 || wholeOrderInvoice) {
        setHasMoreToInvoice(false)
        return
      }

      listDeliveries({ order_id: order.id }).then((deliveriesResult) => {
        if (!isMounted) return
        const deliveries = deliveriesResult.success ? deliveriesResult.deliveries : []
        const invoicedDeliveryIds = new Set(invoices.map((invoice) => invoice.deliveryId).filter(Boolean))
        setHasMoreToInvoice(
          deliveries.some((delivery) => billableDeliveryStatuses.includes(delivery.status) && !invoicedDeliveryIds.has(delivery.id)),
        )
      })
    })

    return () => {
      isMounted = false
    }
  }, [order?.id, order?.invoiceId, isDemo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Customer-based payment collection history (§ collections are customer-scoped, not tied
  // to a specific order) - the same data source Customer Detail's Payments tab reads.
  // listCollections() demo-gates internally, so this works for both demo and real orders.
  const loadOrderPayments = async (customerId) => {
    if (!customerId) {
      setOrderPayments([])
      setOrderPaymentsError('')
      return
    }
    setIsLoadingOrderPayments(true)
    setOrderPaymentsError('')
    const result = await listCollections({ customer_id: customerId })
    setIsLoadingOrderPayments(false)
    if (!result.success) {
      setOrderPayments([])
      setOrderPaymentsError(result.error)
      return
    }
    setOrderPayments(result.collections)
  }

  useEffect(() => {
    loadOrderPayments(order?.customerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.customerId])

  // Resolve "Created By" - the order only carries a `created_by` user id.
  useEffect(() => {
    if (!order?.id) {
      setCreator(null)
      return
    }
    // Demo orders (and any future expanded API payload) carry the name/role inline.
    if (order.createdByName) {
      setCreator({ name: order.createdByName, role: order.createdByRole || '' })
      return
    }
    const createdById = order.createdById
    if (!createdById) {
      setCreator(null)
      return
    }
    // The creator is the person viewing the order.
    if (currentUser?.id && createdById === currentUser.id) {
      setCreator({ name: currentUser.name || 'You', role: currentUser.role || '' })
      return
    }

    let isMounted = true
    ;(async () => {
      let name = ''
      let role = order.createdByRole || ''

      // Privacy-safe picker (id + name), callable by Admin and Sales Officer alike.
      const staffResult = await listAssignableStaff()
      if (staffResult.success) {
        const match = staffResult.users.find((user) => user.id === createdById)
        if (match) name = match.name || ''
      }

      // Admins can read the full user record for the role (and a name fallback).
      if ((!name || !role) && currentUser?.role === ROLES.ADMIN) {
        const userResult = await getUser(createdById)
        const u = userResult.success ? userResult.user : null
        if (u) {
          name = name || u.display_name || u.name || ''
          role = role || u.role || u.system_role || getSystemRoleFromRoleName(u.role_detail?.name || u.roleDetail?.name || '')
        }
      }

      if (isMounted && (name || role)) setCreator({ name: name || '—', role })
    })()

    return () => {
      isMounted = false
    }
  }, [order?.id, order?.createdById, order?.createdByName, order?.createdByRole, currentUser?.id, currentUser?.name, currentUser?.role])

  useEffect(() => {
    let isMounted = true

    Promise.all([listDeliveryPartners(), listVehicles(), listWarehouses(), getSalesWorkflowSettings()]).then(
      ([partnersResult, vehiclesResult, warehousesResult, settingsResult]) => {
        if (!isMounted) return
        if (partnersResult.success) setDeliveryPartners(partnersResult.partners)
        if (vehiclesResult.success) setVehicles(vehiclesResult.vehicles)
        if (warehousesResult.success) setWarehouses(warehousesResult.warehouses)
        if (settingsResult.success) setInvoiceMode(settingsResult.settings.partialDeliveryInvoiceMode)
      },
    )

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <Card>
        <LoadingSpinner label="Loading order..." />
      </Card>
    )
  }

  if (loadError || !order) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Order not found"
          description={loadError || 'This order may have been removed or the link is out of date.'}
          action={{ label: 'Back to Orders', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const isPickupOrder = isTakeawayOrder(order)
  const delivery = getDeliveryStatus(order)
  const progress = getOrderProgress(order)
  const timeline = buildOrderTimeline(order, { invoices: orderInvoices })
  const source = orderSourceLabel(order)
  const actions = getOrderActions(order, { invoices: orderInvoices })
  const stockReserved = isStockReserved(order)
  const fulfilmentLabel = getFulfilmentLabel(order)
  const stateMismatch = hasOrderStateMismatch(order)
  const isDelivered = order.fulfilmentStatus === 'delivered'
  const hasDeliveredQuantity = order.items.some((item) => (item.deliveredQuantity || 0) > 0)

  // Demo-only: per-line stock shortages (availableStock is null on real orders).
  const demoShortages = order.items
    .filter((item) => item.availableStock != null && item.quantity > item.availableStock)
    .map((item) => ({ productName: item.productName, required: item.quantity, available: item.availableStock }))
  const demoShortageText = demoShortages
    .map((s) => `${s.productName}: ${s.available} available / ${s.required} required`)
    .join(' · ')

  // Plan Delivery modal pick-lists - demo orders use fixed demo lists, real orders use the fetched ones.
  const planPartnerOptions = (isDemo ? DEMO_DELIVERY_PARTNERS : deliveryPartners).map((p) => ({ value: p.id, label: p.name }))
  // Only operationally-usable (active) vehicles can be picked for a delivery - inactive /
  // maintenance vehicles are excluded (backend also blocks them).
  const planVehicleOptions = (isDemo ? DEMO_VEHICLES : vehicles)
    .filter((v) => {
      const status = String(v.status || (v.isActive === false ? 'inactive' : 'active')).toLowerCase()
      return status === 'active'
    })
    .map((v) => ({ value: v.id, label: v.vehicleNumber }))
  const planWarehouseOptions = (isDemo ? DEMO_WAREHOUSES : warehouses).map((w) => ({ value: w.id, label: w.name }))
  const demoInvoice = isDemo ? orderInvoices[0]?.demo || (order.invoiceId ? buildDemoInvoice(order) : null) : null
  const demoDelivery = isDemo ? buildDemoDelivery(order) : null

  const applyDemo = (partial) => {
    patchDemoOrder(order.id, partial)
    setOrder((current) => ({ ...current, ...partial, updatedAt: new Date().toISOString() }))
  }

  const runAction = async (action) => {
    setIsActing(true)
    setActionError('')

    const result = await action()

    if (!result.success) {
      setActionError(result.error)
      setIsActing(false)
      return false
    }

    setOrder(result.order)
    setIsActing(false)
    return true
  }

  const handleConfirm = async () => {
    if (isDemo) {
      // POST /orders/{id}/confirm validates + reserves stock. Any shortage is rejected
      // outright - the order stays a Draft with nothing reserved (no partial reservation).
      if (demoShortages.length > 0) {
        setActionError(`Insufficient stock for one or more items — ${demoShortageText}. The order stays a Draft; restock and try again.`)
        showToast({ title: 'Insufficient stock', message: 'Confirmation was blocked. The order is still a Draft.', variant: 'error' })
        return
      }
      applyDemo({
        status: 'confirmed',
        fulfilmentStatus: 'reserved',
        approvedAt: new Date().toISOString(),
        items: order.items.map((item) => ({ ...item, reservedQuantity: item.quantity })),
      })
      showToast({ title: 'Order confirmed', message: 'Stock has been reserved for this order.' })
      return
    }
    const ok = await runAction(() => confirmOrder(order.id))
    // Re-fetch so the badge / stepper / actions all reflect the authoritative post-confirm
    // state (the confirm response can be partial), and any state mismatch resolves.
    if (ok) await loadOrder()
  }

  const handleCancel = async () => {
    if (!cancelReason) {
      setActionError('Select a cancellation reason.')
      return
    }
    const combined = cancelNotes.trim() ? `${cancelReason} — ${cancelNotes.trim()}` : cancelReason

    if (isDemo) {
      applyDemo({ status: 'cancelled', rejectReason: combined })
      setIsCancelModalOpen(false)
      setCancelReason('')
      setCancelNotes('')
      showToast({ title: 'Order cancelled', message: `${order.orderNumber} was cancelled.` })
      return
    }

    const ok = await runAction(() => cancelOrder(order.id, combined))
    if (ok) {
      setIsCancelModalOpen(false)
      setCancelReason('')
      setCancelNotes('')
    }
  }

  const openPlanModal = () => {
    setPlanForm({
      deliveryPartnerId: order.assignedDeliveryPartnerId || '',
      vehicleId: '',
      warehouseId: (isDemo ? DEMO_WAREHOUSES[0]?.id : order.warehouseId) || '',
      scheduledDate: order.deliveryDate ? order.deliveryDate.slice(0, 10) : '',
      deliveryAddress: order.deliveryAddress || '',
    })
    setPlanItemQuantities(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])))
    setPlanError('')
    setIsPlanModalOpen(true)
  }

  const handlePlanDelivery = async () => {
    if (!planForm.deliveryPartnerId) {
      setPlanError('Select a delivery partner.')
      return
    }
    if (!planForm.warehouseId) {
      setPlanError('Select a warehouse.')
      return
    }

    if (isDemo) {
      const partner = planPartnerOptions.find((p) => p.value === planForm.deliveryPartnerId)
      const vehicle = planVehicleOptions.find((v) => v.value === planForm.vehicleId)
      const wh = planWarehouseOptions.find((w) => w.value === planForm.warehouseId)
      applyDemo({
        fulfilmentStatus: 'planned',
        assignedDeliveryPartnerId: planForm.deliveryPartnerId,
        assignedDeliveryPartnerName: partner?.label || 'Delivery Partner',
        deliveryId: `demo-dlv-${order.id}`,
        deliveryNumber: `DLV-DEMO-${String(order.orderNumber || '').replace(/^SO-DEMO-/, '')}`,
        deliveryAddress: planForm.deliveryAddress || order.deliveryAddress,
        demoDelivery: {
          vehicle: vehicle?.label || '',
          warehouse: wh?.label || order.warehouseName,
          scheduledDate: planForm.scheduledDate || order.deliveryDate,
        },
      })
      setIsPlanModalOpen(false)
      showToast({ title: 'Delivery planned', message: `Assigned to ${partner?.label || 'a delivery partner'}.` })
      return
    }

    setIsPlanning(true)
    setPlanError('')

    const result = await planDelivery({
      orderId: order.id,
      deliveryPartnerId: planForm.deliveryPartnerId,
      vehicleId: planForm.vehicleId || undefined,
      warehouseId: planForm.warehouseId,
      scheduledDate: planForm.scheduledDate || undefined,
      deliveryAddress: planForm.deliveryAddress || undefined,
      items: order.items.map((item) => ({ orderItemId: item.id, plannedQuantity: planItemQuantities[item.id] ?? item.quantity })),
    })

    setIsPlanning(false)

    if (!result.success) {
      setPlanError(result.error)
      return
    }

    setIsPlanModalOpen(false)
    navigate(`/admin/deliveries/${result.delivery?.id || order.deliveryId}`)
  }

  const handlePickupStart = async () => {
    if (isDemo) {
      applyDemo({ pickupStatus: 'picking', fulfilmentStatus: 'reserved' })
      showToast({ title: 'Pickup preparation started', message: 'Items are being picked for collection.' })
      return
    }
    await runAction(() => pickupStart(order.id))
  }

  const handlePickupReady = async () => {
    if (isDemo) {
      applyDemo({ pickupStatus: 'ready', fulfilmentStatus: 'reserved' })
      showToast({ title: 'Ready for pickup', message: 'The customer can now collect this order.' })
      return
    }
    await runAction(() => pickupReady(order.id))
  }

  const openPickupConfirmModal = () => {
    setPickupItemQuantities(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])))
    setCollectedBy('')
    setPickupNotesInput('')
    setPickupError('')
    setIsPickupConfirmModalOpen(true)
  }

  const handleConfirmPickup = async () => {
    if (isDemo) {
      // POST /orders/{id}/pickup/confirm = fulfilment complete. The order is Completed now,
      // independent of whether an invoice exists (invoicing is a separate workflow).
      applyDemo({
        pickupStatus: 'collected',
        fulfilmentStatus: 'delivered',
        status: 'completed',
        collectedBy: collectedBy.trim() || order.customerName,
        collectedAt: new Date().toISOString(),
        pickupNotes: pickupNotesInput.trim(),
        items: order.items.map((item) => ({ ...item, deliveredQuantity: item.quantity, remainingQuantity: 0 })),
      })
      setIsPickupConfirmModalOpen(false)
      showToast({ title: 'Pickup confirmed', message: `${order.orderNumber} has been collected.` })
      return
    }

    setIsConfirmingPickup(true)
    setPickupError('')

    const result = await pickupConfirm(order.id, {
      items: order.items.map((item) => ({ orderItemId: item.id, collectedQuantity: pickupItemQuantities[item.id] ?? item.quantity })),
      collectedBy: collectedBy.trim() || undefined,
      notes: pickupNotesInput.trim() || undefined,
    })

    setIsConfirmingPickup(false)

    if (!result.success) {
      setPickupError(result.error)
      return
    }

    setOrder(result.order)
    setIsPickupConfirmModalOpen(false)
  }

  const goToDelivery = () => {
    if (isDemo) {
      setIsViewDeliveryOpen(true)
      return
    }
    navigate(`/admin/deliveries/${order.deliveryId}`)
  }

  const handleViewInvoice = () => {
    if (isDemo) {
      setIsViewInvoiceOpen(true)
      return
    }
    navigate(`/admin/invoices/${firstInvoice.id}`)
  }

  const handleCreateInvoice = () => {
    if (isDemo) {
      const invoiceNumber = `INV-DEMO-${String(order.orderNumber || '').replace(/^SO-DEMO-/, '')}`
      // Invoicing is a separate workflow - it never changes the Order lifecycle status.
      // Completion comes only from delivery / pickup confirmation.
      const patch = {
        invoiceId: `demo-inv-${order.id}`,
        invoiceNumber,
        demoInvoice: buildDemoInvoice({ ...order, invoiceNumber }),
      }
      applyDemo(patch)
      setOrderInvoices([{ id: patch.invoiceId, invoiceNumber, deliveryId: null, demo: patch.demoInvoice }])
      showToast({ title: 'Invoice created', message: `${invoiceNumber} has been generated.` })
      return
    }
    navigate(`/admin/invoices/new?orderId=${order.id}`)
  }

  const handleDuplicate = () => {
    if (isDemo) {
      const newId = duplicateDemoOrder(order)
      showToast({ title: 'Order duplicated', message: 'A new draft copy has been created.' })
      navigate(`${basePath}/${newId}`)
      return
    }
    navigate(`${basePath}/create?from=${order.id}`)
  }

  const canCreateInvoiceNow = invoiceMode === 'after_full_order' ? isDelivered : hasDeliveredQuantity
  const firstInvoice = orderInvoices[0]

  const primaryActions = (<>
          {actions.includes('viewDelivery') && (
            <Button variant="outline" size="sm" className="od-view-delivery-action" onClick={goToDelivery}>
              <Truck className="size-4" aria-hidden="true" />
              View Delivery
            </Button>
          )}
          {!actions.includes('viewDelivery') && (
            <Button variant="outline" size="sm" className="od-view-delivery-action" disabled title={isPickupOrder ? 'Takeaway orders do not have a delivery record' : 'No delivery is available yet'}>
              <Truck className="size-4" aria-hidden="true" />
              View Delivery
            </Button>
          )}
          {!actions.includes('createInvoice') && !(actions.includes('viewInvoice') && hasMoreToInvoice) && (
            <Button variant="primary" size="sm" className="od-invoice-action od-generate-action" disabled title={firstInvoice ? 'Invoice already generated. Open it from More Actions.' : 'Invoice generation is unavailable at this order stage'}>
              <FileText className="size-4" aria-hidden="true" />
              Generate Invoice
            </Button>
          )}
          {actions.includes('viewInvoice') && hasMoreToInvoice && (
            <Button variant="primary" size="sm" className="od-invoice-action od-generate-action" onClick={handleCreateInvoice}>
              <FileText className="size-4" aria-hidden="true" />
              Generate Invoice
            </Button>
          )}
          {actions.includes('createInvoice') && (
            <Button
              variant="primary"
              className="od-invoice-action od-generate-action"
              size="sm"
              disabled={!isDemo && !canCreateInvoiceNow}
              title={!isDemo && !canCreateInvoiceNow ? 'Complete a delivery before invoicing this order' : undefined}
              onClick={handleCreateInvoice}
            >
              <FileText className="size-4" aria-hidden="true" />
              Generate Invoice
            </Button>
          )}
  </>)

  const moreActions = (<>
          {actions.includes('viewInvoice') && firstInvoice && (
            <Button variant="outline" size="sm" title={firstInvoice.invoiceNumber || 'View invoice'} onClick={handleViewInvoice}>
              <FileText className="size-4" aria-hidden="true" />
              {orderInvoices.length > 1 ? `View Invoices (${orderInvoices.length})` : 'View Invoice'}
            </Button>
          )}
          {actions.includes('edit') && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`${basePath}/${order.id}/edit`)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          )}
          {actions.includes('confirm') && (
            <Button variant="primary" size="sm" loading={isActing} onClick={handleConfirm}>
              <Check className="size-4" aria-hidden="true" />
              Confirm Order
            </Button>
          )}
          {actions.includes('planDelivery') && (
            <Button variant="outline" size="sm" onClick={openPlanModal}>
              <Truck className="size-4" aria-hidden="true" />
              Plan Delivery
            </Button>
          )}
          {actions.includes('pickupStart') && (
            <Button variant="outline" size="sm" loading={isActing} onClick={handlePickupStart}>
              <PackageSearch className="size-4" aria-hidden="true" />
              Start Pickup
            </Button>
          )}
          {actions.includes('pickupReady') && (
            <Button variant="outline" size="sm" loading={isActing} onClick={handlePickupReady}>
              <PackageCheck className="size-4" aria-hidden="true" />
              Mark Ready for Pickup
            </Button>
          )}
          {actions.includes('confirmPickup') && (
            <Button variant="primary" size="sm" onClick={openPickupConfirmModal}>
              <Store className="size-4" aria-hidden="true" />
              Confirm Pickup
            </Button>
          )}
          {canRecordPayment && order.paymentStatus && (order.remainingAmount || 0) > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsCollectPaymentOpen(true)}>
              <Wallet className="size-4" aria-hidden="true" />
              Record Payment
            </Button>
          )}
          {actions.includes('cancel') && (
            <Button variant="danger" size="sm" onClick={() => setIsCancelModalOpen(true)}>
              <Ban className="size-4" aria-hidden="true" />
              Cancel Order
            </Button>
          )}
          {actions.includes('duplicate') && (
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="size-4" aria-hidden="true" />
              Duplicate Order
            </Button>
          )}
  </>)

  const alerts = (<>
      {actionError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {stateMismatch && (!isDemo || order.demoErrorState) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Order state mismatch.</p>
          <p className="mt-0.5 text-amber-700">
            This order still reads <span className="font-medium">{formatOrderStatus(order.status)}</span>, but its
            fulfilment has already advanced ({stockReserved ? 'stock reserved' : 'fulfilment in progress'}).{' '}
            {order.demoErrorState
              ? 'This is an intentional DEMO ERROR STATE record used to verify this banner — Refresh will not clear it.'
              : 'The backend likely has it further along. Confirm Order is hidden because the backend would reject it. Refresh the page; if it stays inconsistent, report it to support.'}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={loadOrder}>Refresh</Button>
        </div>
      )}

      {order.status === 'confirmed' && !stockReserved && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Insufficient Stock — stock could not be reserved at confirmation.</p>
          {demoShortageText && <p className="mt-0.5">{demoShortageText}</p>}
          <p className="mt-0.5 text-amber-700">Cancel and recreate the order once stock is available.</p>
        </div>
      )}

      {order.status === 'draft' && demoShortages.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Insufficient Stock for this draft.</p>
          <p className="mt-0.5">{demoShortageText}</p>
          <p className="mt-0.5 text-amber-700">Confirmation will be blocked until more stock is available.</p>
        </div>
      )}

      {order.rejectReason && order.status === 'cancelled' && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Cancelled: {order.rejectReason}
        </div>
      )}

      {order.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {order.warnings.map((warning, index) => (
            <p key={index}>{typeof warning === 'string' ? warning : JSON.stringify(warning)}</p>
          ))}
        </div>
      )}


  </>)

  const paymentHistory = (<>
      <Card title="Payment History" className="p-0" bodyClassName="p-0">
        {isLoadingOrderPayments ? (
          <div className="p-5">
            <LoadingSpinner label="Loading payment history..." />
          </div>
        ) : orderPaymentsError ? (
          <div className="p-5 text-center">
            <p className="text-sm text-red-600">{orderPaymentsError}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => loadOrderPayments(order.customerId)}>
              Retry
            </Button>
          </div>
        ) : orderPayments.length === 0 ? (
          <p className="p-5 text-center text-sm text-neutral-400">No payments recorded for this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-2.5">Payment Date</th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right">Amount</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Payment Method</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Collected By</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Collector Role</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {orderPayments.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDate(payment.recordedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-neutral-900">{formatCurrency(payment.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatPaymentMode(payment.paymentMode)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-800">{payment.recordedByName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{formatCollectorRole(payment.recordedByRole) || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={COLLECTION_STATUS_VARIANT[payment.status] || 'neutral'}>{formatCollectionStatus(payment)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>


  </>)

  const returns = (<>
      {(() => {
        // Mirror the backend: no sales_returns:view -> no returns context on the order at all.
        if (!canViewReturns) return null
        const salesReturnsBase = isSalesPath ? '/sales/sales-returns' : '/admin/sales-returns'
        const orderDelivered =
          order.status === 'completed' || ['delivered', 'partially_delivered'].includes(order.fulfilmentStatus)
        const canCreateReturn =
          orderDelivered &&
          order.status !== 'cancelled' &&
          (isDemo || Boolean(firstInvoice)) &&
          canCreateReturns
        if (orderReturns.length === 0 && !canCreateReturn) return null
        return (
          <Card
            title="Returns"
            subtitle="Goods sent back by the customer against this order"
            actions={
              canCreateReturn ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(
                      firstInvoice
                        ? `${salesReturnsBase}/new?invoice=${encodeURIComponent(firstInvoice.id)}`
                        : `${salesReturnsBase}/new`,
                    )
                  }
                >
                  <Undo2 className="size-4" aria-hidden="true" />
                  Create Sales Return
                </Button>
              ) : null
            }
          >
            {orderReturns.length === 0 ? (
              <p className="text-sm text-neutral-400">No returns raised against this order yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {orderReturns.map((sr) => {
                  const meta = srStatusMeta(sr.status)
                  return (
                    <li key={sr.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                      <button
                        type="button"
                        className="font-medium text-primary-700 hover:underline"
                        onClick={() => navigate(`${salesReturnsBase}/${encodeURIComponent(sr.id)}`)}
                      >
                        {sr.returnNumber}
                      </button>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-500">Qty {totalReturnQty(sr)}</span>
                        <span className="text-neutral-400">{formatDate(sr.createdAt || sr.returnDate)}</span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        )
      })()}


  </>)

  return (
    <div>
      <OrderDetailView
        order={order}
        creator={creator}
        creatorRole={creator?.role ? roleName(creator.role) : ''}
        delivery={delivery}
        progress={progress}
        timeline={timeline}
        source={source}
        fulfilmentLabel={fulfilmentLabel}
        isPickupOrder={isPickupOrder}
        isDemo={isDemo}
        productMeta={productMeta}
        invoicedByProduct={invoicedByProduct}
        primaryActions={primaryActions}
        moreActions={moreActions}
        alerts={alerts}
        paymentHistory={paymentHistory}
        returns={returns}
        onBack={() => navigate(basePath)}
        onQuotation={() => !isDemo && order.quotationId && navigate(`${quotationsBasePath}/${order.quotationId}`)}
      />

      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => {
          if (isPlanning) return
          setIsPlanModalOpen(false)
        }}
        title="Plan Delivery"
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPlanModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={isPlanning} onClick={handlePlanDelivery}>Plan Delivery</Button>
          </>
        }
      >
        <div className="space-y-4">
          {planError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{planError}</div>
          )}
          <Select
            label="Delivery Partner"
            placeholder="Select a delivery partner"
            options={planPartnerOptions}
            value={planForm.deliveryPartnerId}
            onChange={(event) => setPlanForm((current) => ({ ...current, deliveryPartnerId: event.target.value }))}
          />
          <Select
            label="Vehicle"
            placeholder="Select a vehicle"
            options={planVehicleOptions}
            value={planForm.vehicleId}
            onChange={(event) => setPlanForm((current) => ({ ...current, vehicleId: event.target.value }))}
          />
          <Select
            label="Warehouse"
            placeholder="Select a warehouse"
            options={planWarehouseOptions}
            value={planForm.warehouseId}
            onChange={(event) => setPlanForm((current) => ({ ...current, warehouseId: event.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Scheduled Date</label>
            <input
              type="date"
              value={planForm.scheduledDate}
              onChange={(event) => setPlanForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              className="h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Delivery Address</label>
            <textarea
              value={planForm.deliveryAddress}
              onChange={(event) => setPlanForm((current) => ({ ...current, deliveryAddress: event.target.value }))}
              placeholder="Delivery address (optional)"
              maxLength={500}
              className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Items / Planned Qty</label>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{item.productName}</p>
                    <p className="text-xs text-neutral-400">Ordered: {item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    value={planItemQuantities[item.id] ?? item.quantity}
                    onChange={(event) =>
                      setPlanItemQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                    }
                    onBlur={(event) => {
                      const rounded = Math.round(Number(event.target.value))
                      const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), item.quantity)
                      setPlanItemQuantities((current) => ({ ...current, [item.id]: clamped }))
                    }}
                    className="h-9 w-24 shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isPickupConfirmModalOpen}
        onClose={() => {
          if (isConfirmingPickup) return
          setIsPickupConfirmModalOpen(false)
        }}
        title="Confirm Pickup"
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPickupConfirmModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={isConfirmingPickup} onClick={handleConfirmPickup}>Confirm Pickup</Button>
          </>
        }
      >
        <div className="space-y-4">
          {pickupError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{pickupError}</div>
          )}
          <Input
            label="Collected By (optional)"
            placeholder="Name of the person collecting"
            value={collectedBy}
            onChange={(event) => setCollectedBy(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Collected Quantity</label>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{item.productName}</p>
                    <p className="text-xs text-neutral-400">Ordered: {item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    value={pickupItemQuantities[item.id] ?? item.quantity}
                    onChange={(event) =>
                      setPickupItemQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                    }
                    onBlur={(event) => {
                      const rounded = Math.round(Number(event.target.value))
                      const clamped = Math.min(Math.max(Number.isFinite(rounded) ? rounded : 0, 0), item.quantity)
                      setPickupItemQuantities((current) => ({ ...current, [item.id]: clamped }))
                    }}
                    className="h-9 w-24 shrink-0 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Notes (optional)</label>
            <textarea
              value={pickupNotesInput}
              onChange={(event) => setPickupNotesInput(event.target.value)}
              placeholder="Any additional notes about this pickup"
              maxLength={500}
              className="h-16 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Order">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            This will cancel {order.orderNumber} for {order.customerName}. This action cannot be undone.
          </p>
          <Select
            label="Reason"
            required
            placeholder="Select a reason"
            options={CANCEL_REASONS}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Notes (optional)</label>
            <textarea
              value={cancelNotes}
              onChange={(event) => setCancelNotes(event.target.value)}
              placeholder="Add any context for this cancellation"
              maxLength={500}
              className="h-20 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setIsCancelModalOpen(false)}>Keep Order</Button>
            <Button type="button" variant="danger" loading={isActing} onClick={handleCancel}>Cancel Order</Button>
          </div>
        </div>
      </Modal>

      {/* Demo-only compact Delivery / Invoice views (real orders navigate to the real pages). */}
      <Modal isOpen={isViewDeliveryOpen} onClose={() => setIsViewDeliveryOpen(false)} title="Delivery Details" className="max-w-lg">
        {demoDelivery && (
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-neutral-500">Delivery #</span><span className="font-medium text-neutral-900">{demoDelivery.deliveryNumber}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Delivery Status</span><Badge variant={delivery.variant}>{delivery.label}</Badge></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Delivery Partner</span><span className="font-medium text-neutral-900">{demoDelivery.partnerName}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Vehicle</span><span className="font-medium text-neutral-900">{demoDelivery.vehicle}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Warehouse</span><span className="font-medium text-neutral-900">{demoDelivery.warehouse}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Scheduled Date</span><span className="font-medium text-neutral-900">{formatDate(demoDelivery.scheduledDate)}</span></div>
            <div className="border-t border-neutral-100 pt-3">
              <span className="text-neutral-500">Delivery Address</span>
              <p className="mt-1 whitespace-pre-line text-neutral-700">{demoDelivery.address}</p>
            </div>
            <div className="border-t border-neutral-100 pt-3">
              <span className="text-neutral-500">Items</span>
              <ul className="mt-1.5 space-y-1">
                {demoDelivery.items.map((it, index) => (
                  <li key={index} className="flex items-center justify-between text-neutral-700">
                    <span>{it.productName}</span>
                    <span className="text-neutral-500">Planned {it.planned} · Delivered {it.delivered}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isViewInvoiceOpen} onClose={() => setIsViewInvoiceOpen(false)} title="Invoice Summary" className="max-w-lg">
        {demoInvoice ? (
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between"><span className="text-neutral-500">Invoice Number</span><span className="font-medium text-neutral-900">{demoInvoice.invoiceNumber}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Status</span><Badge variant="success">{demoInvoice.status}</Badge></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Customer</span><span className="font-medium text-neutral-900">{demoInvoice.customerName}</span></div>
            <div className="flex items-center justify-between"><span className="text-neutral-500">Order Reference</span><span className="font-medium text-neutral-900">{demoInvoice.orderNumber}</span></div>
            <div className="border-t border-neutral-100 pt-3">
              <span className="text-neutral-500">Items</span>
              <ul className="mt-1.5 space-y-1">
                {demoInvoice.items.map((it, index) => (
                  <li key={index} className="flex items-center justify-between text-neutral-700">
                    <span>{it.productName} × {it.quantity}</span>
                    <span className="text-neutral-500">{formatCurrency(it.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <div className="flex items-center justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-medium text-neutral-900">{formatCurrency(demoInvoice.subtotal)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Discount</span><span className="font-medium text-red-500">-{formatCurrency(demoInvoice.discount)}</span></div>
              <div className="flex items-center justify-between"><span className="text-neutral-500">Tax</span><span className="font-medium text-neutral-900">{formatCurrency(demoInvoice.tax)}</span></div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-2"><span className="font-semibold text-neutral-900">Total</span><span className="font-semibold text-neutral-900">{formatCurrency(demoInvoice.total)}</span></div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">No invoice on this order yet.</p>
        )}
      </Modal>

      <CollectPaymentDrawer
        isOpen={isCollectPaymentOpen}
        onClose={() => setIsCollectPaymentOpen(false)}
        onRecorded={() => {
          loadOrder()
          loadOrderPayments(order.customerId)
        }}
        initialCustomer={{ id: order.customerId, name: order.customerName, outstandingBalance: order.remainingAmount || 0 }}
        partner={{ id: currentUser?.id, name: currentUser?.name, role: currentUser?.role }}
      />
    </div>
  )
}
