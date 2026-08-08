import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
import { listSuperAdminOrganizations } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Active: 'success',
  Inactive: 'danger',
  Suspended: 'warning',
  Trial: 'info',
  Locked: 'warning',
}

const upgradeStatusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'locked', label: 'Locked' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

const upgradeStatusFilterOptions = [
  { value: '', label: 'All upgrade requests' },
  { value: 'none', label: 'None' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const normalizeOrganization = (organization) => ({
  id: organization.id,
  name: organization.name,
  adminName: organization.email,
  plan: organization.plan?.name || 'No plan',
  mrr: organization.plan?.price_monthly || 0,
  status: organization.status
    ? `${organization.status.charAt(0).toUpperCase()}${organization.status.slice(1)}`
    : 'Unknown',
  email: organization.email,
  phone: organization.phone,
  businessType: organization.business_type,
  gstNumber: organization.gst_number,
  panNumber: organization.pan_number,
  address: organization.address,
  financialYear: organization.financial_year,
  billingCycle: organization.billing_cycle,
  trialEndsAt: organization.trial_ends_at,
  trialDaysLeft: organization.trial_days_left,
  upgradeStatus: organization.upgrade_status,
  createdAt: organization.created_at,
})

export default function OrganizationsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [organizations, setOrganizations] = useState([])
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [listError, setListError] = useState('')
  const statusFilter = searchParams.get('status') || ''
  const upgradeStatusFilter = searchParams.get('upgrade_status') || ''

  const setStatusFilter = (value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('status', value)
      else next.delete('status')
      return next
    })
  }

  const setUpgradeStatusFilter = (value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set('upgrade_status', value)
      else next.delete('upgrade_status')
      return next
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadOrganizations() {
      setIsLoadingOrganizations(true)
      setListError('')

      const result = await listSuperAdminOrganizations({
        status: statusFilter,
        upgrade_status: upgradeStatusFilter,
      })

      if (!isMounted) return

      setIsLoadingOrganizations(false)

      if (!result.success) {
        setListError(result.error)
        return
      }

      setOrganizations((result.organizations || []).map(normalizeOrganization))
    }

    loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [statusFilter, upgradeStatusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Organizations</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage all organizations on the platform</p>
      </div>

      <Card title="Organizations List">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-lg">
          <Select
            label="Status"
            options={statusFilterOptions}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
          <Select
            label="Upgrade request"
            options={upgradeStatusFilterOptions}
            value={upgradeStatusFilter}
            onChange={(event) => setUpgradeStatusFilter(event.target.value)}
          />
        </div>

        <DataTable
          columns={[
            { key: 'id', header: 'Org ID', sortable: true },
            { key: 'name', header: 'Organization Name', sortable: true },
            { key: 'adminName', header: 'Admin Contact', sortable: true },
            { key: 'plan', header: 'Plan', sortable: true },
            { key: 'mrr', header: 'MRR', sortable: true, align: 'right', render: (row) => formatCurrency(row.mrr) },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => <Badge variant={statusVariant[row.status] || 'neutral'} dot>{row.status}</Badge>,
            },
            {
              key: 'upgradeStatus',
              header: 'Upgrade Request',
              sortable: true,
              render: (row) =>
                row.upgradeStatus && row.upgradeStatus !== 'none' ? (
                  <Badge variant={upgradeStatusVariant[row.upgradeStatus] || 'neutral'}>{row.upgradeStatus}</Badge>
                ) : (
                  <span className="text-neutral-400">—</span>
                ),
            },
          ]}
          data={organizations}
          searchKeys={['id', 'name', 'adminName', 'plan', 'status']}
          searchPlaceholder="Search organizations..."
          loading={isLoadingOrganizations}
          emptyTitle={listError ? 'Unable to load organizations' : 'No organizations found'}
          emptyDescription={listError || undefined}
          actions={(row) => [
            { label: 'View Details', icon: Eye, onClick: () => navigate(`/superadmin/organizations/${row.id}`) },
          ]}
        />
      </Card>
    </div>
  )
}
