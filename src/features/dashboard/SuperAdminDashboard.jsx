import { Building2, CircleCheck, Clock, Ban, IndianRupee, Eye, Ban as BanIcon, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import SalesLineChart from '../../components/charts/SalesLineChart'
import CategoryPieChart from '../../components/charts/CategoryPieChart'
import { platformStats } from '../../mockData/platformStats'
import { organizations } from '../../mockData/organizations'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  active: 'success',
  trial: 'info',
  suspended: 'danger',
}

const planVariant = {
  Free: 'neutral',
  Pro: 'primary',
  Enterprise: 'purple',
}

const planChartData = Object.entries(platformStats.planCounts).map(([name, value]) => ({ name, value }))

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="rounded-[1.25rem] border border-neutral-100 bg-white/95 p-5 shadow-(--shadow-card)">
        <h1 className="font-(--font-display) text-3xl font-semibold tracking-tight text-neutral-900">Platform Overview</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Super Admin · as of {platformStats.asOf}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Building2} iconVariant="primary" label="Total Organizations" value={platformStats.totalOrgs} />
        <StatCard icon={CircleCheck} iconVariant="success" label="Active" value={platformStats.activeCount} />
        <StatCard icon={Clock} iconVariant="info" label="Trial" value={platformStats.trialCount} />
        <StatCard icon={Ban} iconVariant="danger" label="Suspended" value={platformStats.suspendedCount} />
        <StatCard
          icon={IndianRupee}
          iconVariant="success"
          label="MRR Estimate"
          value={formatCurrency(platformStats.mrr)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Organization Growth" subtitle="Cumulative organizations on the platform" className="xl:col-span-2">
          <SalesLineChart
            data={platformStats.orgGrowthSeries}
            dataKey="total"
            valueType="number"
            tickInterval={3}
            showDots={false}
          />
        </Card>
        <Card title="Organizations by Plan">
          <CategoryPieChart data={planChartData} centerLabel={{ value: platformStats.totalOrgs, label: 'Total' }} />
        </Card>
      </div>

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
                  {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                </Badge>
              ),
            },
            { key: 'city', header: 'City', sortable: true },
            { key: 'employeeCount', header: 'Employees', sortable: true, align: 'right' },
            { key: 'createdAt', header: 'Created', sortable: true },
          ]}
          data={organizations}
          searchKeys={['name', 'city', 'plan', 'status']}
          searchPlaceholder="Search organizations…"
          actions={(row) => [
            { label: 'View details', icon: Eye, onClick: () => {} },
            {
              label: row.status === 'suspended' ? 'Reactivate' : 'Suspend',
              icon: BanIcon,
              onClick: () => {},
            },
            { label: 'Delete organization', icon: Trash2, danger: true, onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
