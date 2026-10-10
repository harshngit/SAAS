import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Edit3,
  Info,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import {
  approveOrganizationUpgrade,
  deleteOrganization,
  getOrganization,
  rejectOrganizationUpgrade,
  updateOrganizationStatus,
} from '../../api/superadmin'
import { getSuperAdminSubscriptionPayments } from '../../api/billing'
import { formatCurrency } from '../../utils/format'
import OrganizationPlanAccess from './OrganizationPlanAccess'

const PAYMENT_STATUS_VARIANT = { paid: 'success', failed: 'danger', created: 'warning' }

const statusVariant = {
  trial: 'info',
  active: 'success',
  locked: 'warning',
  inactive: 'neutral',
  suspended: 'danger',
}

const statusOptions = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'locked', label: 'Locked' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

const upgradeStatusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const metricCardClasses = {
  plan: 'border-surface-border bg-surface',
  price: 'border-surface-border bg-surface',
  trial: 'border-surface-border bg-surface',
  member: 'border-surface-border bg-surface',
}

const metricIconClasses = {
  plan: 'bg-blue-100 text-blue-600',
  price: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-violet-100 text-violet-700',
  member: 'bg-orange-100 text-orange-600',
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function titleCase(value) {
  if (!value) return 'Unknown'
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function MetricTile({ icon: Icon, label, value, hint, tone = 'plan', info = false }) {
  return (
    <div className={`min-h-[126px] rounded-2xl border px-6 py-5 shadow-(--shadow-card) ${metricCardClasses[tone]}`}>
      <div className="flex items-start gap-4">
        <span className={`flex size-12 items-center justify-center rounded-xl ${metricIconClasses[tone]}`}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-fg-muted">{label}</p>
            {info && <Info className="size-3.5 text-fg-muted" aria-hidden="true" />}
          </div>
          <p className="mt-2 font-(--font-display) text-2xl font-bold leading-none tracking-tight text-fg">
            {value}
          </p>
          {hint && <p className="mt-3 max-w-52 text-xs leading-5 text-fg-muted">{hint}</p>}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, icon: Icon }) {
  return (
    <div className="grid grid-cols-[1.35fr_2fr] items-center gap-4 border-b border-surface-border py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        )}
        <p className="truncate text-xs font-medium text-fg-muted">{label}</p>
      </div>
      <p className="min-w-0 break-words text-sm font-medium text-fg">{value || '-'}</p>
    </div>
  )
}

function SectionTitle({ icon: Icon, title, actions }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-fg">{title}</h3>
      </div>
      {actions}
    </div>
  )
}

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [organization, setOrganization] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  const [statusDraft, setStatusDraft] = useState('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const [isApproving, setIsApproving] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [payments, setPayments] = useState([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [paymentsError, setPaymentsError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setLoadError('')

      const result = await getOrganization(id)

      if (!isMounted) return

      setIsLoading(false)

      if (!result.success) {
        setOrganization(null)
        setLoadError(result.error)
        return
      }

      setOrganization(result.organization)
      setStatusDraft(result.organization.status || '')
    }

    async function loadPayments() {
      setIsLoadingPayments(true)
      const result = await getSuperAdminSubscriptionPayments(id)
      if (!isMounted) return
      setIsLoadingPayments(false)
      if (!result.success) {
        setPaymentsError(result.error)
        return
      }
      setPaymentsError('')
      setPayments(result.payments)
    }

    load()
    loadPayments()

    return () => {
      isMounted = false
    }
  }, [id])

  const applyOrganization = (nextOrganization) => {
    setOrganization(nextOrganization)
    setStatusDraft(nextOrganization?.status || '')
  }

  const handleUpdateStatus = async () => {
    if (!statusDraft || statusDraft === organization.status) return

    setActionError('')
    setIsUpdatingStatus(true)

    const result = await updateOrganizationStatus(id, statusDraft)

    setIsUpdatingStatus(false)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    applyOrganization(result.organization)
  }

  const handleApprove = async () => {
    setActionError('')
    setIsApproving(true)

    const result = await approveOrganizationUpgrade(id)

    setIsApproving(false)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    applyOrganization(result.organization)
  }

  const openRejectModal = () => {
    setRejectReason('')
    setRejectError('')
    setIsRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for the organization admin.')
      return
    }

    setRejectError('')
    setIsRejecting(true)

    const result = await rejectOrganizationUpgrade(id, rejectReason.trim())

    setIsRejecting(false)

    if (!result.success) {
      setRejectError(result.error)
      return
    }

    applyOrganization(result.organization)
    setIsRejectModalOpen(false)
  }

  const handleDelete = async () => {
    setDeleteError('')
    setIsDeleting(true)

    const result = await deleteOrganization(id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    navigate('/superadmin/organizations')
  }

  if (isLoading) {
    return <LoadingSpinner label="Loading organization..." />
  }

  if (!organization) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="Organization not found"
          description={loadError || 'This organization may have been deleted or the link is out of date.'}
          action={{ label: 'Back to Organizations', onClick: () => navigate('/superadmin/organizations') }}
        />
      </Card>
    )
  }

  const hasUpgradeRequest = organization.upgrade_status && organization.upgrade_status !== 'none'
  const currentPlanName = organization.plan?.name || 'No plan'
  const currentPrice = formatCurrency(
    organization.billing_cycle === 'yearly'
      ? organization.plan?.price_yearly || 0
      : organization.plan?.price_monthly || 0,
  )

  return (
    <div className="listing-page space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-fg-muted">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full px-4 text-xs"
          onClick={() => navigate('/superadmin/organizations')}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        <span>Organizations</span>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="max-w-64 truncate">{organization.name}</span>
      </div>

      <div className="relative min-h-[112px] overflow-hidden rounded-2xl border border-surface-border bg-surface p-4 shadow-(--shadow-card)">
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex size-[76px] shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-primary-600">
              <Building2 className="size-9" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-(--font-display) text-2xl font-semibold tracking-tight text-fg">
                  {organization.name}
                </h1>
                <Badge variant={statusVariant[organization.status] || 'neutral'} dot>
                  {titleCase(organization.status)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-fg-muted">Organization details and subscription controls</p>
            </div>
          </div>
          <Button
            variant="danger"
            className="h-11 px-5 shadow-[0_12px_24px_-10px_rgb(220_38_38/0.8)]"
            onClick={() => {
              setDeleteError('')
              setIsDeleteModalOpen(true)
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete Organization
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={CreditCard}
          label="Current Plan"
          value={currentPlanName}
          hint={organization.plan ? 'Current active subscription plan.' : "This organization doesn't have an active plan."}
          tone="plan"
          info
        />
        <MetricTile
          icon={IndianRupee}
          label={`Price / ${organization.billing_cycle === 'yearly' ? 'year' : 'month'}`}
          value={currentPrice}
          hint="Billed amount per month."
          tone="price"
        />
        <MetricTile
          icon={Clock}
          label="Trial Days Left"
          value={organization.trial_days_left ?? '-'}
          hint="Number of days remaining in trial."
          tone="trial"
        />
        <MetricTile
          icon={Calendar}
          label="Member Since"
          value={formatDate(organization.created_at)}
          hint="Organization registered date."
          tone="member"
        />
      </div>

      {hasUpgradeRequest && (
        <Card title="Plan Upgrade Request" subtitle="Review the organization's latest plan change request.">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-surface-border bg-surface-muted/60 px-4 py-3">
              <Badge variant={upgradeStatusVariant[organization.upgrade_status] || 'neutral'} dot>
                {titleCase(organization.upgrade_status)}
              </Badge>
              <p className="text-sm text-fg-muted">
                Requested <span className="font-semibold text-fg">{organization.requested_plan?.name || 'a new plan'}</span>
                {organization.upgrade_requested_at && ` on ${formatDate(organization.upgrade_requested_at)}`}
              </p>
            </div>

            {organization.upgrade_status === 'rejected' && organization.upgrade_reject_reason && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                Rejection reason: {organization.upgrade_reject_reason}
              </p>
            )}

            {organization.upgrade_status === 'pending' && (
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={openRejectModal} disabled={isApproving}>
                  <X className="size-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button type="button" onClick={handleApprove} loading={isApproving}>
                  <Check className="size-4" aria-hidden="true" />
                  Approve Upgrade
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex min-h-[58px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-primary-600">
              <Settings className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-fg">Status Override</h3>
              <p className="mt-1 text-xs text-fg-muted">Manually set the organization's account status.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:w-[34rem] sm:flex-row sm:items-end">
            <Select
              label="Status"
              options={statusOptions}
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              className="w-full flex-1"
              triggerClassName="h-9 rounded-xl py-2"
            />
            <Button
              type="button"
              onClick={handleUpdateStatus}
              loading={isUpdatingStatus}
              disabled={!statusDraft || statusDraft === organization.status}
              className="h-9 px-6"
            >
              Update Status
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-h-[220px]">
          <SectionTitle
            icon={Building2}
            title="Organization Details"
            actions={
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs">
                <Edit3 className="size-3.5" aria-hidden="true" />
                Edit Details
              </Button>
            }
          />
          <div>
            <DetailRow icon={Building2} label="Business Type" value={organization.business_type} />
            <DetailRow icon={Mail} label="Email" value={organization.email} />
            <DetailRow icon={Phone} label="Phone" value={organization.phone} />
            <DetailRow icon={MapPin} label="Address" value={organization.address} />
          </div>
        </Card>

        <Card className="min-h-[220px]">
          <SectionTitle icon={CreditCard} title="Plan Details" />
          {organization.plan ? (
            <div>
              <DetailRow icon={Building2} label="Users" value={organization.plan.max_users || 'Unlimited'} />
              <DetailRow icon={CreditCard} label="Orders / month" value={organization.plan.max_orders || 'Unlimited'} />
              <DetailRow icon={Calendar} label="Billing Cycle" value={titleCase(organization.billing_cycle) || '-'} />
              {organization.plan.features?.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {organization.plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-fg-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border bg-surface-muted/25 px-6 py-7 text-center">
              <CreditCard className="size-8 text-fg-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-fg">No active plan</p>
              <p className="mt-1 text-xs text-fg-muted">This organization has no active plan.</p>
              <Button type="button" className="mt-4 h-10 px-5" onClick={() => navigate('/superadmin/plans')}>
                <CreditCard className="size-4" aria-hidden="true" />
                View Plans
              </Button>
            </div>
          )}
        </Card>
      </div>

      <OrganizationPlanAccess orgId={id} />

      <Card title="Payments" subtitle="Online subscription payments for this organization">
        {isLoadingPayments ? (
          <LoadingSpinner label="Loading payments..." />
        ) : paymentsError ? (
          <p className="py-6 text-center text-sm text-red-600">{paymentsError}</p>
        ) : payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments yet" description="This organization hasn't made an online plan payment." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-surface-border">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted/80 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-fg-muted">
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Plan</th>
                  <th className="px-3.5 py-2.5">Cycle</th>
                  <th className="px-3.5 py-2.5 text-right">Amount</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="px-3.5 py-3 text-fg-muted">{formatDate(payment.paidAt || payment.createdAt)}</td>
                    <td className="px-3.5 py-3 font-medium text-fg">{payment.planName || '-'}</td>
                    <td className="px-3.5 py-3 capitalize text-fg-muted">{payment.billingCycle || '-'}</td>
                    <td className="px-3.5 py-3 text-right font-semibold text-fg">{formatCurrency(payment.amountPaise / 100)}</td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant={PAYMENT_STATUS_VARIANT[payment.status] || 'neutral'} dot>
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-3 text-xs text-fg-muted">{payment.razorpayPaymentId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          if (isRejecting) return
          setIsRejectModalOpen(false)
        }}
        title="Reject Upgrade Request"
      >
        <div className="space-y-4">
          <Input
            label="Reason"
            as="textarea"
            placeholder="Explain why this upgrade request is being rejected..."
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            error={rejectError}
            required
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={isRejecting} onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleReject} loading={isRejecting}>
              Reject Upgrade
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeleting) return
          setIsDeleteModalOpen(false)
          setDeleteError('')
        }}
        title="Delete Organization"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete <span className="font-semibold text-neutral-900">{organization.name}</span>? This permanently removes all of
            its users, customers, products, and data. This cannot be undone.
          </p>
          {deleteError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeleteError('')
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleDelete} loading={isDeleting}>
              Delete Organization
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
