import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import Card from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import { TrendingUp, TrendingDown, IndianRupee } from 'lucide-react'
import { formatCurrency } from '../../utils/format'

export default function GSTSummary() {
  const gstData = {
    outputGST: 25000,
    inputGST: 15000,
    netGSTPayable: 10000,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">GST Summary</h1>
        <p className="mt-1 text-sm text-neutral-500">View GST payable and input tax credit summary</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingUp}
          iconVariant="warning"
          label="Output GST (Collected)"
          value={formatCurrency(gstData.outputGST)}
        />
        <StatCard
          icon={TrendingDown}
          iconVariant="info"
          label="Input GST (Paid)"
          value={formatCurrency(gstData.inputGST)}
        />
        <StatCard
          icon={IndianRupee}
          iconVariant="danger"
          label="Net GST Payable"
          value={formatCurrency(gstData.netGSTPayable)}
        />
      </div>

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card title="Monthly GST Summary">
            <p className="text-neutral-500">Detailed monthly GST report will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="quarterly">
          <Card title="Quarterly GST Summary">
            <p className="text-neutral-500">Detailed quarterly GST report will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="yearly">
          <Card title="Yearly GST Summary">
            <p className="text-neutral-500">Detailed yearly GST report will be displayed here.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
