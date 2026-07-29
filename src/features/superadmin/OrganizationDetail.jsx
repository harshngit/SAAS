import { useParams } from 'react-router-dom'
import { ArrowLeft, Users, TrendingUp } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
import { organizations } from '../../mockData/organizations'
import { formatCurrency } from '../../utils/format'

export default function OrganizationDetail() {
  const { id } = useParams()
  const organization = organizations.find(o => o.id === id)

  if (!organization) {
    return <div>Organization not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" icon={ArrowLeft} onClick={() => window.history.back()}>
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{organization.name}</h1>
          {/* <p className="mt-1 text-sm text-neutral-500">Organization Details</p> */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={organization.totalUsers} />
        <StatCard icon={TrendingUp} label="Monthly Revenue" value={formatCurrency(organization.mrr)} />
        <Card title="Plan">
          <p className="text-lg font-semibold">{organization.plan}</p>
        </Card>
        <Card title="Status">
          <p className="text-lg font-semibold">{organization.status}</p>
        </Card>
      </div>

      <Card title="Admin Contact">
        <div className="space-y-2">
          <p><span className="font-medium">Name:</span> {organization.adminName}</p>
          <p><span className="font-medium">Email:</span> {organization.adminEmail}</p>
        </div>
      </Card>

      <Card title="Usage Statistics">
        <p className="text-neutral-500">Detailed usage statistics will be displayed here.</p>
      </Card>
    </div>
  )
}
