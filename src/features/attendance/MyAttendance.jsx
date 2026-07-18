import { Card } from '../../components/ui'
import Badge from '../../components/ui/Badge'
import { attendance } from '../../mockData/attendance'

const statusVariant = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Week Off': 'info',
  'On Leave': 'info',
}

export default function MyAttendance() {
  const myAttendance = attendance.find(a => a.userId === 'usr-4')

  if (!myAttendance) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">View your attendance record</p>
      </div>

      <Card title="Attendance History">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Check In
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Check Out
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {myAttendance.records.map((record, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-900">
                    {record.date}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={statusVariant[record.status] || 'neutral'} dot>
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600">
                    {record.checkIn || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600">
                    {record.checkOut || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
