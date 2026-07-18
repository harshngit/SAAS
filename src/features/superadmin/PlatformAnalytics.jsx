import { Building2, TrendingUp, Users, IndianRupee } from 'lucide-react'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import { organizations } from '../../mockData/organizations'
import { formatCurrency } from '../../utils/format'

export default function PlatformAnalytics() {
  const totalOrgs = organizations.length
  const activeOrgs = organizations.filter(o => o.status === 'Active').length
  const totalMRR = organizations.reduce((sum, o) => sum + o.mrr, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Platform Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">View platform-wide analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Organizations" value={totalOrgs} />
        <StatCard icon={Building2} iconVariant="success" label="Active Organizations" value={activeOrgs} />
        <StatCard icon={IndianRupee} iconVariant="warning" label="Monthly Recurring Revenue" value={formatCurrency(totalMRR)} />
        <StatCard icon={Users} iconVariant="info" label="Total Users" value={organizations.reduce((sum, o) => sum + o.totalUsers, 0)} />
      </div>

      <Tabs defaultValue="mrr" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mrr">MRR Trend</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
        </TabsList>

        <TabsContent value="mrr">
          <Card title="Monthly Recurring Revenue (MRR) Trend">
            <p className="text-neutral-500">MRR chart will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="growth">
          <Card title="Organizational Growth">
            <p className="text-neutral-500">Growth chart will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="churn">
          <Card title="Churn Rate">
            <p className="text-neutral-500">Churn chart will be displayed here.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
