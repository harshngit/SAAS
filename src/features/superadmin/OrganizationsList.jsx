import { useEffect, useState } from 'react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { listSuperAdminOrganizations } from '../../api/superadmin'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Active: 'success',
  Inactive: 'danger',
  Suspended: 'warning',
  Trial: 'info',
  Locked: 'warning',
}

export default function OrganizationsList() {
  const [organizations, setOrganizations] = useState([])
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [listError, setListError] = useState('')

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

  useEffect(() => {
    let isMounted = true

    async function loadOrganizations() {
      setIsLoadingOrganizations(true)
      setListError('')

      const result = await listSuperAdminOrganizations()

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
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Organizations</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage all organizations on the platform</p>
      </div>

      <Card title="Organizations List">
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
          ]}
          data={organizations}
          searchKeys={['id', 'name', 'adminName', 'plan', 'status']}
          searchPlaceholder="Search organizations..."
          loading={isLoadingOrganizations}
          emptyTitle={listError ? 'Unable to load organizations' : 'No organizations found'}
          emptyDescription={listError || undefined}
          actions={() => [
            { label: 'View Details', onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
