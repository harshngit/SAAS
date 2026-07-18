import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Download } from 'lucide-react'

export default function FinancialReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Financial Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">Generate and download financial reports</p>
      </div>

      <Tabs defaultValue="pandl" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pandl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balancesheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow Statement</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="pandl">
          <Card title="Profit & Loss Statement" subtitle="For the period ending 31st July 2026">
            <div className="flex justify-end mb-4">
              <Button variant="secondary" icon={Download}>
                Download PDF
              </Button>
            </div>
            <p className="text-neutral-500">Profit & Loss report will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="balancesheet">
          <Card title="Balance Sheet" subtitle="As on 31st July 2026">
            <div className="flex justify-end mb-4">
              <Button variant="secondary" icon={Download}>
                Download PDF
              </Button>
            </div>
            <p className="text-neutral-500">Balance Sheet report will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow">
          <Card title="Cash Flow Statement" subtitle="For the period ending 31st July 2026">
            <div className="flex justify-end mb-4">
              <Button variant="secondary" icon={Download}>
                Download PDF
              </Button>
            </div>
            <p className="text-neutral-500">Cash Flow Statement will be displayed here.</p>
          </Card>
        </TabsContent>

        <TabsContent value="trial">
          <Card title="Trial Balance" subtitle="As on 31st July 2026">
            <div className="flex justify-end mb-4">
              <Button variant="secondary" icon={Download}>
                Download PDF
              </Button>
            </div>
            <p className="text-neutral-500">Trial Balance report will be displayed here.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
