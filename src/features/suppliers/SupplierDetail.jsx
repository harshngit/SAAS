import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Eye, FileText, IndianRupee, Plus, Power, ShoppingBag, Tag, Trash2, Undo2, Wallet } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  deleteSupplier,
  getSupplier,
  getSupplierPayments,
  recordSupplierPayment,
  updateSupplier,
  updateSupplierStatus,
  voidSupplierPayment,
} from '../../api/suppliers'
import { listProducts } from '../../api/products'
import { listPurchases } from '../../api/purchases'
import { formatCurrency } from '../../utils/format'
import { useToast } from '../../components/ui/toastContext'
import { formatPaymentTerms, normalizeApiPayment, normalizeApiSupplier, supplierFormFallback } from './supplierUtils'
import { normalizeApiProduct } from '../products/productUtils'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { getSupplierProducts, syncSupplierProductLinks } from './supplierProductUtils'
import { demoProducts, getDemoSupplier, getDemoSupplierPayments, getDemoSupplierPurchases } from './supplierDemoData'
import { getPaymentMethodFlags } from '../payments/paymentMethodUtils'
import SupplierForm from './SupplierForm'

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'cheque', label: 'Cheque' },
]

const today = () => new Date().toISOString().slice(0, 10)

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

const emptyPaymentForm = {
  amount: '',
  paymentMode: 'cash',
  reference: '',
  upiId: '',
  cardType: '',
  cardLastFour: '',
  collectionInstructions: '',
  paymentStatus: 'pending',
  note: '',
  paidOn: today(),
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [paymentFormError, setPaymentFormError] = useState('')
  const [voidTarget, setVoidTarget] = useState(null)
  const [isVoiding, setIsVoiding] = useState(false)
  const [voidError, setVoidError] = useState('')
  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [purchases, setPurchases] = useState([])
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true)
  const [purchasesError, setPurchasesError] = useState('')

  const loadSupplier = async () => {
    setIsLoading(true)
    setLoadError('')

    if (useDemoSuppliers) {
      setSupplier(getDemoSupplier(id))
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

  const loadPayments = async () => {
    setIsLoadingPayments(true)
    setPaymentsError('')

    if (useDemoSuppliers) {
      setPayments(getDemoSupplierPayments(id))
      setIsLoadingPayments(false)
      return
    }

    const result = await getSupplierPayments(id)

    setIsLoadingPayments(false)

    if (!result.success) {
      setPaymentsError(result.error)
      return
    }

    setPayments(result.payments.map(normalizeApiPayment))
  }

  const loadRelatedData = async () => {
    setIsLoadingProducts(true)
    setIsLoadingPurchases(true)
    setPurchasesError('')
    if (useDemoSuppliers) {
      setProducts(demoProducts)
      setPurchases(getDemoSupplierPurchases(id))
      setIsLoadingProducts(false)
      setIsLoadingPurchases(false)
      return
    }

    const [productsResult, purchasesResult] = await Promise.all([listProducts(), listPurchases({ supplierId: id })])
    if (productsResult.success) setProducts(productsResult.products.map((product) => normalizeApiProduct(product)))
    if (purchasesResult.success) setPurchases(purchasesResult.purchases)
    else setPurchasesError(purchasesResult.error)
    setIsLoadingProducts(false)
    setIsLoadingPurchases(false)
  }

  useEffect(() => {
    loadSupplier()
    loadPayments()
    loadRelatedData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, useDemoSuppliers])

  const supplierProducts = useMemo(
    () => getSupplierProducts(supplier, products, { demoMode: useDemoSuppliers }),
    [products, supplier, useDemoSuppliers],
  )
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

    if (useDemoSuppliers) {
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

    // Products Supplied -> Product.preferred_supplier_id (the one real backend-supported link -
    // see supplierProductUtils.js). The supplier's own fields already saved above, so a failure
    // here is reported separately rather than rolled back or hidden.
    const syncResult = await syncSupplierProductLinks(supplier.id, {
      previousProducts: supplierProducts.map((product) => ({ id: product.id, name: product.name })),
      nextProducts: supplierData.productsSupplied || [],
      allProducts: products,
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

    if (useDemoSuppliers) {
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

    if (useDemoSuppliers) {
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
    // The rich UPI / Card / COD sub-fields (and payment_status) below only exist for the demo
    // simulation - the real PaymentCreate schema accepts amount, payment_mode, reference, note,
    // paid_on and nothing else (verified against the backend OpenAPI spec). Real-mode validation
    // and the payload sent to the server stick to those five fields only.
    if (useDemoSuppliers) {
      const paymentFlags = getPaymentMethodFlags(paymentForm.paymentMode)

      if (paymentForm.paymentMode !== 'cod' && (!amount || amount <= 0)) {
        setPaymentFormError('Enter a valid payment amount.')
        return
      }
      if (paymentFlags.showUpiFields && !paymentForm.upiId.trim()) {
        setPaymentFormError('Enter a UPI ID.')
        return
      }
      if (paymentFlags.showCardFields) {
        if (!paymentForm.cardType.trim()) {
          setPaymentFormError('Enter the card type.')
          return
        }
        if (!/^\d{4}$/.test(paymentForm.cardLastFour.trim())) {
          setPaymentFormError('Enter the last 4 digits of the card.')
          return
        }
      }
      if (paymentFlags.showReferenceField && !paymentForm.reference.trim()) {
        setPaymentFormError('Enter a transaction/reference ID.')
        return
      }
      if (paymentFlags.showCodFields && !paymentForm.collectionInstructions.trim()) {
        setPaymentFormError('Add collection or delivery instructions.')
        return
      }

      const newPayment = {
        id: `demo-payment-${Date.now()}`,
        supplierId: supplier.id,
        amount,
        paymentMode: paymentForm.paymentMode,
        reference: paymentForm.reference.trim(),
        note: paymentForm.note.trim(),
        paidOn: paymentForm.paidOn,
      }
      setPayments((current) => [newPayment, ...current])
      setSupplier((current) => ({
        ...current,
        totalPaid: Number(current.totalPaid || 0) + amount,
        outstandingPayable: Math.max(0, Number(current.outstandingPayable || 0) - amount),
      }))
      setIsPaymentModalOpen(false)
      return
    }

    // Real supplier: the backend's `amount` field requires a positive value on every payment
    // mode (there is no "pending COD, amount TBD" concept server-side).
    if (!amount || amount <= 0) {
      setPaymentFormError('Enter a valid payment amount.')
      return
    }

    setIsSavingPayment(true)

    const result = await recordSupplierPayment(supplier.id, {
      amount,
      paymentMode: paymentForm.paymentMode,
      reference: paymentForm.reference.trim() || undefined,
      note: paymentForm.note.trim() || undefined,
      paidOn: paymentForm.paidOn || undefined,
    })

    setIsSavingPayment(false)

    if (!result.success) {
      setPaymentFormError(result.error)
      return
    }

    setSupplier(normalizeApiSupplier(result.supplier, supplier))
    setIsPaymentModalOpen(false)
    await loadPayments()
  }

  const handleVoidPayment = async () => {
    if (!voidTarget) return

    setIsVoiding(true)
    setVoidError('')

    if (DEMO_MODE) {
      setPayments((current) => current.filter((payment) => payment.id !== voidTarget.id))
      setSupplier((current) => ({
        ...current,
        totalPaid: Math.max(0, Number(current.totalPaid || 0) - Number(voidTarget.amount || 0)),
        outstandingPayable: Number(current.outstandingPayable || 0) + Number(voidTarget.amount || 0),
      }))
      setIsVoiding(false)
      setVoidTarget(null)
      return
    }

    const result = await voidSupplierPayment(supplier.id, voidTarget.id)

    setIsVoiding(false)

    if (!result.success) {
      setVoidError(result.error)
      return
    }

    setSupplier(normalizeApiSupplier(result.supplier, supplier))
    setVoidTarget(null)
    await loadPayments()
  }

  if (isFormOpen) {
    // Preselect the products actually linked to this supplier today - real suppliers derive this
    // from Product.preferred_supplier_id, since the backend never echoes `productsSupplied` back
    // on the supplier record itself.
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
        <StatCard icon={Wallet} iconVariant="primary" label="Total Paid" value={formatCurrency(supplier.totalPaid)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(supplier.outstandingPayable)} />
        <StatCard icon={FileText} iconVariant="info" label="Last Purchase" value={formatDate(lastPurchase?.purchaseDate || lastPurchase?.invoiceDate)} />
      </div>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="documents">Documents / Notes</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4 space-y-4">

      <Card title="Basic Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Supplier ID" value={supplier.id} />
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
          <Card title="Products" subtitle="Products currently linked to this supplier as preferred supplier." className="p-0" bodyClassName="p-0">
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
                  <thead><tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400"><th className="px-5 py-3">Product</th><th className="px-5 py-3">SKU</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Default Purchase Price</th><th className="px-5 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-neutral-50">
                    {supplierProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-primary-50/35">
                        <td className="px-5 py-3.5 font-medium text-neutral-900">{product.name}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{displayValue(product.sku)}</td>
                        <td className="px-5 py-3.5 text-neutral-600">{displayValue(product.categoryLabel || product.category)}</td>
                        <td className="px-5 py-3.5 text-neutral-600">
                          {product.variants?.[0]?.purchasePrice ? formatCurrency(product.variants[0].purchasePrice) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={product.status === 'active' ? 'success' : 'neutral'}>{product.status || '—'}</Badge>
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

        <TabsContent value="payments" className="mt-4">
      <Card
        title="Payments"
        subtitle="Every payment recorded against this supplier"
        className="p-0"
        bodyClassName="p-0"
        actions={
          <Button type="button" size="sm" onClick={handleOpenPaymentModal}>
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
            <p className="py-8 text-center text-sm text-neutral-500">No payments recorded for this supplier yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-100">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                    <th className="whitespace-nowrap px-5 py-3">Payment #</th>
                    <th className="whitespace-nowrap px-5 py-3">Date</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Amount</th>
                    <th className="whitespace-nowrap px-5 py-3">Payment Mode</th>
                    <th className="whitespace-nowrap px-5 py-3">Reference</th>
                    <th className="whitespace-nowrap px-5 py-3">Note</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">{payment.id || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {new Date(payment.paidOn).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Badge variant="neutral">
                          {paymentModeOptions.find((option) => option.value === payment.paymentMode)?.label || payment.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-500">{payment.reference || '—'}</td>
                      <td className="px-5 py-3.5 text-neutral-500">{payment.note || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setVoidTarget(payment)}>
                          <Undo2 className="size-4" aria-hidden="true" />
                          Void
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card title="Documents / Notes" subtitle="Internal supplier records.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {['GST Certificate', 'PAN', 'Agreement', 'Other'].map((type) => (
                <div key={type} className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-4">
                  <p className="text-sm font-medium text-neutral-800">{type}</p>
                  <p className="mt-1 text-xs text-neutral-500">No document uploaded</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Documents and internal notes are not persisted by the current backend. BACKEND LATER.
            </div>
          </Card>
        </TabsContent>
      </Tabs>

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

      <Modal isOpen={isPaymentModalOpen} onClose={handleClosePaymentModal} title="Record Payment">
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
            required={!useDemoSuppliers || paymentForm.paymentMode !== 'cod'}
          />
          <Select
            label="Payment Mode"
            options={paymentModeOptions}
            value={paymentForm.paymentMode}
            onChange={(event) =>
              setPaymentForm((current) => ({
                ...current,
                paymentMode: event.target.value,
                reference: '',
                upiId: '',
                cardType: '',
                cardLastFour: '',
                collectionInstructions: '',
                paymentStatus: event.target.value === 'cod' ? 'pending' : '',
              }))
            }
          />
          <DatePicker
            label="Paid On"
            value={paymentForm.paidOn}
            onChange={(value) => setPaymentForm((current) => ({ ...current, paidOn: value }))}
          />
          {useDemoSuppliers ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {getPaymentMethodFlags(paymentForm.paymentMode).showUpiFields && (
                <>
                  <Input
                    label="UPI ID"
                    value={paymentForm.upiId}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, upiId: event.target.value }))}
                    required
                  />
                  <Input
                    label="Transaction / Reference ID"
                    value={paymentForm.reference}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                    required
                  />
                </>
              )}

              {getPaymentMethodFlags(paymentForm.paymentMode).showCardFields && (
                <>
                  <Input
                    label="Card Type"
                    value={paymentForm.cardType}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, cardType: event.target.value }))}
                    placeholder="Debit / Credit / RuPay"
                    required
                  />
                  <Input
                    label="Last 4 Digits"
                    value={paymentForm.cardLastFour}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, cardLastFour: event.target.value }))}
                    inputClassName="tracking-[0.25em]"
                    maxLength={4}
                    required
                  />
                  <Input
                    label="Transaction / Reference ID"
                    value={paymentForm.reference}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                    required
                  />
                </>
              )}

              {getPaymentMethodFlags(paymentForm.paymentMode).showReferenceField &&
                !getPaymentMethodFlags(paymentForm.paymentMode).showUpiFields &&
                !getPaymentMethodFlags(paymentForm.paymentMode).showCardFields && (
                  <Input
                    label="Reference"
                    placeholder="e.g. Cheque no. or transaction ID"
                    value={paymentForm.reference}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                  />
                )}

              {getPaymentMethodFlags(paymentForm.paymentMode).showCodFields && (
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-neutral-700">Collection / Delivery Instructions</label>
                  <textarea
                    value={paymentForm.collectionInstructions}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, collectionInstructions: event.target.value }))
                    }
                    className="h-24 resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                  />
                  <p className="text-xs text-amber-700">Payment status stays pending until the cash is collected.</p>
                </div>
              )}
            </div>
          ) : (
            // Real supplier: only the fields the backend's PaymentCreate schema actually accepts
            // (amount, payment_mode, reference, note, paid_on) - see handleRecordPayment.
            <Input
              label="Reference"
              placeholder="e.g. Cheque no., UTR, transaction ID (optional)"
              value={paymentForm.reference}
              onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
            />
          )}
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
        title="Void Payment"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Void the {formatCurrency(voidTarget?.amount)} payment recorded on{' '}
            {voidTarget ? new Date(voidTarget.paidOn).toLocaleDateString() : ''}? This restores the supplier's
            outstanding balance and cannot be undone.
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
