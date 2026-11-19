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
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import ListFilterPanel, { FilterDateRange } from '../../components/ui/ListFilterPanel'
import { ListOverview, ListSummary, ListTableToolbar, ListStatCard } from '../../components/ui/ListPresentation'
import { resolveDateRange } from '../../utils/dateRange'
import { getAttendance } from '../../api/attendance'
import { listUsers } from '../../api/users'
import { getFileUrl } from '../../api/files'
import { roleLabels } from '../../auth/roles'
import { getSystemRoleFromRoleName } from '../users/userRoleUtils'
import { exportRowsToExcel } from '../../utils/exportToExcel'
import {
  formatDateLabel,
  formatTimeLabel,
  isCheckInOnTime,
  normalizeAttendanceRecord,
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

export default function AdminAttendance() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [usersById, setUsersById] = useState(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { sortBy, sortOrder, toggleSort, sortParams } = useSortState()

  const handleSort = (field) => {
    toggleSort(field)
    setPage(1)
  }

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  const loadAttendance = async () => {
    setIsLoading(true)

    // date_from/date_to are backend-confirmed params (api/attendance.js#getAttendance) - this
    // scopes the fetch to the selected range instead of pulling the organization's entire
    // attendance history on every load.
    const [attendanceResult, usersResult] = await Promise.all([
      getAttendance({ date_from: dateFrom || undefined, date_to: dateTo || undefined, ...sortParams }),
      listUsers(),
    ])

    const nextUsersById = new Map(
      usersResult.success ? usersResult.users.map((user) => [user.id, normalizeUser(user)]) : [],
    )
    setUsersById(nextUsersById)

    setRows(attendanceResult.success ? attendanceResult.records.map(normalizeAttendanceRecord) : [])
    setIsLoading(false)
  }

  useEffect(() => {
    loadAttendance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, sortParams])

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

    return rowsWithUser.filter((row) => {
      const matchesRole = roleFilter === 'all' || row.role === roleFilter
      const matchesUser = userFilter === 'all' || row.userId === userFilter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      const matchesSearch =
        !search ||
        [row.name, row.employeeId].filter(Boolean).some((value) => String(value).toLowerCase().includes(search))

      return matchesRole && matchesUser && matchesStatus && matchesSearch
    })
  }, [rowsWithUser, roleFilter, userFilter, statusFilter, searchTerm])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, userFilter, statusFilter, searchTerm, dateFrom, dateTo, pageSize])

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

    exportRowsToExcel('attendance', [
      ['Employee', 'Employee ID', 'Role', 'Date', 'Status', 'Check In', 'Check Out', 'Work Hours'],
      ...rowsToExport.map((row) => [
        row.name,
        row.employeeId,
        roleLabels[row.role] || row.role,
        row.date,
        row.status,
        formatTimeLabel(row.checkIn) || '-',
        formatTimeLabel(row.checkOut) || '-',
        workHoursLabel(row.checkIn, row.checkOut) || '-',
      ]),
    ])
  }

  return (
    <div className="listing-page space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Attendance</h1>
        <p className="mt-1 text-xs text-neutral-400">Monitor check-ins across every role in your organization.</p>
      </div>

      <ListOverview>
        <ListSummary loading={isLoading} className="grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <ListStatCard icon={UsersRound} label="Total Staff" value={totalStaff} />
          <ListStatCard icon={CalendarCheck} label="Present Today" value={`${presentToday} (${percentOfTotal(presentToday)})`} />
          <ListStatCard icon={Clock} label="On Leave" value={`${onLeaveToday} (${percentOfTotal(onLeaveToday)})`} />
          <ListStatCard icon={Briefcase} label="Week Off" value={`${weekOffToday} (${percentOfTotal(weekOffToday)})`} />
          <ListStatCard icon={Gauge} label="Avg. Working Hours" value={avgWorkingHoursLabel} />
        </ListSummary>
      </ListOverview>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100">
          <ListTableToolbar
            title="Attendance Records"
            subtitle="Select rows with the checkboxes to download only those, or leave none selected to download everything currently filtered."
            search={searchTerm}
            onSearchChange={(event) => { setSearchTerm(event.target.value); setPage(1) }}
            searchPlaceholder="Search by name or ID..."
            actions={(
              <>
                <ListFilterPanel
                  title="Filter Attendance"
                  applied={{ roleFilter, userFilter, statusFilter, datePreset, customFrom, customTo }}
                  defaults={{ roleFilter: 'all', userFilter: 'all', statusFilter: 'all', datePreset: 'today', customFrom: '', customTo: '' }}
                  onApply={(next) => {
                    setRoleFilter(next.roleFilter)
                    setUserFilter(next.userFilter)
                    setStatusFilter(next.statusFilter)
                    setDatePreset(next.datePreset)
                    setCustomFrom(next.customFrom)
                    setCustomTo(next.customTo)
                    setPage(1)
                  }}
                >
                  {({ draft, set, errors }) => (
                    <>
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Role
                        <Select options={roleOptions} value={draft.roleFilter} onChange={(event) => set('roleFilter', event.target.value)} />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Employee
                        <Select options={staffOptions} value={draft.userFilter} onChange={(event) => set('userFilter', event.target.value)} />
                      </label>
                      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Status
                        <Select options={statusOptions} value={draft.statusFilter} onChange={(event) => set('statusFilter', event.target.value)} />
                      </label>
                      <FilterDateRange label="Date" draft={draft} set={set} errors={errors} />
                    </>
                  )}
                </ListFilterPanel>
                <button
                  type="button"
                  onClick={loadAttendance}
                  aria-label="Refresh"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-surface text-neutral-500 transition-colors hover:border-primary-300 hover:text-primary-700"
                >
                  <RotateCw className="size-4" aria-hidden="true" />
                </button>
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={handleDownload}>
                  <Download className="size-4" aria-hidden="true" />
                  Download{selectedKeys.length > 0 ? ` (${selectedKeys.length})` : ''}
                </Button>
              </>
            )}
          />
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          {isLoading ? (
            <LoadingSpinner variant="table" columns={["", "Employee", "Role", "Date", "Status", "Check In", "Check Out", "Work Hours", ""]} checkboxColumn={0} label="Loading attendance..." />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={rows.length === 0 ? 'No attendance records for this date range' : 'No attendance records match these filters'}
              description={rows.length === 0 ? 'Try a wider date range.' : 'Try adjusting your role, employee, status, or search filters.'}
            />
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[0.68rem] font-semibold text-neutral-400">
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
                    <SortableHeaderCell label="Date" sortKey="date" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
                    {/* Status is frontend-derived (Present/Absent from checkIn presence), not a
                        raw backend field - left non-sortable so the sort key never diverges. */}
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <SortableHeaderCell label="Check In" sortKey="office_check_in" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
                    <SortableHeaderCell label="Check Out" sortKey="final_check_out" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="whitespace-nowrap px-4 py-3" />
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
                      <tr
                        key={row.key}
                        onClick={() => navigate(`/admin/attendance/${row.userId}`)}
                        className="cursor-pointer bg-surface shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
                      >
                        <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
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
                              <img src={getFileUrl(row.photo)} alt="" className="size-9 shrink-0 rounded-full object-cover" />
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
                        <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
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
