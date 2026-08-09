import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  Clock,
  Download,
  Filter,
  Gauge,
  RotateCw,
  Search,
  UsersRound,
  Briefcase,
} from 'lucide-react'
import ActionMenu from '../../components/ui/ActionMenu'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { getAttendance } from '../../api/attendance'
import { listUsers } from '../../api/users'
import { attendance as sampleAttendance } from '../../mockData/attendance'
import { roleLabels } from '../../auth/roles'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'
import {
  downloadCsv,
  formatDateLabel,
  formatTimeLabel,
  isCheckInOnTime,
  statusVariant,
  workHoursLabel,
  workMinutes,
} from './attendanceUtils'

const statusOptions = [
  { value: 'all', label: 'Status: All' },
  { value: 'Present', label: 'Present' },
  { value: 'Absent', label: 'Absent' },
  { value: 'Half Day', label: 'Half Day' },
  { value: 'Week Off', label: 'Week Off' },
  { value: 'On Leave', label: 'On Leave' },
]

const dateRangeOptions = [
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

const pageSizeOptions = [10, 25, 50].map((value) => ({ value: String(value), label: `${value} / page` }))

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name || '',
    role: user.role || user.system_role || getSystemRoleFromRoleName(user.role_detail?.name) || '',
    employeeId: user.employee_id || user.employeeId || '',
    photo: user.profile_photo || user.profilePhoto || '',
  }
}

function normalizeAttendanceRecord(record) {
  return {
    userId: record.user_id || record.userId || '',
    date: record.date || record.attendance_date || '',
    status: record.status || 'Present',
    checkIn: record.check_in || record.checkIn || null,
    checkOut: record.check_out || record.checkOut || null,
    name: record.name || '',
    role: record.role || '',
  }
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
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [usersById, setUsersById] = useState(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [dateRangeFilter, setDateRangeFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadAttendance = async () => {
    setIsLoading(true)

    const [attendanceResult, usersResult] = await Promise.all([getAttendance({}), listUsers()])

    const nextUsersById = new Map(
      usersResult.success ? usersResult.users.map((user) => [user.id, normalizeUser(user)]) : [],
    )
    setUsersById(nextUsersById)

    if (attendanceResult.success && attendanceResult.records.length > 0) {
      setRows(attendanceResult.records.map(normalizeAttendanceRecord))
      setIsLoading(false)
      return
    }

    setRows(flattenSampleAttendance())
    setIsLoading(false)
  }

  useEffect(() => {
    loadAttendance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rowsWithUser = useMemo(
    () =>
      rows.map((row) => {
        const user = usersById.get(row.userId)
        return {
          ...row,
          key: `${row.userId}-${row.date}`,
          name: user?.name || row.name || 'Unknown staff',
          role: user?.role || row.role || '',
          employeeId: user?.employeeId || row.userId,
          photo: user?.photo || '',
        }
      }),
    [rows, usersById],
  )

  const staffOptions = useMemo(() => {
    const seen = new Map()
    rowsWithUser.forEach((row) => {
      if (!seen.has(row.userId)) seen.set(row.userId, row.name)
    })
    return [{ value: 'all', label: 'All Employees' }, ...Array.from(seen, ([value, label]) => ({ value, label }))]
  }, [rowsWithUser])

  const roleOptions = useMemo(() => {
    const seen = new Set(rowsWithUser.map((row) => row.role).filter(Boolean))
    return [
      { value: 'all', label: 'All Roles' },
      ...Array.from(seen).map((role) => ({ value: role, label: roleLabels[role] || role })),
    ]
  }, [rowsWithUser])

  const latestDate = useMemo(
    () => rowsWithUser.reduce((latest, row) => (!latest || row.date > latest ? row.date : latest), ''),
    [rowsWithUser],
  )

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    const cutoffDays = dateRangeFilter === 'today' ? 0 : dateRangeFilter === 'all' ? null : Number(dateRangeFilter)
    const latestTime = latestDate ? new Date(latestDate).getTime() : null

    return rowsWithUser.filter((row) => {
      const matchesRole = roleFilter === 'all' || row.role === roleFilter
      const matchesUser = userFilter === 'all' || row.userId === userFilter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      const matchesSearch =
        !search ||
        [row.name, row.employeeId].filter(Boolean).some((value) => String(value).toLowerCase().includes(search))

      let matchesDate = true
      if (cutoffDays != null && latestTime != null) {
        const rowTime = new Date(row.date).getTime()
        matchesDate = !Number.isNaN(rowTime) && latestTime - rowTime <= cutoffDays * 86400000 && rowTime <= latestTime
      }

      return matchesRole && matchesUser && matchesStatus && matchesSearch && matchesDate
    })
  }, [rowsWithUser, roleFilter, userFilter, statusFilter, searchTerm, dateRangeFilter, latestDate])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, userFilter, statusFilter, searchTerm, dateRangeFilter, pageSize])

  const todaysRows = useMemo(() => rowsWithUser.filter((row) => row.date === latestDate), [rowsWithUser, latestDate])
  const totalStaff = useMemo(() => new Set(rowsWithUser.map((row) => row.userId)).size, [rowsWithUser])
  const presentToday = todaysRows.filter((row) => row.status === 'Present').length
  const onLeaveToday = todaysRows.filter((row) => row.status === 'On Leave').length
  const weekOffToday = todaysRows.filter((row) => row.status === 'Week Off').length
  const percentOfTotal = (count) => (totalStaff ? `${((count / totalStaff) * 100).toFixed(2)}% of total` : '—')

  const avgWorkingHoursLabel = useMemo(() => {
    const minutesList = todaysRows.map((row) => workMinutes(row.checkIn, row.checkOut)).filter((value) => value != null)
    if (minutesList.length === 0) return '—'
    const average = minutesList.reduce((sum, value) => sum + value, 0) / minutesList.length
    return `${Math.floor(average / 60)}h ${String(Math.round(average % 60)).padStart(2, '0')}m`
  }, [todaysRows])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const pageNumbers = useMemo(() => {
    const pages = []
    for (let index = 1; index <= totalPages; index += 1) {
      if (index === 1 || index === totalPages || Math.abs(index - currentPage) <= 1) {
        pages.push(index)
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…')
      }
    }
    return pages
  }, [totalPages, currentPage])

  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((row) => selectedKeys.includes(row.key))

  const toggleRowSelected = (key) => {
    setSelectedKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  const toggleAllVisibleSelected = () => {
    if (allVisibleSelected) {
      setSelectedKeys((current) => current.filter((key) => !paginatedRows.some((row) => row.key === key)))
      return
    }
    setSelectedKeys((current) => [...new Set([...current, ...paginatedRows.map((row) => row.key)])])
  }

  const handleDownload = () => {
    const rowsToExport = selectedKeys.length > 0
      ? filteredRows.filter((row) => selectedKeys.includes(row.key))
      : filteredRows

    downloadCsv(
      'attendance.csv',
      ['Employee', 'Employee ID', 'Role', 'Date', 'Status', 'Check In', 'Check Out', 'Work Hours'],
      rowsToExport.map((row) => [
        row.name,
        row.employeeId,
        roleLabels[row.role] || row.role,
        row.date,
        row.status,
        formatTimeLabel(row.checkIn) || '-',
        formatTimeLabel(row.checkOut) || '-',
        workHoursLabel(row.checkIn, row.checkOut) || '-',
      ]),
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Attendance</h1>
        <p className="mt-1 text-sm text-neutral-500">Monitor check-ins across every role in your organization.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Total Staff</p>
            <p className="text-xl font-semibold text-neutral-900">{totalStaff}</p>
            <p className="text-xs text-neutral-400">All roles</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <CalendarCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Present Today</p>
            <p className="text-xl font-semibold text-neutral-900">{presentToday}</p>
            <p className="text-xs text-neutral-400">{percentOfTotal(presentToday)}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <Clock className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">On Leave</p>
            <p className="text-xl font-semibold text-neutral-900">{onLeaveToday}</p>
            <p className="text-xs text-neutral-400">{percentOfTotal(onLeaveToday)}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <Briefcase className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Week Off</p>
            <p className="text-xl font-semibold text-neutral-900">{weekOffToday}</p>
            <p className="text-xs text-neutral-400">{percentOfTotal(weekOffToday)}</p>
          </div>
        </Card>
        <Card bodyClassName="flex items-center gap-3" className="p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200">
            <Gauge className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">Avg. Working Hours</p>
            <p className="text-xl font-semibold text-neutral-900">{avgWorkingHoursLabel}</p>
            <p className="text-xs text-neutral-400">Today</p>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select options={roleOptions} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="w-44" triggerClassName="h-9 bg-neutral-50 py-1.5" />
            <Select options={staffOptions} value={userFilter} onChange={(event) => setUserFilter(event.target.value)} className="w-44" triggerClassName="h-9 bg-neutral-50 py-1.5" />
            <Select options={dateRangeOptions} value={dateRangeFilter} onChange={(event) => setDateRangeFilter(event.target.value)} className="w-36" triggerClassName="h-9 bg-neutral-50 py-1.5" />
            <Select options={statusOptions} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-36" triggerClassName="h-9 bg-neutral-50 py-1.5" />

            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name or ID..."
                className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>

            <button
              type="button"
              onClick={loadAttendance}
              aria-label="Refresh"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
            >
              <RotateCw className="size-4" aria-hidden="true" />
            </button>

            <Button type="button" variant={showMoreFilters ? 'primary' : 'outline'} size="sm" className="h-9 rounded-xl" onClick={() => setShowMoreFilters((current) => !current)}>
              <Filter className="size-4" aria-hidden="true" />
              More Filters
            </Button>

            <Button type="button" variant="outline" size="sm" className="ml-auto h-9 rounded-xl" onClick={handleDownload}>
              <Download className="size-4" aria-hidden="true" />
              Download{selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ''}
            </Button>
          </div>

          {showMoreFilters && (
            <p className="mt-3 text-xs text-neutral-400">
              Tip: select rows with the checkboxes to download only those records, or leave nothing selected to download everything currently filtered.
            </p>
          )}
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 px-5 py-4">
          {isLoading ? (
            <LoadingSpinner label="Loading attendance..." />
          ) : filteredRows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance records found" description="Try adjusting your filters." />
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisibleSelected}
                        aria-label="Select all visible rows"
                        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    <th className="whitespace-nowrap px-4 py-3">Employee</th>
                    <th className="whitespace-nowrap px-4 py-3">Role</th>
                    <th className="whitespace-nowrap px-4 py-3">Date</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <th className="whitespace-nowrap px-4 py-3">Check In</th>
                    <th className="whitespace-nowrap px-4 py-3">Check Out</th>
                    <th className="whitespace-nowrap px-4 py-3">Work Hours</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => {
                    const dateLabel = formatDateLabel(row.date)
                    const onTime = isCheckInOnTime(row.checkIn)
                    const hours = workHoursLabel(row.checkIn, row.checkOut)

                    return (
                      <tr key={row.key} className="bg-white shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35">
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedKeys.includes(row.key)}
                            onChange={() => toggleRowSelected(row.key)}
                            aria-label={`Select ${row.name}`}
                            className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/attendance/${row.userId}`)}
                            className="flex items-center gap-3 text-left"
                          >
                            {row.photo ? (
                              <img src={row.photo} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                            ) : (
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">
                                {getInitials(row.name) || <UsersRound className="size-4" aria-hidden="true" />}
                              </span>
                            )}
                            <span>
                              <span className="block font-medium text-neutral-900 hover:text-primary-700 hover:underline">{row.name}</span>
                              <span className="block text-xs text-neutral-400">{row.employeeId}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-neutral-600">{roleLabels[row.role] || row.role || '—'}</td>
                        <td className="px-4 py-3.5 text-neutral-600">
                          <span className="block">{dateLabel.full}</span>
                          <span className="block text-xs text-neutral-400">{dateLabel.weekday}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={statusVariant[row.status] || 'neutral'} dot>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-neutral-600">
                          {formatTimeLabel(row.checkIn) ? (
                            <span className="flex items-center gap-1.5">
                              {formatTimeLabel(row.checkIn)}
                              {onTime != null && (
                                <Badge variant={onTime ? 'success' : 'warning'} className="px-1.5 py-0.5 text-[0.62rem]">
                                  {onTime ? 'On time' : 'Late'}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-600">{formatTimeLabel(row.checkOut) || '-'}</td>
                        <td className="px-4 py-3.5 font-medium text-primary-700">{hours || '-'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <ActionMenu
                            items={[
                              { label: 'View Details', onClick: () => navigate(`/admin/attendance/${row.userId}`) },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-neutral-400">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} entries
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    {pageNumbers.map((item, index) =>
                      item === '…' ? (
                        <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-neutral-400">…</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                            item === currentPage ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </div>
                  <Select
                    options={pageSizeOptions}
                    value={String(pageSize)}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="w-32"
                    triggerClassName="h-9 bg-neutral-50 py-1.5"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
