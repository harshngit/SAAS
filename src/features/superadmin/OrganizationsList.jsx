import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import { organizations } from '../../mockData/organizations'
import { formatCurrency } from '../../utils/format'

const statusVariant = {
  Active: 'success',
  Inactive: 'danger',
  Suspended: 'warning',
}

export default function OrganizationsList() {
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
          actions={(row) => [
            { label: 'View Details', onClick: () => {} },
          ]}
        />
      </Card>
    </div>
  )
}
