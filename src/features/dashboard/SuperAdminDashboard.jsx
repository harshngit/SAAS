import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eachMonthOfInterval, endOfMonth, format, isBefore } from 'date-fns'
import {
  Ban,
  Ban as BanIcon,
  Building2,
  CircleCheck,
  CircleCheck as ReactivateIcon,
  Clock,
  Eye,
  IndianRupee,
  TrendingUp,
  Trash2,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import SalesLineChart from '../../components/charts/SalesLineChart'
import CategoryPieChart from '../../components/charts/CategoryPieChart'
import { deleteOrganization, listSuperAdminOrganizations, updateOrganizationStatus } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  trial: 'info',
  active: 'success',
  locked: 'warning',
  inactive: 'neutral',
  suspended: 'danger',
}

const upgradeStatusVariant = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const planVariant = {
  Free: 'neutral',
  Pro: 'primary',
  Enterprise: 'purple',
}

function titleCase(value) {
  if (!value) return 'Unknown'
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const normalizeOrganization = (organization) => ({
  id: organization.id,
  name: organization.name,
  plan: organization.plan?.name || 'No plan',
  status: organization.status || 'unknown',
  upgradeStatus: organization.upgrade_status || 'none',
  businessType: organization.business_type || '—',
  phone: organization.phone || '—',
  createdAt: formatDate(organization.created_at),
})

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [rawOrganizations, setRawOrganizations] = useState([])
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [listError, setListError] = useState('')
  const [actionError, setActionError] = useState('')
  const [updatingStatusId, setUpdatingStatusId] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadOrganizations = async () => {
    setIsLoadingOrganizations(true)
    setListError('')

    const result = await listSuperAdminOrganizations()

    setIsLoadingOrganizations(false)

    if (!result.success) {
      setListError(result.error)
      return
    }

    setRawOrganizations(result.organizations || [])
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  const organizations = useMemo(() => rawOrganizations.map(normalizeOrganization), [rawOrganizations])

  const pendingUpgradeCount = useMemo(
    () => rawOrganizations.filter((organization) => organization.upgrade_status === 'pending').length,
    [rawOrganizations],
  )

  const stats = useMemo(() => {
    const counts = rawOrganizations.reduce(
      (acc, organization) => {
        acc.total += 1
        acc[organization.status] = (acc[organization.status] || 0) + 1
        if (organization.status === 'active') {
          acc.mrr += organization.plan?.price_monthly || 0
        }
        return acc
      },
      { total: 0, mrr: 0 },
    )

    return {
      total: counts.total,
      active: counts.active || 0,
      trial: counts.trial || 0,
      suspended: counts.suspended || 0,
      mrr: counts.mrr,
    }
  }, [rawOrganizations])

  const planChartData = useMemo(() => {
    const counts = rawOrganizations.reduce((acc, organization) => {
      const planName = organization.plan?.name || 'No plan'
      acc[planName] = (acc[planName] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [rawOrganizations])

  const growthChartData = useMemo(() => {
    const withDates = rawOrganizations.filter((organization) => organization.created_at)
    if (withDates.length === 0) return []

    const earliest = withDates.reduce(
      (earliestDate, organization) =>
        new Date(organization.created_at) < earliestDate ? new Date(organization.created_at) : earliestDate,
      new Date(withDates[0].created_at),
    )

    return eachMonthOfInterval({ start: earliest, end: new Date() }).map((monthDate) => {
      const monthEnd = endOfMonth(monthDate)
      const total = withDates.filter((organization) => !isBefore(monthEnd, new Date(organization.created_at))).length
      return { label: format(monthDate, 'MMM yy'), total }
    })
  }, [rawOrganizations])

  const handleToggleSuspend = async (row) => {
    setActionError('')
    setUpdatingStatusId(row.id)

    const nextStatus = row.status === 'suspended' ? 'active' : 'suspended'
    const result = await updateOrganizationStatus(row.id, nextStatus)

    setUpdatingStatusId(null)

    if (!result.success) {
      setActionError(result.error)
      return
    }

    await loadOrganizations()
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setDeleteError('')

    const result = await deleteOrganization(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setDeleteError(result.error)
      return
    }

    setDeleteTarget(null)
    await loadOrganizations()
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card)">
        <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">Platform Overview</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Super Admin · as of {format(new Date(), 'yyyy-MM-dd')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard icon={Building2} iconVariant="primary" label="Total Organizations" value={stats.total} />
        <StatCard icon={CircleCheck} iconVariant="success" label="Active" value={stats.active} />
        <StatCard icon={Clock} iconVariant="info" label="Trial" value={stats.trial} />
        <StatCard icon={Ban} iconVariant="danger" label="Suspended" value={stats.suspended} />
        <StatCard
          icon={TrendingUp}
          iconVariant={pendingUpgradeCount > 0 ? 'warning' : 'neutral'}
          label="Pending Upgrades"
          value={pendingUpgradeCount}
          actions={
            pendingUpgradeCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/superadmin/upgrade-requests')}
                className="text-xs font-semibold text-primary-700 hover:underline"
              >
                Review
              </button>
            )
          }
        />
        <StatCard icon={IndianRupee} iconVariant="success" label="MRR Estimate" value={formatCurrency(stats.mrr)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Organization Growth" subtitle="Cumulative organizations on the platform" className="xl:col-span-2">
          <SalesLineChart data={growthChartData} dataKey="total" valueType="number" tickInterval={3} showDots={false} />
        </Card>
        <Card title="Organizations by Plan">
          <CategoryPieChart data={planChartData} centerLabel={{ value: stats.total, label: 'Total' }} />
        </Card>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      <Card title="Organizations" subtitle="All organizations on the SAAS CRM platform">
        <DataTable
          columns={[
            { key: 'name', header: 'Organization', sortable: true },
            {
              key: 'plan',
              header: 'Plan',
              sortable: true,
              render: (row) => <Badge variant={planVariant[row.plan] || 'neutral'}>{row.plan}</Badge>,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => (
                <Badge variant={statusVariant[row.status] || 'neutral'} dot>
                  {titleCase(row.status)}
                </Badge>
              ),
            },
            {
              key: 'upgradeStatus',
              header: 'Upgrade Request',
              sortable: true,
              render: (row) =>
                row.upgradeStatus && row.upgradeStatus !== 'none' ? (
                  <Badge variant={upgradeStatusVariant[row.upgradeStatus] || 'neutral'}>{titleCase(row.upgradeStatus)}</Badge>
                ) : (
                  <span className="text-neutral-400">—</span>
                ),
            },
            { key: 'businessType', header: 'Business Type', sortable: true },
            { key: 'phone', header: 'Phone', sortable: true },
            { key: 'createdAt', header: 'Created', sortable: true },
          ]}
          data={organizations}
          loading={isLoadingOrganizations}
          emptyTitle={listError ? 'Unable to load organizations' : 'No organizations found'}
          emptyDescription={listError || undefined}
          searchKeys={['name', 'businessType', 'plan', 'status']}
          searchPlaceholder="Search organizations…"
          actions={(row) => [
            { label: 'View details', icon: Eye, onClick: () => navigate(`/superadmin/organizations/${row.id}`) },
            {
              label: row.status === 'suspended' ? 'Reactivate' : 'Suspend',
              icon: row.status === 'suspended' ? ReactivateIcon : BanIcon,
              onClick: () => {
                if (updatingStatusId === row.id) return
                handleToggleSuspend(row)
              },
            },
            {
              label: 'Delete organization',
              icon: Trash2,
              danger: true,
              onClick: () => {
                setDeleteError('')
                setDeleteTarget(row)
              },
            },
          ]}
        />
      </Card>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return
          setDeleteTarget(null)
          setDeleteError('')
        }}
        title="Delete Organization"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete <span className="font-semibold text-neutral-900">{deleteTarget?.name || 'this organization'}</span>? This
            permanently removes all of its users, customers, products, and data. This cannot be undone.
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
                setDeleteTarget(null)
                setDeleteError('')
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete} loading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
