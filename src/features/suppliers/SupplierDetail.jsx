import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Eye, FileText, IndianRupee, Link2, Link2Off, Plus, Power, ShoppingBag, Tag, Trash2, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  deleteSupplier,
  getSupplier,
  getSupplierProductLinks,
  linkSupplierProduct,
  unlinkSupplierProduct,
  updateSupplier,
  updateSupplierStatus,
} from '../../api/suppliers'
import { listProducts } from '../../api/products'
import { listSupplierPurchases } from '../../api/purchases'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import { formatPaymentTerms, normalizeApiSupplier, supplierFormFallback } from './supplierUtils'
import { normalizeApiProduct } from '../products/productUtils'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { getProductId, getSupplierProducts, syncSupplierProductM2M } from './supplierProductUtils'
import {
  demoProducts,
  getDemoSupplier,
  getDemoSupplierDisplayId,
  getDemoSupplierPurchases,
} from './supplierDemoData'
import { getDemoPurchase } from '../purchases/purchaseDemoData'
import { getDemoGrns } from '../purchases/purchaseGrnDemoData'
import { getDemoSupplierInvoicesForSupplier } from '../supplierInvoices/supplierInvoiceDemoData'
import {
  invoiceStatusMeta,
  paymentStatusMeta,
  resolveSupplierInvoice,
  verificationMeta as realVerificationMeta,
} from '../supplierInvoices/supplierInvoiceHelpers'
import { listSupplierInvoices } from '../../api/supplierInvoices'
import SupplierInvoiceQuickView from '../supplierInvoices/SupplierInvoiceQuickView'
import { getSupplierPayments as getDemoSupplierPaymentLedger } from '../supplierPayments/supplierPaymentDemoData'
import { paymentModeLabel, paymentStatusMeta as supplierPaymentStatusMeta } from '../supplierPayments/supplierPaymentHelpers'
import { listSupplierPayments } from '../../api/supplierPayments'
import RecordSupplierPaymentDrawer from '../supplierPayments/RecordSupplierPaymentDrawer'
import SupplierPaymentQuickView from '../supplierPayments/SupplierPaymentQuickView'
import SupplierForm from './SupplierForm'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

function DetailSection({ title, children }) {
  return (
    <Card title={title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

function DetailField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-sm text-neutral-800">{displayValue(value)}</p>
    </div>
  )
}

export default function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const useDemoSuppliers = DEMO_MODE && !DEMO_EMPTY

  const [supplier, setSupplier] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [payments, setPayments] = useState([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [paymentsError, setPaymentsError] = useState('')
  const [products, setProducts] = useState([])
  const [productLinks, setProductLinks] = useState(null)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkProductId, setLinkProductId] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [unlinkBusyId, setUnlinkBusyId] = useState('')
  const [purchases, setPurchases] = useState([])
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true)
  const [purchasesError, setPurchasesError] = useState('')
  const [quickViewInvoiceId, setQuickViewInvoiceId] = useState(null)
  const [paymentsRefresh, setPaymentsRefresh] = useState(0)
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false)
  const [quickViewPaymentId, setQuickViewPaymentId] = useState(null)

  const loadSupplier = async () => {
    setIsLoading(true)
    setLoadError('')

    if (DEMO_MODE) {
      setSupplier(useDemoSuppliers ? getDemoSupplier(id) : null)
      setLoadError(useDemoSuppliers ? '' : 'Demo supplier not found.')
      setIsLoading(false)
      return
    }

    const result = await getSupplier(id)

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      return
    }

    setSupplier(normalizeApiSupplier(result.supplier))
  }

  // Supplier Payments history - canonical `/supplier-payments?supplier_id={id}` (real) or the
  // canonical demo ledger (demo). One shape for both: the Supplier Payments module vocabulary.
  const loadPayments = async () => {
    setIsLoadingPayments(true)
    setPaymentsError('')

    if (DEMO_MODE && !useDemoSuppliers) {
      setPayments([])
      setIsLoadingPayments(false)
      return
    }

    if (useDemoSuppliers) {
      setPayments(
        getDemoSupplierPaymentLedger({ supplierId: id }).map((payment) => {
          const allocated =
            payment.status === 'voided'
              ? 0
              : (payment.allocations || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
          return {
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            paymentDate: payment.paymentDate,
            amount: Number(payment.amount) || 0,
            allocatedAmount: allocated,
            unallocatedAmount: Math.max((Number(payment.amount) || 0) - allocated, 0),
            paymentMethod: payment.paymentMode,
            status: payment.status,
          }
        }),
      )
      setIsLoadingPayments(false)
      return
    }

    const result = await listSupplierPayments({ supplierId: id })

    setIsLoadingPayments(false)

    if (!result.success) {
      setPaymentsError(result.error)
      return
    }

    setPayments(
      result.payments.map((payment) => ({
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        allocatedAmount: payment.allocatedAmount,
        unallocatedAmount: payment.unallocatedAmount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
      })),
    )
  }

  const loadRelatedData = async () => {
    setIsLoadingProducts(true)
    setIsLoadingPurchases(true)
    setPurchasesError('')

    if (DEMO_MODE && !useDemoSuppliers) {
      setProducts([])
      setProductLinks(null)
      setPurchases([])
      setIsLoadingProducts(false)
      setIsLoadingPurchases(false)
      return
    }

    if (useDemoSuppliers) {
      setProducts(demoProducts)
      setProductLinks(null)
      setPurchases(getDemoSupplierPurchases(id))
      setIsLoadingProducts(false)
      setIsLoadingPurchases(false)
      return
    }

    const [productsResult, purchasesResult, linksResult] = await Promise.all([
      listProducts(),
      listSupplierPurchases(id),
      getSupplierProductLinks(id),
    ])
    if (productsResult.success) setProducts(productsResult.products.map((product) => normalizeApiProduct(product)))
    if (purchasesResult.success) setPurchases(purchasesResult.purchases)
    else setPurchasesError(purchasesResult.error)
    // Real Supplier <-> Product M2M list. `null` means "not loaded / demo"; [] is a real empty.
    setProductLinks(linksResult.success ? linksResult.links : [])
    setIsLoadingProducts(false)
    setIsLoadingPurchases(false)
  }

  useEffect(() => {
    loadSupplier()
    loadRelatedData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, useDemoSuppliers])

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, useDemoSuppliers, paymentsRefresh])

  // Real mode: the Products tab is driven by the M2M link list (productLinks). Rows carry the
  // backend's own product_name / product_sku / product_category so no UUIDs are shown even if
  // the product isn't in the loaded `products` list. Demo mode keeps the by-name mapping.
  const supplierProducts = useMemo(() => {
    if (Array.isArray(productLinks)) {
      return productLinks.map((link) => {
        const product = products.find((entry) => String(entry.id) === String(link.productId))
        return {
          id: link.productId,
          name: link.productName || product?.name || link.productId,
          sku: link.productSku || product?.sku || '',
          category: link.productCategory || product?.category || '',
          categoryLabel: link.productCategory || product?.categoryLabel || '',
          status: link.productStatus || product?.status || '',
          variants: product?.variants || [],
        }
      })
    }
    return getSupplierProducts(supplier, products, { demoMode: useDemoSuppliers })
  }, [productLinks, products, supplier, useDemoSuppliers])
  // Derived, not stored - the set of product categories among this supplier's linked products.
  // Reuses the real Product Category master; no separate category system is invented here.
  const supplierProductCategories = useMemo(
    () => [...new Set(supplierProducts.map((product) => product.categoryLabel || product.category).filter(Boolean))],
    [supplierProducts],
  )
  const lastPurchase = useMemo(
    () => purchases.reduce((latest, purchase) => {
      if (!latest) return purchase
      return new Date(purchase.purchaseDate || purchase.invoiceDate || 0) > new Date(latest.purchaseDate || latest.invoiceDate || 0)
        ? purchase
        : latest
    }, null),
    [purchases],
  )
  const [realSupplierInvoices, setRealSupplierInvoices] = useState([])
  useEffect(() => {
    if (useDemoSuppliers || !id) return
    let active = true
    listSupplierInvoices({ supplierId: id }).then((result) => {
      if (active && result.success) {
        setRealSupplierInvoices(
          result.invoices.map((invoice) => ({
            id: invoice.id,
            supplierInvoiceNumber: invoice.supplierInvoiceNumber,
            invoiceDate: invoice.invoiceDate,
            purchaseNumber: invoice.purchaseNumber,
            invoiceStatus: invoice.status,
            paymentStatus: invoice.paymentStatus,
            invoiceTotal: invoice.grandTotal,
            amountPaid: invoice.amountPaid,
            outstanding: invoice.outstandingAmount,
            match: invoice.verificationStatus ? realVerificationMeta(invoice.verificationStatus) : null,
          })),
        )
      }
    })
    return () => {
      active = false
    }
  }, [id, useDemoSuppliers])

  const supplierInvoices = useMemo(
    () =>
      useDemoSuppliers
        ? getDemoSupplierInvoicesForSupplier(id).map((invoice) =>
            resolveSupplierInvoice(invoice, {
              purchase: invoice.purchaseId ? getDemoPurchase(invoice.purchaseId) : null,
              grns: invoice.purchaseId ? getDemoGrns(invoice.purchaseId) : [],
            }),
          )
        : realSupplierInvoices,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, useDemoSuppliers, paymentsRefresh, realSupplierInvoices],
  )
  // Demo only: keep the payable stat cards coherent with Accounts Payable / Supplier Invoices,
  // which are the source of truth for what has actually been paid. Baseline figures already
  // match the supplier fixture; this makes them track simulated payments too.
  const demoPayableTotals = useMemo(() => {
    if (!useDemoSuppliers || supplierInvoices.length === 0) return null
    return {
      totalPaid: supplierInvoices.reduce((sum, invoice) => sum + (Number(invoice.amountPaid) || 0), 0),
      outstandingPayable: supplierInvoices.reduce((sum, invoice) => sum + (Number(invoice.outstanding) || 0), 0),
    }
  }, [useDemoSuppliers, supplierInvoices])

  if (isLoading) {
    return <LoadingSpinner label="Loading supplier details..." />
  }

  if (!supplier) {
    return (
      <Card>
        <EmptyState
          icon={ShoppingBag}
          title="Supplier not found"
          description={loadError || 'This supplier may have been deleted or the link is out of date.'}
          action={{ label: 'Back to Suppliers', onClick: () => navigate('/admin/suppliers') }}
        />
      </Card>
    )
  }

  const handleSaveSupplier = async (supplierData) => {
    setIsSaving(true)
    setFormError('')

    if (DEMO_MODE) {
      setSupplier((current) => ({ ...current, ...supplierData, id: current.id }))
      setIsSaving(false)
      setIsFormOpen(false)
      return
    }

    const result = await updateSupplier(supplier.id, supplierData)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    let savedSupplier = result.supplier
    const desiredIsActive = supplierData.status !== 'inactive'
    const currentIsActive = supplier.status === 'active'
    if (desiredIsActive !== currentIsActive) {
      const statusResult = await updateSupplierStatus(supplier.id, desiredIsActive)
      if (!statusResult.success) {
        setFormError(statusResult.error)
        return
      }
      savedSupplier = statusResult.supplier
    }

    setSupplier(normalizeApiSupplier(savedSupplier, supplierFormFallback(supplierData, supplier.id)))
    setIsFormOpen(false)
    // Reload the supplier record from the backend so server-managed fields stay authoritative.
    loadSupplier()

    // Products Supplied -> Supplier <-> Product M2M links. The supplier's own fields already
    // saved above, so a link failure is reported separately rather than rolled back or hidden.
    const syncResult = await syncSupplierProductM2M(supplier.id, {
      previousProducts: supplierProducts.map((product) => ({ id: product.id, name: product.name })),
      nextProducts: supplierData.productsSupplied || [],
    })
    if (syncResult.attempted > 0) {
      await loadRelatedData()
      if (!syncResult.success) {
        showToast({
          title: 'Supplier saved, but product links need attention',
          message: `${syncResult.failed.length} of ${syncResult.attempted} product link update${syncResult.attempted === 1 ? '' : 's'} failed. Edit this supplier again to retry.`,
          variant: 'error',
        })
      }
    }
  }

  const handleToggleStatus = async () => {
    const nextIsActive = supplier.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

    if (DEMO_MODE) {
      setSupplier((current) => ({ ...current, status: nextIsActive ? 'active' : 'inactive' }))
      setIsUpdatingStatus(false)
      setIsStatusModalOpen(false)
      return
    }

    const result = await updateSupplierStatus(supplier.id, nextIsActive)

    setIsUpdatingStatus(false)

    if (!result.success) {
      setStatusError(result.error)
      return
    }

    setSupplier(normalizeApiSupplier(result.supplier, supplier))
    setIsStatusModalOpen(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError('')

    if (DEMO_MODE) {
      setIsDeleting(false)
      navigate('/admin/suppliers')
      return
    }

    const result = await deleteSupplier(supplier.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    navigate('/admin/suppliers')
  }

  // ---- Products tab M2M link management (real mode) ------------------------------------------
  const linkedProductIdSet = new Set((supplierProducts || []).map((product) => String(product.id)))
  const linkableProducts = products.filter((product) => !linkedProductIdSet.has(String(product.id)))

  const handleLinkProduct = async () => {
    if (!linkProductId) return
    setIsLinking(true)
    setLinkError('')
    if (DEMO_MODE) {
      showToast({ title: 'Demo mode', message: 'Product links are simulated in demo mode.' })
      setIsLinking(false)
      setLinkModalOpen(false)
      setLinkProductId('')
      return
    }
    const result = await linkSupplierProduct(supplier.id, linkProductId)
    setIsLinking(false)
    if (!result.success) {
      if (result.alreadyLinked) {
        setLinkError('This product is already linked to this supplier.')
        return
      }
      setLinkError(result.error)
      return
    }
    setLinkModalOpen(false)
    setLinkProductId('')
    await loadRelatedData()
  }

  const handleUnlinkProduct = async (product) => {
    const productId = getProductId(product)
    setUnlinkBusyId(productId)
    if (DEMO_MODE) {
      showToast({ title: 'Demo mode', message: 'Product links are simulated in demo mode.' })
      setUnlinkBusyId('')
      return
    }
    const result = await unlinkSupplierProduct(supplier.id, productId)
    setUnlinkBusyId('')
    if (!result.success) {
      showToast({ title: 'Unable to unlink product', message: result.error, variant: 'error' })
      return
    }
    await loadRelatedData()
  }

  if (isFormOpen) {
    // Preselect the products currently linked to this supplier so Edit doesn't open with an
    // empty picker. Real mode gets these from the Supplier <-> Product M2M list.
    const supplierForForm = {
      ...supplier,
      productsSupplied: supplierProducts.map((product) => ({ id: product.id, name: product.name })),
    }
    return (
      <SupplierForm
        isOpen={isFormOpen}
        onClose={() => {
          if (isSaving) return
          setFormError('')
          setIsFormOpen(false)
        }}
        supplier={supplierForForm}
        onSave={handleSaveSupplier}
        saving={isSaving}
        formError={formError}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/suppliers')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{supplier.name}</h1>
              <Badge variant={supplier.status === 'active' ? 'success' : 'neutral'}>
                {supplier.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {supplier.category && <Badge variant="primary">{supplier.category}</Badge>}
              {supplier.city && <span className="text-xs text-neutral-400">{supplier.city}</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
            <Edit className="size-4" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsStatusModalOpen(true)}>
            <Power className="size-4" aria-hidden="true" />
            {supplier.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setIsDeleteModalOpen(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="success" label="Total Purchases" value={formatCurrency(supplier.totalPurchases)} />
        <StatCard icon={Wallet} iconVariant="primary" label="Total Paid" value={formatCurrency(demoPayableTotals?.totalPaid ?? supplier.totalPaid)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(demoPayableTotals?.outstandingPayable ?? supplier.outstandingPayable)} />
        <StatCard icon={FileText} iconVariant="info" label="Last Purchase" value={formatDate(lastPurchase?.purchaseDate || lastPurchase?.invoiceDate)} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="supplier-invoices">Supplier Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents / Notes</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4 space-y-4">

      <Card title="Basic Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Supplier ID" value={useDemoSuppliers ? getDemoSupplierDisplayId(supplier.id) : supplier.id} />
          <DetailField label="Supplier Type" value={supplier.category} />
          <DetailField label="Status" value={supplier.status === 'active' ? 'Active' : 'Inactive'} />
          <DetailField label="Created On" value={supplier.createdAt ? formatDateTime(supplier.createdAt) : null} />
          <DetailField label="Last Updated" value={supplier.updatedAt ? formatDateTime(supplier.updatedAt) : null} />
          {supplier.supplierCategories?.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Supplier Category</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {supplier.supplierCategories.map((entry) => (
                  <Badge key={entry} variant="neutral">{entry}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Contact Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailField label="Contact Person" value={supplier.contactPerson} />
          <DetailField label="Phone" value={supplier.phone} />
          <DetailField label="Email" value={supplier.email} />
        </div>
      </Card>

      <DetailSection title="Tax Information">
        <DetailField label="GST Registered" value={supplier.gstNumber ? 'Yes' : 'No'} />
        <DetailField label="GSTIN" value={supplier.gstNumber} />
        <DetailField label="PAN" value={supplier.pan} />
      </DetailSection>

      <DetailSection title="Address">
        <DetailField label="Address" value={supplier.address} className="sm:col-span-2" />
        <DetailField label="City" value={supplier.city} />
        <DetailField label="State" value={supplier.state} />
        <DetailField label="PIN" value={supplier.pinCode} />
        <DetailField label="Country" value={supplier.country} />
      </DetailSection>

      <DetailSection title="Commercial Terms">
        <DetailField label="Opening Payable Balance" value={formatCurrency(supplier.openingBalance)} />
        <DetailField label="Payment Terms" value={formatPaymentTerms(supplier.paymentTerms)} />
        <DetailField label="Credit Limit" value={supplier.creditLimit ? formatCurrency(supplier.creditLimit) : null} />
        <DetailField label="Purchase Currency" value={supplier.purchaseCurrency} />
      </DetailSection>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card
            title="Products"
            subtitle="Products linked to this supplier. Managing links here does not change the product master."
            className="p-0"
            bodyClassName="p-0"
            actions={
              <Button type="button" size="sm" onClick={() => { setLinkError(''); setLinkProductId(''); setLinkModalOpen(true) }}>
                <Link2 className="size-4" aria-hidden="true" />
                Link Product
              </Button>
            }
          >
            {supplierProductCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 px-5 py-3.5">
                <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  <Tag className="size-3.5" aria-hidden="true" />
                  Product Categories Supplied
                </span>
                {supplierProductCategories.map((entry) => (
                  <Badge key={entry} variant="primary">{entry}</Badge>
                ))}
              </div>
            )}
            {isLoadingProducts ? <LoadingSpinner label="Loading supplier products..." /> : supplierProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-500">No products are currently linked to this supplier.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead><tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400"><th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-neutral-50">
                    {supplierProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{product.name}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{displayValue(product.sku)}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{displayValue(product.categoryLabel || product.category)}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={product.status === 'active' ? 'success' : 'neutral'}>{product.status || '—'}</Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button type="button" variant="ghost" size="sm" loading={unlinkBusyId === getProductId(product)} onClick={() => handleUnlinkProduct(product)}>
                            <Link2Off className="size-4" aria-hidden="true" />
                            Unlink
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card
            title="Purchase History"
            subtitle={purchases.length > 0 ? `${purchases.length} purchase order${purchases.length === 1 ? '' : 's'} on file for this supplier.` : 'Purchases loaded for this supplier.'}
            className="p-0"
            bodyClassName="p-0"
          >
            {purchasesError ? <div className="px-5 py-8 text-center text-sm text-red-600">{purchasesError}</div> : isLoadingPurchases ? <LoadingSpinner label="Loading purchase history..." /> : purchases.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-500">No purchases found for this supplier.</p>
            ) : (
              <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400"><th className="px-5 py-3">Purchase #</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Warehouse</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Receiving Status</th><th className="px-5 py-3">Payment Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-neutral-50">{purchases.map((purchase) => <tr key={purchase.id} className="hover:bg-primary-50/35"><td className="px-5 py-3.5 font-medium text-neutral-900">{displayValue(purchase.invoiceNumber)}</td><td className="px-5 py-3.5 text-neutral-600">{formatDate(purchase.purchaseDate || purchase.invoiceDate)}</td><td className="px-5 py-3.5 text-neutral-600">{displayValue(purchase.warehouseId)}</td><td className="px-5 py-3.5 font-medium text-neutral-900">{formatCurrency(purchase.total)}</td><td className="px-5 py-3.5"><Badge variant="neutral">{displayValue(purchase.receivingStatus || purchase.purchaseStatus)}</Badge></td><td className="px-5 py-3.5"><Badge variant="neutral">{displayValue(purchase.paymentStatus)}</Badge></td><td className="px-5 py-3.5 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => navigate('/admin/purchases')}><Eye className="size-4" aria-hidden="true" /> View Purchase</Button></td></tr>)}</tbody></table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="supplier-invoices" className="mt-4">
          <Card
            title="Supplier Invoices"
            subtitle={`${supplierInvoices.length} supplier invoice${supplierInvoices.length === 1 ? '' : 's'} on file.`}
            className="p-0"
            bodyClassName="p-0"
          >
            {supplierInvoices.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-500">No supplier invoices recorded for this supplier yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-4xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                      <th className="px-5 py-3">Supplier Invoice #</th>
                      <th className="px-5 py-3">Invoice Date</th>
                      <th className="px-5 py-3">Purchase #</th>
                      <th className="px-5 py-3 text-right">Invoice Total</th>
                      <th className="px-5 py-3 text-right">Outstanding</th>
                      <th className="px-5 py-3">Payment Status</th>
                      <th className="px-5 py-3">Invoice Status</th>
                      <th className="px-5 py-3">Verification</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {supplierInvoices.map((invoice) => {
                      const invStatus = invoiceStatusMeta(invoice.invoiceStatus)
                      const payStatus = paymentStatusMeta(invoice.paymentStatus)
                      return (
                        <tr key={invoice.id} className="hover:bg-primary-50/35">
                          <td className="px-5 py-3.5 font-medium text-primary-700">{invoice.supplierInvoiceNumber}</td>
                          <td className="px-5 py-3.5 text-neutral-600">{formatDate(invoice.invoiceDate)}</td>
                          <td className="px-5 py-3.5 text-neutral-600">{invoice.purchaseNumber || '—'}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(invoice.invoiceTotal)}</td>
                          <td className="px-5 py-3.5 text-right text-neutral-700">{formatCurrency(invoice.outstanding)}</td>
                          <td className="px-5 py-3.5"><Badge variant={payStatus.variant} dot>{payStatus.label}</Badge></td>
                          <td className="px-5 py-3.5"><Badge variant={invStatus.variant}>{invStatus.label}</Badge></td>
                          <td className="px-5 py-3.5">{invoice.match ? <Badge variant={invoice.match.variant}>{invoice.match.label}</Badge> : <span className="text-neutral-400">—</span>}</td>
                          <td className="px-5 py-3.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                useDemoSuppliers
                                  ? setQuickViewInvoiceId(invoice.id)
                                  : navigate(`/admin/supplier-invoices/${invoice.id}`)
                              }
                            >
                              <Eye className="size-4" aria-hidden="true" /> {useDemoSuppliers ? 'Quick View' : 'Open'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
      <Card
        title="Payments"
        subtitle="Every payment recorded against this supplier"
        className="p-0"
        bodyClassName="p-0"
        actions={
          <Button type="button" size="sm" onClick={() => setRecordDrawerOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Record Payment
          </Button>
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
            <p className="py-8 text-center text-sm text-neutral-500">No supplier payments recorded for this supplier yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="whitespace-nowrap px-5 py-3">Payment #</th>
                    <th className="whitespace-nowrap px-5 py-3">Payment Date</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Amount</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Allocated</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Unallocated</th>
                    <th className="whitespace-nowrap px-5 py-3">Method</th>
                    <th className="whitespace-nowrap px-5 py-3">Status</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {payments.map((payment) => {
                    const status = supplierPaymentStatusMeta(payment.status)
                    return (
                      <tr
                        key={payment.id}
                        className="cursor-pointer transition-colors hover:bg-primary-50/35"
                        onClick={() => setQuickViewPaymentId(payment.id)}
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 font-medium text-primary-700">{payment.paymentNumber || '—'}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{formatDate(payment.paymentDate)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">{formatCurrency(payment.amount)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-700">{formatCurrency(payment.allocatedAmount)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-700">{formatCurrency(payment.unallocatedAmount)}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{paymentModeLabel(payment.paymentMethod)}</td>
                        <td className="px-5 py-3.5"><Badge variant={status.variant}>{status.label}</Badge></td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setQuickViewPaymentId(payment.id)}>
                            <Eye className="size-4" aria-hidden="true" />
                            View
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-4">
          <Card
            title="Notes"
            subtitle="Internal notes on this supplier."
            actions={
              <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
                <Edit className="size-4" aria-hidden="true" />
                Edit
              </Button>
            }
          >
            {supplier.notes ? (
              <p className="whitespace-pre-line text-sm leading-6 text-neutral-700">{supplier.notes}</p>
            ) : (
              <p className="text-sm text-neutral-500">No notes recorded. Use Edit Supplier to add notes.</p>
            )}
          </Card>

          <Card title="Documents" subtitle="Supplier document storage.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {['GST Certificate', 'PAN', 'Agreement', 'Other'].map((type) => (
                <div key={type} className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-4">
                  <p className="text-sm font-medium text-neutral-800">{type}</p>
                  <p className="mt-1 text-xs text-neutral-500">No document uploaded</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Supplier document management will be available after the Supplier Documents module is enabled.
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <SupplierInvoiceQuickView
        invoiceId={quickViewInvoiceId}
        isOpen={Boolean(quickViewInvoiceId)}
        onClose={() => setQuickViewInvoiceId(null)}
        onOpenFull={() => navigate(`/admin/supplier-invoices/${quickViewInvoiceId}`)}
      />

      <RecordSupplierPaymentDrawer
        isOpen={recordDrawerOpen}
        preset={{ supplierId: id }}
        onClose={() => setRecordDrawerOpen(false)}
        onRecorded={() => {
          setRecordDrawerOpen(false)
          setPaymentsRefresh((value) => value + 1)
        }}
      />

      <SupplierPaymentQuickView
        paymentId={quickViewPaymentId}
        isOpen={Boolean(quickViewPaymentId)}
        onClose={() => setQuickViewPaymentId(null)}
        onVoided={() => setPaymentsRefresh((value) => value + 1)}
        invoiceBasePath="/admin/supplier-invoices"
        supplierBasePath="/admin/suppliers"
      />

      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          if (isUpdatingStatus) return
          setStatusError('')
          setIsStatusModalOpen(false)
        }}
        title={`${supplier.status === 'active' ? 'Deactivate' : 'Activate'} Supplier`}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            {supplier.status === 'active'
              ? 'This supplier will be moved to inactive status. Existing purchase history remains unchanged.'
              : 'This supplier will be marked active and available for new purchases again.'}
          </p>
          {statusError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdatingStatus}
              onClick={() => {
                setStatusError('')
                setIsStatusModalOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={supplier.status === 'active' ? 'danger' : 'primary'}
              loading={isUpdatingStatus}
              onClick={handleToggleStatus}
            >
              {supplier.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeleting) return
          setDeleteError('')
          setIsDeleteModalOpen(false)
        }}
        title="Delete Supplier"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">Delete {supplier.name}? This cannot be undone.</p>
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
                setIsDeleteModalOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={isDeleting} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={linkModalOpen}
        onClose={() => {
          if (isLinking) return
          setLinkError('')
          setLinkModalOpen(false)
        }}
        title="Link Product"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Link an existing product to this supplier. This only records the supplier–product relationship.
          </p>
          <Select
            label="Product"
            options={[
              { value: '', label: linkableProducts.length ? 'Select a product' : 'All products are already linked' },
              ...linkableProducts.map((product) => ({ value: product.id, label: product.sku ? `${product.name} · ${product.sku}` : product.name })),
            ]}
            value={linkProductId}
            onChange={(event) => { setLinkProductId(event.target.value); setLinkError('') }}
            disabled={linkableProducts.length === 0}
          />
          {linkError && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{linkError}</div>}
          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isLinking} onClick={() => setLinkModalOpen(false)}>Cancel</Button>
            <Button type="button" loading={isLinking} disabled={!linkProductId} onClick={handleLinkProduct}>Link Product</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
