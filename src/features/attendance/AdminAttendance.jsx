import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { getAttendance } from '../../api/attendance'
import { attendance as sampleAttendance } from '../../mockData/attendance'
import { roleLabels } from '../../auth/roles'

const statusVariant = {
  Present: 'success',
  Absent: 'danger',
  'Half Day': 'warning',
  'Week Off': 'info',
  'On Leave': 'info',
}

function flattenSampleAttendance() {
  return sampleAttendance.flatMap((user) =>
    user.records.map((record) => ({
      userId: user.userId,
      name: user.name,
      role: user.role,
      ...record,
    })),
  )
}

export default function AdminAttendance() {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [userFilter, setUserFilter] = useState('all')

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      setIsLoading(true)

      const result = await getAttendance({})

      if (!isMounted) return
      setIsLoading(false)

      if (result.success && result.records.length > 0) {
        setRows(result.records)
        return
      }

      setRows(flattenSampleAttendance())
    }

    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [])

  const userOptions = useMemo(() => {
    const seen = new Map()
    rows.forEach((row) => {
      if (!seen.has(row.userId)) seen.set(row.userId, row.name)
    })
    return [{ value: 'all', label: 'All staff' }, ...Array.from(seen, ([value, label]) => ({ value, label }))]
  }, [rows])

  const filteredRows = useMemo(
    () => (userFilter === 'all' ? rows : rows.filter((row) => row.userId === userFilter)),
    [rows, userFilter],
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Staff Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">Monitor check-ins across every role in your organization</p>
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <Select
            options={userOptions}
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            className="sm:w-64"
          />
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {isLoading ? (
            <LoadingSpinner label="Loading attendance..." />
          ) : filteredRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No attendance records found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-3">Staff</th>
                  <th className="whitespace-nowrap px-4 py-3">Role</th>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Check In</th>
                  <th className="whitespace-nowrap px-4 py-3">Check Out</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${row.userId}-${index}`} className="bg-white shadow-(--shadow-xs)">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary-700 ring-1 ring-primary-100">
                          <Users className="size-4" aria-hidden="true" />
                        </div>
                        <span className="font-medium text-neutral-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{roleLabels[row.role] || row.role}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{row.date}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={statusVariant[row.status] || 'neutral'} dot>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600">{row.checkIn || '-'}</td>
                    <td className="px-4 py-3.5 text-neutral-600">{row.checkOut || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

