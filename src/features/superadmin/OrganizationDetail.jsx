import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Calendar, Check, Clock, CreditCard, Trash2, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
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
import { formatCurrency } from '../../utils/format'

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

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function titleCase(value) {
  if (!value) return 'Unknown'
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
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

    load()

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
    return <LoadingSpinner label="Loading organization…" />
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate('/superadmin/organizations')}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{organization.name}</h1>
              <Badge variant={statusVariant[organization.status] || 'neutral'} dot>
                {titleCase(organization.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-500">Organization Details</p>
          </div>
        </div>
        <Button
          variant="danger"
          onClick={() => {
            setDeleteError('')
            setIsDeleteModalOpen(true)
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete Organization
        </Button>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={CreditCard} iconVariant="primary" label="Current Plan" value={organization.plan?.name || 'No plan'} />
        <StatCard
          icon={CreditCard}
          iconVariant="success"
          label={`Price / ${organization.billing_cycle === 'yearly' ? 'year' : 'month'}`}
          value={formatCurrency(
            organization.billing_cycle === 'yearly'
              ? organization.plan?.price_yearly || 0
              : organization.plan?.price_monthly || 0,
          )}
        />
        <StatCard
          icon={Clock}
          iconVariant="info"
          label="Trial Days Left"
          value={organization.trial_days_left ?? '—'}
        />
        <StatCard icon={Calendar} iconVariant="neutral" label="Member Since" value={formatDate(organization.created_at)} />
      </div>

      {hasUpgradeRequest && (
        <Card title="Plan Upgrade Request">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={upgradeStatusVariant[organization.upgrade_status] || 'neutral'}>
                {titleCase(organization.upgrade_status)}
              </Badge>
              <p className="text-sm text-neutral-600">
                Requested <span className="font-semibold text-neutral-900">{organization.requested_plan?.name || 'a new plan'}</span>
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

      <Card title="Status Override" subtitle="Manually set the organization's account status.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label="Status"
            options={statusOptions}
            value={statusDraft}
            onChange={(event) => setStatusDraft(event.target.value)}
            className="w-full sm:w-56"
          />
          <Button
            type="button"
            onClick={handleUpdateStatus}
            loading={isUpdatingStatus}
            disabled={!statusDraft || statusDraft === organization.status}
          >
            Update Status
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Organization Details">
          <div className="space-y-2 text-sm">
            <p><span className="font-medium text-neutral-700">Business Type:</span> {organization.business_type || '—'}</p>
            <p><span className="font-medium text-neutral-700">Email:</span> {organization.email || '—'}</p>
            <p><span className="font-medium text-neutral-700">Phone:</span> {organization.phone || '—'}</p>
            <p><span className="font-medium text-neutral-700">GST Number:</span> {organization.gst_number || '—'}</p>
            <p><span className="font-medium text-neutral-700">PAN Number:</span> {organization.pan_number || '—'}</p>
            <p><span className="font-medium text-neutral-700">Address:</span> {organization.address || '—'}</p>
            <p><span className="font-medium text-neutral-700">Financial Year:</span> {organization.financial_year || '—'}</p>
          </div>
        </Card>

        <Card title="Plan Details">
          {organization.plan ? (
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-neutral-700">Users:</span> {organization.plan.max_users || 'Unlimited'}</p>
              <p><span className="font-medium text-neutral-700">Orders / month:</span> {organization.plan.max_orders || 'Unlimited'}</p>
              <p><span className="font-medium text-neutral-700">Billing cycle:</span> {titleCase(organization.billing_cycle) || '—'}</p>
              {organization.plan.features?.length > 0 && (
                <ul className="space-y-1.5 pt-1">
                  {organization.plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-neutral-600">
                      <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">This organization has no active plan.</p>
          )}
        </Card>
      </div>

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
            placeholder="Explain why this upgrade request is being rejected…"
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
