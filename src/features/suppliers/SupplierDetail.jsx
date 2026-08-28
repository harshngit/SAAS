import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, FileText, IndianRupee, Plus, Power, ShoppingBag, Trash2, Undo2, Wallet } from 'lucide-react'
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
import {
  deleteSupplier,
  getSupplier,
  getSupplierPayments,
  recordSupplierPayment,
  updateSupplier,
  updateSupplierStatus,
  voidSupplierPayment,
} from '../../api/suppliers'
import { formatCurrency } from '../../utils/format'
import { normalizeApiPayment, normalizeApiSupplier } from './supplierUtils'
import { getPaymentMethodFlags, sanitizePaymentDetails } from '../payments/paymentMethodUtils'
import SupplierForm from './SupplierForm'

const paymentModeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'cheque', label: 'Cheque' },
]

const today = () => new Date().toISOString().slice(0, 10)

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

  const loadSupplier = async () => {
    setIsLoading(true)
    setLoadError('')

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

    const result = await getSupplierPayments(id)

    setIsLoadingPayments(false)

    if (!result.success) {
      setPaymentsError(result.error)
      return
    }

    setPayments(result.payments.map(normalizeApiPayment))
  }

  useEffect(() => {
    loadSupplier()
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

    const result = await updateSupplier(supplier.id, supplierData)

    setIsSaving(false)

    if (!result.success) {
      setFormError(result.error)
      return
    }

    setSupplier(normalizeApiSupplier(result.supplier, supplierData))
    setIsFormOpen(false)
  }

  const handleToggleStatus = async () => {
    const nextIsActive = supplier.status !== 'active'
    setIsUpdatingStatus(true)
    setStatusError('')

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

    setIsSavingPayment(true)

    const paymentDetails = sanitizePaymentDetails(paymentForm.paymentMode, {
      upiId: paymentForm.upiId.trim(),
      transactionReference: paymentForm.reference.trim(),
      cardType: paymentForm.cardType.trim(),
      cardLastFour: paymentForm.cardLastFour.trim(),
      collectionInstructions: paymentForm.collectionInstructions.trim(),
      paymentStatus: paymentForm.paymentStatus,
    })

    const result = await recordSupplierPayment(supplier.id, {
      amount,
      paymentMode: paymentForm.paymentMode,
      reference: paymentForm.reference.trim() || undefined,
      ...paymentDetails,
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
    return (
      <SupplierForm
        isOpen={isFormOpen}
        onClose={() => {
          if (isSaving) return
          setFormError('')
          setIsFormOpen(false)
        }}
        supplier={supplier}
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={IndianRupee} iconVariant="success" label="Total Purchases" value={formatCurrency(supplier.totalPurchases)} />
        <StatCard icon={Wallet} iconVariant="primary" label="Total Paid" value={formatCurrency(supplier.totalPaid)} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Outstanding Payable" value={formatCurrency(supplier.outstandingPayable)} />
        <StatCard icon={FileText} iconVariant="info" label="Payments Recorded" value={payments.length} />
      </div>

      <Card title="Contact Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Contact Person</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.contactPerson || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Phone</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Email</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">GST Number</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.gstNumber || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Address</p>
            <p className="mt-1 text-sm text-neutral-800">{supplier.address || '—'}</p>
          </div>
        </div>
      </Card>

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
                    <th className="whitespace-nowrap px-5 py-3">Paid On</th>
                    <th className="whitespace-nowrap px-5 py-3">Mode</th>
                    <th className="whitespace-nowrap px-5 py-3">Reference</th>
                    <th className="whitespace-nowrap px-5 py-3">Note</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Amount</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-primary-50/35">
                      <td className="whitespace-nowrap px-5 py-3.5 text-neutral-600">
                        {new Date(payment.paidOn).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <Badge variant="neutral">
                          {paymentModeOptions.find((option) => option.value === payment.paymentMode)?.label || payment.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-500">{payment.reference || '—'}</td>
                      <td className="px-5 py-3.5 text-neutral-500">{payment.note || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                        {formatCurrency(payment.amount)}
                      </td>
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
            required={paymentForm.paymentMode !== 'cod'}
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
