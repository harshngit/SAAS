import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, RotateCw, Search } from 'lucide-react'
import { format, isSameDay, isValid, parseISO } from 'date-fns'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DateRangeFilter from '../../components/ui/DateRangeFilter'
import ListFilterPanel from '../../components/ui/ListFilterPanel'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import SortableHeaderCell from '../../components/ui/SortableHeaderCell'
import { useSortState } from '../../hooks/useSortState'
import { getVehicleStockHistory, getVehicleStockToday } from '../../api/vehicleStock'
import { DEMO_EMPTY, DEMO_MODE } from '../../config/demoMode'
import { demoVehicleSessionResolved } from '../orders/orderDemoData'
import { resolveDateRange } from '../../utils/dateRange'
import { exportRowsToExcel } from '../../utils/exportToExcel'

const basePath = '/admin/vehicle-stock'

// Explicit dev switch only (VITE_DEMO_DATA=true) - never inferred from an empty/failed response.
// Demo shows the one local demo session as a single row; no demo API calls are made.
const DEMO_ENABLED = DEMO_MODE && !DEMO_EMPTY

function demoRows() {
  const session = demoVehicleSessionResolved()
  const sum = (field) => session.items.reduce((total, item) => total + (Number(item[field]) || 0), 0)
  return [{
    id: session.id,
    date: session.date,
    vehicleId: session.vehicleId,
    vehicleNumber: session.vehicleNumber,
    deliveryPartnerId: session.deliveryPartnerId,
    driverName: session.deliveryPartnerName,
    warehouseId: session.warehouseId,
    orderUnits: sum('loadedQuantity'),
    loadedUnits: sum('loadedQuantity') + sum('extraQuantity'),
    deliveredUnits: sum('deliveredQuantity'),
    returnedUnits: sum('returnedQuantity'),
    availableUnits: sum('remainingQuantity'),
    itemCount: session.items.length,
    status: session.status,
    updatedAt: session.lastLoadedAt,
  }]
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const EXPORT_PAGE_SIZE = 100
const EXPORT_MAX_PAGES = 200

// Row.date is UTC. A full timestamp without a zone designator is read as UTC (then shown in the
// viewer's local time); a bare yyyy-mm-dd is a calendar day and is kept as that same local day.
function parseRowDate(value) {
  if (!value) return null
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const day = parseISO(text)
    return isValid(day) ? { date: day, hasTime: false } : null
  }
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text)
  const date = new Date(hasZone ? text : `${text}Z`)
  return Number.isNaN(date.getTime()) ? null : { date, hasTime: true }
}

function formatHistoryDate(value) {
  const parsed = parseRowDate(value)
  if (!parsed) return '—'
  return format(parsed.date, parsed.hasTime ? 'dd-MM-yyyy HH:mm' : 'dd-MM-yyyy')
}

// Small caption under Vehicle No when an old, still-active run is listed among today's rows.
function loadedOnLabel(value) {
  const parsed = parseRowDate(value)
  if (!parsed || isSameDay(parsed.date, new Date())) return ''
  return `Loaded on ${format(parsed.date, 'dd MMM')}`
}

function StatusBadge({ status }) {
  return status === 'active'
    ? <Badge variant="success" dot>Active</Badge>
    : <Badge variant="neutral" dot>Closed</Badge>
}

function QtyCell({ value, strong = false }) {
  return <span className={`tabular-nums ${strong ? 'font-semibold text-neutral-900' : ''}`}>{Number(value) || 0}</span>
}

function StockTable({ rows, onOpen, showLoadedOn = false, dateColumn = false, sort }) {
  const { sortBy, sortOrder, onSort } = sort || {}
  const headerClass = 'whitespace-nowrap px-4 py-3'
  const numberHeader = `${headerClass} text-right`

  return (
    <table className="w-full min-w-4xl text-left text-sm">
      <thead>
        <tr className="text-[0.68rem] font-semibold text-neutral-400">
          {dateColumn && <SortableHeaderCell label="Date" sortKey="date" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className={headerClass} />}
          {sort
            ? <SortableHeaderCell label="Vehicle No" sortKey="vehicle_number" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className={headerClass} />
            : <th className={headerClass}>Vehicle No</th>}
          {sort
            ? <SortableHeaderCell label="Driver Name" sortKey="delivery_partner" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className={headerClass} />
            : <th className={headerClass}>Driver Name</th>}
          <th className={numberHeader}>Order Units</th>
          <th className={numberHeader}>Loaded Units</th>
          <th className={numberHeader}>Delivered</th>
          <th className={numberHeader}>Returned</th>
          <th className={numberHeader}>Available</th>
          {sort
            ? <SortableHeaderCell label="Status" sortKey="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className={headerClass} />
            : <th className={headerClass}>Status</th>}
          <th className={numberHeader}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const loadedOn = showLoadedOn ? loadedOnLabel(row.date) : ''
          return (
            <tr
              key={row.id}
              onClick={() => onOpen(row)}
              className="cursor-pointer bg-surface shadow-(--shadow-xs) transition-colors hover:bg-primary-50/35"
            >
              {dateColumn && <td className="whitespace-nowrap px-4 py-3.5 text-neutral-600">{formatHistoryDate(row.date)}</td>}
              <td className="px-4 py-3.5">
                <p className="font-semibold text-neutral-900">{row.vehicleNumber || '—'}</p>
                {loadedOn && <p className="mt-0.5 text-xs text-neutral-400">{loadedOn}</p>}
              </td>
              <td className="px-4 py-3.5 text-neutral-600">{row.driverName || '—'}</td>
              <td className="px-4 py-3.5 text-right text-neutral-600"><QtyCell value={row.orderUnits} /></td>
              <td className="px-4 py-3.5 text-right text-neutral-600"><QtyCell value={row.loadedUnits} /></td>
              <td className="px-4 py-3.5 text-right text-neutral-600"><QtyCell value={row.deliveredUnits} /></td>
              <td className="px-4 py-3.5 text-right text-neutral-600"><QtyCell value={row.returnedUnits} /></td>
              <td className="px-4 py-3.5 text-right"><QtyCell value={row.availableUnits} strong /></td>
              <td className="px-4 py-3.5"><StatusBadge status={row.status} /></td>
              <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl px-3" onClick={() => onOpen(row)}>
                  Detail View
                </Button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TableState({ isLoading, error, onRetry, isEmpty, emptyText, columns, children }) {
  if (isLoading) {
    return (
      <div className="py-10">
        <LoadingSpinner variant="table" columns={columns} label="Loading vehicle stock..." />
      </div>
    )
  }
  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }
  if (isEmpty) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-neutral-900">{emptyText}</p>
      </div>
    )
  }
  return children
}

const TABLE_COLUMNS = ['Vehicle No', 'Driver Name', 'Order Units', 'Loaded Units', 'Delivered', 'Returned', 'Available', 'Status', 'Actions']

export default function VehicleStockList() {
  const navigate = useNavigate()
  const openDetail = useCallback((row) => navigate(`${basePath}/${encodeURIComponent(row.id)}`), [navigate])

  // ---- Today's Vehicle Load Information
  const [todayRows, setTodayRows] = useState([])
  const [todayLoading, setTodayLoading] = useState(true)
  const [todayError, setTodayError] = useState('')

  const loadToday = useCallback(async () => {
    setTodayLoading(true)
    setTodayError('')
    if (DEMO_ENABLED) {
      setTodayRows(demoRows())
      setTodayLoading(false)
      return
    }
    const result = await getVehicleStockToday()
    if (!result.success) {
      setTodayRows([])
      setTodayError(result.error)
    } else {
      setTodayRows(result.rows)
    }
    setTodayLoading(false)
  }, [])

  useEffect(() => {
    loadToday()
  }, [loadToday])

  // ---- Vehicle Load History
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')
  const { sortBy, sortOrder, toggleSort } = useSortState()

  const [historyRows, setHistoryRows] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const { dateFrom, dateTo } = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo])
  const hasExtraFilters = datePreset !== 'all'

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(handle)
  }, [searchTerm])

  const handleSort = (field) => {
    toggleSort(field)
    setPage(1)
  }

  const historyParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortBy ? sortOrder : undefined,
  }), [debouncedSearch, statusFilter, dateFrom, dateTo, sortBy, sortOrder])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')
    if (DEMO_ENABLED) {
      const rows = demoRows()
      setHistoryRows(rows)
      setTotal(rows.length)
      setTotalPages(1)
      setHistoryLoading(false)
      return
    }
    const result = await getVehicleStockHistory({ ...historyParams, page, pageSize: Number(pageSize) })
    if (!result.success) {
      setHistoryRows([])
      setTotal(0)
      setHistoryError(result.error)
    } else {
      setHistoryRows(result.rows)
      setTotal(result.total)
      setTotalPages(Math.max(1, result.totalPages || 1))
    }
    setHistoryLoading(false)
  }, [historyParams, page, pageSize])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Export: every page of the CURRENT filters/sort (100 per request), not just the visible page.
  const handleExport = async () => {
    setIsExporting(true)
    setExportError('')
    const all = []
    let currentPage = 1
    let lastPage = 1
    if (DEMO_ENABLED) all.push(...demoRows())
    else do {
      const result = await getVehicleStockHistory({ ...historyParams, page: currentPage, pageSize: EXPORT_PAGE_SIZE })
      if (!result.success) {
        setExportError(result.error)
        setIsExporting(false)
        return
      }
      all.push(...result.rows)
      lastPage = Math.max(1, result.totalPages || 1)
      currentPage += 1
    } while (currentPage <= lastPage && currentPage <= EXPORT_MAX_PAGES)

    const rows = [
      ['Date', 'Vehicle No', 'Driver Name', 'Order Units', 'Loaded Units', 'Delivered', 'Returned', 'Available', 'Status'],
      ...all.map((row) => [
        formatHistoryDate(row.date),
        row.vehicleNumber || '',
        row.driverName || '',
        row.orderUnits,
        row.loadedUnits,
        row.deliveredUnits,
        row.returnedUnits,
        row.availableUnits,
        row.status === 'active' ? 'Active' : 'Closed',
      ]),
    ]
    await exportRowsToExcel(`vehicle-load-history-${format(new Date(), 'yyyy-MM-dd')}`, rows, 'Vehicle Load History')
    setIsExporting(false)
  }

  const clearExtraFilters = () => {
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
    setPage(1)
  }

  const rangeStart = historyRows.length === 0 ? 0 : (page - 1) * Number(pageSize) + 1
  const rangeEnd = Math.min(total, (page - 1) * Number(pageSize) + historyRows.length)
  const hasHistoryFilters = Boolean(debouncedSearch) || statusFilter !== 'all' || hasExtraFilters

  return (
    <div className="listing-page space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Vehicle Stock</h1>
        <p className="mt-1 text-xs text-neutral-400">Stock loaded on delivery vehicles - today&apos;s runs and the full load history.</p>
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Today&apos;s Vehicle Load Information</h2>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-2xl px-3.5" onClick={loadToday} disabled={todayLoading}>
            <RotateCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          <TableState
            isLoading={todayLoading}
            error={todayError}
            onRetry={loadToday}
            isEmpty={todayRows.length === 0}
            emptyText="No vehicle loads for today."
            columns={TABLE_COLUMNS}
          >
            <StockTable rows={todayRows} onOpen={openDetail} showLoadedOn />
          </TableState>
        </div>
      </Card>

      <Card className="p-0">
        <div className="border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Vehicle Load History</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search vehicle no or driver"
                  className="h-9 w-full rounded-xl border border-neutral-100 bg-neutral-50 py-1.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                options={STATUS_FILTERS}
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
                className="sm:w-40"
                triggerClassName="h-9 bg-neutral-50 py-1.5"
              />
              <ListFilterPanel title="Filter Vehicle Load History">
                <div className="flex flex-col gap-2 text-sm font-medium text-neutral-700">Date
                  <DateRangeFilter
                    preset={datePreset}
                    onPresetChange={(value) => { setDatePreset(value); setPage(1) }}
                    customFrom={customFrom}
                    customTo={customTo}
                    onCustomChange={({ from, to }) => { setCustomFrom(from); setCustomTo(to); setPage(1) }}
                  />
                </div>
                {hasExtraFilters && (
                  <button type="button" onClick={clearExtraFilters} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">Clear all</button>
                )}
              </ListFilterPanel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl px-3.5"
                onClick={handleExport}
                loading={isExporting}
                disabled={isExporting || historyLoading || total === 0}
              >
                <Download className="size-4" aria-hidden="true" />
                Export to Excel
              </Button>
            </div>
          </div>
          {exportError && <p className="mt-3 text-sm text-red-600">{exportError}</p>}
        </div>

        <div className="overflow-x-auto bg-neutral-50/35 py-4">
          <TableState
            isLoading={historyLoading}
            error={historyError}
            onRetry={loadHistory}
            isEmpty={historyRows.length === 0}
            emptyText={hasHistoryFilters ? 'No vehicle loads match these filters.' : 'No vehicle load history yet.'}
            columns={['Date', ...TABLE_COLUMNS]}
          >
            <StockTable rows={historyRows} onOpen={openDetail} dateColumn sort={{ sortBy, sortOrder, onSort: handleSort }} />
          </TableState>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span>
              Showing <span className="font-semibold text-neutral-700">{rangeStart}-{rangeEnd}</span> of{' '}
              <span className="font-semibold text-neutral-700">{total}</span>
            </span>
            <span className="hidden text-neutral-300 sm:inline">|</span>
            <label className="flex items-center gap-2">Rows per page
              <Select
                options={PAGE_SIZE_OPTIONS}
                value={pageSize}
                onChange={(event) => { setPageSize(event.target.value); setPage(1) }}
                className="w-20"
                triggerClassName="h-8 bg-surface py-1 text-xs"
              />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page === 1 || historyLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-14 text-center text-xs font-medium text-neutral-700">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages || historyLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
