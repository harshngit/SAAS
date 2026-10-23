import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { isWithinDateRange, resolveDateRange } from '../../utils/dateRange'
import { exportRowsToExcel } from '../../utils/exportToExcel'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications'
import { useAuthStore } from '../../store/authStore'
import { resolveNotificationDestination } from '../../utils/notificationNavigation'

const TYPE_ICON = { success: CheckCircle, alert: AlertCircle, warning: AlertCircle, info: Info }
const TYPE_BADGE_VARIANT = { success: 'success', alert: 'danger', warning: 'warning', info: 'info' }
const TYPE_COLOR_CLASS = {
  success: 'text-green-600 bg-green-50',
  alert: 'text-red-600 bg-red-50',
  warning: 'text-amber-600 bg-amber-50',
  info: 'text-blue-600 bg-blue-50',
}

const READ_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

const ROWS_PER_PAGE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
]

function typeLabel(type) {
  if (!type) return 'Info'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function exportNotifications(rows) {
  const headers = ['Date', 'Type', 'Title', 'Message', 'Status']
  const dataRows = rows.map((n) => [formatTimestamp(n.createdAt), typeLabel(n.type), n.title || '', n.body || '', n.isRead ? 'Read' : 'Unread'])
  exportRowsToExcel('notifications', [headers, ...dataRows])
}

export default function NotificationsList() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Staged in the Filters drawer - nothing takes effect until Apply, same convention used on
  // Audit Log / Super Admin Organizations.
  const [draftType, setDraftType] = useState('')
  const [draftRead, setDraftRead] = useState('')
  const [draftDatePreset, setDraftDatePreset] = useState('all')
  const [draftCustomFrom, setDraftCustomFrom] = useState('')
  const [draftCustomTo, setDraftCustomTo] = useState('')

  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const loadNotifications = async () => {
    setIsLoading(true)
    setLoadError('')

    const result = await listNotifications()

    if (!result.success) {
      setNotifications([])
      setLoadError(result.error)
      setIsLoading(false)
      return
    }

    setNotifications(result.notifications)
    setIsLoading(false)
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const markAsRead = async (notification) => {
    if (notification.isRead) return
    const result = await markNotificationRead(notification.id)
    if (result.success) {
      setNotifications((current) => current.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
    }
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true)
    const result = await markAllNotificationsRead()
    setIsMarkingAll(false)
    if (result.success) {
      setNotifications((current) => current.map((n) => ({ ...n, isRead: true })))
    }
  }

  const handleRowClick = (notification) => {
    markAsRead(notification)
    const destination = resolveNotificationDestination(notification, currentUser)
    if (destination) navigate(destination)
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const openFilters = () => {
    setDraftType(typeFilter)
    setDraftRead(readFilter)
    setDraftDatePreset(datePreset)
    setDraftCustomFrom(customFrom)
    setDraftCustomTo(customTo)
    setShowFilters(true)
  }

  const applyFilters = () => {
    setTypeFilter(draftType)
    setReadFilter(draftRead)
    setDatePreset(draftDatePreset)
    setCustomFrom(draftCustomFrom)
    setCustomTo(draftCustomTo)
    setShowFilters(false)
  }

  const resetFilters = () => {
    setDraftType('')
    setDraftRead('')
    setDraftDatePreset('all')
    setDraftCustomFrom('')
    setDraftCustomTo('')
  }

  // Options derived from whatever is actually loaded - never a guessed list - so a type that
  // doesn't appear in the current notifications never shows as a dead filter option.
  const typeOptions = useMemo(() => {
    const distinct = Array.from(new Set(notifications.map((n) => n.type).filter(Boolean)))
    distinct.sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)))
    return [{ value: '', label: 'All types' }, ...distinct.map((type) => ({ value: type, label: typeLabel(type) }))]
  }, [notifications])

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])

  const filteredNotifications = useMemo(
    () =>
      notifications
        .filter((n) => isWithinDateRange(n.createdAt, dateFrom, dateTo))
        .filter((n) => !typeFilter || n.type === typeFilter)
        .filter((n) => !readFilter || (readFilter === 'unread' ? !n.isRead : n.isRead)),
    [notifications, dateFrom, dateTo, typeFilter, readFilter],
  )

  const { sortBy, sortOrder, toggleSort } = useSortState()
  const visibleNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const base = !query
      ? filteredNotifications
      : filteredNotifications.filter((n) => [n.title, n.body].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)))

    if (!sortBy) return base

    const accessors = {
      title: (n) => n.title?.toLowerCase() || '',
      type: (n) => typeLabel(n.type)?.toLowerCase() || '',
      createdAt: (n) => new Date(n.createdAt || 0).getTime(),
    }
    const accessor = accessors[sortBy]
    if (!accessor) return base

    const sorted = [...base].sort((a, b) => {
      const valueA = accessor(a)
      const valueB = accessor(b)
      if (valueA < valueB) return -1
      if (valueA > valueB) return 1
      return 0
    })
    return sortOrder === 'desc' ? sorted.reverse() : sorted
  }, [filteredNotifications, searchTerm, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(visibleNotifications.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStartIndex = visibleNotifications.length === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage + 1
  const pageEndIndex = Math.min(safeCurrentPage * rowsPerPage, visibleNotifications.length)
  const paginatedNotifications = useMemo(
    () => visibleNotifications.slice((safeCurrentPage - 1) * rowsPerPage, safeCurrentPage * rowsPerPage),
    [visibleNotifications, rowsPerPage, safeCurrentPage],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, typeFilter, readFilter, datePreset, customFrom, customTo, rowsPerPage])

  const activeFilterCount = [typeFilter, readFilter, datePreset !== 'all' ? datePreset : ''].filter(Boolean).length

  return (
    <div className="listing-page space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Notifications</h1>
              <p className="mt-1 text-xs text-neutral-400">
                {unreadCount} unread of {notifications.length} total
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search notifications..."
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-surface py-1.5 pl-10 pr-4 text-xs text-neutral-700 shadow-(--shadow-xs) placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={openFilters}>
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl px-3.5" onClick={() => exportNotifications(visibleNotifications)}>
                <Download className="size-4" aria-hidden="true" />
                Export
              </Button>
              {unreadCount > 0 && (
                <Button type="button" size="sm" className="h-9 rounded-xl px-3.5" loading={isMarkingAll} onClick={handleMarkAllRead}>
                  <CheckCheck className="size-4" aria-hidden="true" />
                  Mark all as read
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {showFilters && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onClick={() => setShowFilters(false)}>
          <aside
            className="flex h-full w-full max-w-sm flex-col border-l border-surface-border bg-surface shadow-[0_24px_70px_-32px_rgb(15_23_42/0.6)]"
            onClick={(event) => event.stopPropagation()}
            aria-label="Notification filters"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-surface-border p-6">
              <div>
                <h2 className="font-(--font-display) text-lg font-semibold tracking-tight text-fg">Filters</h2>
                <p className="mt-1 text-sm text-fg-muted">Refine notifications by type, status and date.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
                aria-label="Close filters"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <Select label="Type" options={typeOptions} value={draftType} onChange={(event) => setDraftType(event.target.value)} />
              <Select label="Status" options={READ_STATUS_OPTIONS} value={draftRead} onChange={(event) => setDraftRead(event.target.value)} />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-fg">Date</label>
                <DateRangeFilter
                  preset={draftDatePreset}
                  onPresetChange={setDraftDatePreset}
                  customFrom={draftCustomFrom}
                  customTo={draftCustomTo}
                  onCustomChange={({ from, to }) => {
                    setDraftCustomFrom(from)
                    setDraftCustomTo(to)
                  }}
                />
              </div>
            </div>

            <div className="flex shrink-0 justify-between gap-3 border-t border-surface-border p-6">
              <Button type="button" variant="secondary" onClick={resetFilters}>Reset</Button>
              <Button type="button" onClick={applyFilters}>Apply Filters</Button>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto bg-surface px-0 py-0">
          {isLoading ? (
            <LoadingSpinner variant="table" minWidth="min-w-[48rem]" columns={["Notification", "Type", "Status", "Date"]} label="Loading notifications..." />
          ) : loadError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadNotifications}>
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
          ) : visibleNotifications.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-neutral-900">No notifications found</p>
              <p className="mt-1 text-sm text-neutral-500">Try changing the search or filters.</p>
            </div>
          ) : (
            <table className="listing-table w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted text-[0.7rem] font-semibold text-fg-muted">
                  <SortableHeaderCell label="Notification" sortKey="title" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                  <SortableHeaderCell label="Type" sortKey="type" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                  <th className="px-6 py-6">Status</th>
                  <SortableHeaderCell label="Date" sortKey="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} className="px-6 py-6" />
                </tr>
              </thead>
              <tbody>
                {paginatedNotifications.map((notification) => {
                  const Icon = TYPE_ICON[notification.type] || Info
                  const colorClass = TYPE_COLOR_CLASS[notification.type] || 'text-neutral-600 bg-neutral-50'
                  return (
                    <tr
                      key={notification.id}
                      onClick={() => handleRowClick(notification)}
                      className={`cursor-pointer transition-colors hover:bg-primary-50/30 ${!notification.isRead ? 'bg-primary-50/20' : 'bg-surface'}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-3">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
                            <Icon className="size-4.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900">{notification.title || 'Notification'}</p>
                            {notification.body && <p className="mt-0.5 max-w-md text-xs text-neutral-500">{notification.body}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={TYPE_BADGE_VARIANT[notification.type] || 'neutral'}>{typeLabel(notification.type)}</Badge>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant={notification.isRead ? 'neutral' : 'primary'} dot>{notification.isRead ? 'Read' : 'Unread'}</Badge>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-neutral-600">{formatTimestamp(notification.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isLoading && !loadError && visibleNotifications.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-surface-border px-6 py-4 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Showing <span className="font-semibold text-fg">{pageStartIndex}-{pageEndIndex}</span> of{' '}
                <span className="font-semibold text-fg">{visibleNotifications.length}</span>
              </span>
              <span className="hidden h-4 w-px bg-surface-border sm:block" aria-hidden="true" />
              <label className="flex items-center gap-3">
                <span>Rows per page</span>
                <Select
                  options={ROWS_PER_PAGE_OPTIONS}
                  value={String(rowsPerPage)}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  triggerClassName="h-8 bg-surface py-1 text-xs"
                  className="w-20"
                />
              </label>
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="flex size-10 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <span className="font-semibold text-fg">{safeCurrentPage} / {totalPages}</span>
              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="flex size-10 items-center justify-center rounded-full border border-surface-border text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Next page"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
