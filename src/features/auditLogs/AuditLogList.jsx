import { useState } from 'react'
import { History, User, Package, TrendingUp, AlertCircle } from 'lucide-react'
import Card from '../../components/ui/Card'

const initialLogs = [
  { id: 1, action: 'Created', resource: 'User', details: 'Created new user: Priya Patel', user: 'Amit Sharma', time: '2024-07-17 14:30', icon: User },
  { id: 2, action: 'Updated', resource: 'Product', details: 'Updated product: AquaPure 1L price', user: 'Amit Sharma', time: '2024-07-17 13:15', icon: Package },
  { id: 3, action: 'Created', resource: 'Order', details: 'Created new order #1245', user: 'Priya Patel', time: '2024-07-17 12:00', icon: TrendingUp },
  { id: 4, action: 'Alert', resource: 'Stock', details: 'Low stock alert triggered for 500ml', user: 'System', time: '2024-07-17 11:45', icon: AlertCircle },
  { id: 5, action: 'Updated', resource: 'Company Settings', details: 'Updated company address', user: 'Amit Sharma', time: '2024-07-17 10:30', icon: History },
]

export default function AuditLogList() {
  const [logs, setLogs] = useState(initialLogs)

  const getActionColor = (action) => {
    switch (action) {
      case 'Created': return 'text-green-600 bg-green-50'
      case 'Updated': return 'text-blue-600 bg-blue-50'
      case 'Deleted': return 'text-red-600 bg-red-50'
      case 'Alert': return 'text-orange-600 bg-orange-50'
      default: return 'text-neutral-600 bg-neutral-50'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Audit Logs</h1>
        <p className="text-sm text-neutral-500">Track all system activities and changes</p>
      </div>

      <Card>
        <div className="p-6">
          <div className="space-y-4">
            {logs.map((log) => {
              const Icon = log.icon
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-neutral-50 transition-colors">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${getActionColor(log.action)}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">{log.action}</span>
                        <span className="text-sm text-neutral-500">• {log.resource}</span>
                      </div>
                      <span className="text-xs text-neutral-400">{log.time}</span>
                    </div>
                    <p className="text-sm text-neutral-600 mt-1">{log.details}</p>
                    <p className="text-xs text-neutral-500 mt-1">By: {log.user}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
