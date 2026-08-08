import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, TrendingUp, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import {
  approveOrganizationUpgrade,
  listSuperAdminOrganizations,
  rejectOrganizationUpgrade,
} from '../../api/superadmin'

const tabOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
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

export default function UpgradeRequests() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pending')
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [actionError, setActionError] = useState('')

  const [approvingId, setApprovingId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  const loadRequests = async () => {
    setIsLoading(true)
    setListError('')

    const result = await listSuperAdminOrganizations({ upgrade_status: activeTab })

    setIsLoading(false)

    if (!result.success) {
      setListError(result.error)
      return
    }

    const organizations = activeTab
      ? result.organizations || []
      : (result.organizations || []).filter((organization) => organization.upgrade_status && organization.upgrade_status !== 'none')

    setRequests(organizations)
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleApprove = async (organization) => {
    setActionError('')
    setApprovingId(organization.id)

    const result = await approveOrganizationUpgrade(organization.id)

    setApprovingId(null)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    await loadRequests()
  }

  const openRejectModal = (organization) => {
    setRejectReason('')
    setRejectError('')
    setRejectTarget(organization)
  }

  const handleReject = async () => {
    if (!rejectTarget) return

    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for the organization admin.')
      return
    }

    setRejectError('')
    setIsRejecting(true)

    const result = await rejectOrganizationUpgrade(rejectTarget.id, rejectReason.trim())

    setIsRejecting(false)

    if (!result.success) {
      setRejectError(result.error)
      return
    }

    setRejectTarget(null)
    await loadRequests()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Upgrade Requests</h1>
        <p className="mt-1 text-sm text-neutral-500">Review and action plan upgrade requests from organizations.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabOptions.map((tab) => (
            <TabsTrigger key={tab.value || 'all'} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {isLoading ? (
        <Card>
          <LoadingSpinner label="Loading upgrade requests…" />
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title={listError ? 'Unable to load upgrade requests' : 'No upgrade requests here'}
            description={listError || 'Nothing to review in this view right now.'}
          />
        </Card>
      ) : activeTab === 'pending' ? (
        <div className="space-y-3">
          {requests.map((organization) => (
            <Card key={organization.id} bodyClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{organization.name}</p>
                  <Badge variant={upgradeStatusVariant.pending}>Pending</Badge>
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  {organization.plan?.name || 'No plan'} →{' '}
                  <span className="font-medium text-neutral-900">{organization.requested_plan?.name || 'Requested plan'}</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Requested {formatDate(organization.upgrade_requested_at)} · {organization.email || 'no contact email'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="ghost" size="sm" onClick={() => navigate(`/superadmin/organizations/${organization.id}`)}>
                  <Eye className="size-4" aria-hidden="true" />
                  View
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openRejectModal(organization)}
                  disabled={approvingId === organization.id}
                >
                  <X className="size-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button type="button" size="sm" onClick={() => handleApprove(organization)} loading={approvingId === organization.id}>
                  <Check className="size-4" aria-hidden="true" />
                  Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <DataTable
            columns={[
              { key: 'name', header: 'Organization', sortable: true },
              { key: 'currentPlan', header: 'Current Plan', sortable: true },
              { key: 'requestedPlan', header: 'Requested Plan', sortable: true },
              {
                key: 'upgradeStatus',
                header: 'Decision',
                sortable: true,
                render: (row) => <Badge variant={upgradeStatusVariant[row.upgradeStatus] || 'neutral'}>{row.upgradeStatus}</Badge>,
              },
              { key: 'requestedAt', header: 'Requested', sortable: true },
            ]}
            data={requests.map((organization) => ({
              id: organization.id,
              name: organization.name,
              currentPlan: organization.plan?.name || 'No plan',
              requestedPlan: organization.requested_plan?.name || '—',
              upgradeStatus: organization.upgrade_status,
              requestedAt: formatDate(organization.upgrade_requested_at),
            }))}
            searchKeys={['name', 'currentPlan', 'requestedPlan']}
            searchPlaceholder="Search organizations..."
            actions={(row) => [
              { label: 'View organization', icon: Eye, onClick: () => navigate(`/superadmin/organizations/${row.id}`) },
            ]}
          />
        </Card>
      )}

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => {
          if (isRejecting) return
          setRejectTarget(null)
        }}
        title="Reject Upgrade Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Rejecting the upgrade request from <span className="font-semibold text-neutral-900">{rejectTarget?.name}</span>.
          </p>
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
            <Button type="button" variant="secondary" disabled={isRejecting} onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleReject} loading={isRejecting}>
              Reject Upgrade
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
