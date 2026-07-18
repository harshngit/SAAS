import { BarChart3, Download, FileText, TrendingUp, Users } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const reportTypes = [
  { id: 'sales', name: 'Sales Report', icon: TrendingUp, description: 'Detailed sales report with daily, weekly, monthly stats' },
  { id: 'inventory', name: 'Inventory Report', icon: BarChart3, description: 'Current stock levels, low stock alerts' },
  { id: 'customers', name: 'Customer Report', icon: Users, description: 'Customer purchases, top customers' },
  { id: 'purchases', name: 'Purchase Report', icon: FileText, description: 'Purchase history and supplier report' },
]

export default function ReportsHub() {
  const handleExport = (type) => {
    alert(`Exporting ${type} report...`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Reports</h1>
        <p className="text-sm text-neutral-500">Access and download all your business reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => (
          <Card key={report.id} className="hover:shadow-lg transition-all">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700">
                  <report.icon className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">{report.name}</h3>
              </div>
              <p className="text-sm text-neutral-600 mb-4">{report.description}</p>
              <Button onClick={() => handleExport(report.name)} variant="secondary" className="w-full">
                <Download className="size-4 mr-2" />
                Download Report
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
