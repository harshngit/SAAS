import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, PieChart, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DatePicker from '../../components/ui/DatePicker'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Select from '../../components/ui/Select'
import { exportReport, getReport } from '../../api/reports'
import { listCustomers } from '../../api/customers'
import { listUsers } from '../../api/users'
import { ORDER_STATUS_OPTIONS, FULFILMENT_STATUS_OPTIONS } from '../../api/orders'
import { normalizeApiUser } from '../users/userRoleUtils'
import { ROLES } from '../../auth/roles'
import { usePermission } from '../../auth/usePermission'
import { DEMO_MODE } from '../../config/demoMode'
import { PERIOD_OPTIONS, getDateRangeForPeriod } from '../reports/reportConstants'
import { col, ref } from '../reports/reportConfig'
import ReportSummaryCards from '../reports/components/ReportSummaryCards'
import ReportTable from '../reports/components/ReportTable'
import EntitySearchSelect from '../reports/components/EntitySearchSelect'
import { resolveColumns } from '../reports/reportDataUtils'

const REPORT_TYPE = 'sales-overview'

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
  { value: '100', label: '100 / page' },
]

// Exact backend summary keys confirmed for GET /reports/sales-overview - ReportSummaryCards
// skips any card whose key the response doesn't actually send, never shows a fabricated zero.
const SUMMARY_CARDS = [
  { keys: ['total_orders'], label: 'Total Orders', format: 'number' },
  { keys: ['total_sales_value'], label: 'Total Sales Value', format: 'currency' },
  { keys: ['not_started'], label: 'Not Started', format: 'number' },
  { keys: ['planned'], label: 'Planned', format: 'number' },
  { keys: ['partially_delivered'], label: 'Partially Delivered', format: 'number' },
  { keys: ['delivered'], label: 'Delivered', format: 'number' },
]

// Fallback table schema, used only when the backend response doesn't send its own meta.columns
// (resolveColumns always prefers that real schema when present - see reportDataUtils.js).
// order_number/total are the confirmed real Order field names (verified against this backend's
// own live OpenAPI schema, components.schemas.OrderOut - NOT the earlier order_no/order_value
// guesses, which that schema has no such fields for). ordered_quantity/delivered_quantity/
// remaining_quantity stay as-is - delivered_quantity in particular is also the confirmed real
// field on DeliveryLineOut, the same domain. customer/customer_id and the `order`/`customer`/
// `delivery` reference link types reuse this reports domain's already-confirmed ENTITY_ROUTES/
// column conventions (reportConfig.js). One row is one Sales Order; multiple deliveries never
// duplicate it. Rows are normalized (see normalizeSalesOverviewRow below) before reaching this
// table, so latest_delivery/customer/salesperson/delivery_partner/vehicle are always flat
// scalars here even when the backend sends any of them as nested objects.
const SALES_OVERVIEW_COLUMNS = [
  ref('order_number', 'Order No.', 'order', 'order_id'),
  col('order_date', 'Order Date', 'date'),
  ref('customer', 'Customer', 'customer', 'customer_id'),
  col('salesperson', 'Salesperson', 'text'),
  col('total', 'Order Value', 'currency', { align: 'right' }),
  col('order_status', 'Order Status', 'status'),
  col('fulfilment_status', 'Fulfilment Status', 'status'),
  col('ordered_quantity', 'Ordered Qty', 'number', { align: 'right' }),
  col('delivered_quantity', 'Delivered Qty', 'number', { align: 'right' }),
  col('remaining_quantity', 'Remaining Qty', 'number', { align: 'right' }),
  col('delivery_count', 'Delivery Count', 'number', { align: 'right' }),
  ref('latest_delivery', 'Latest Delivery', 'delivery', 'latest_delivery_id'),
  col('delivery_status', 'Delivery Status', 'status'),
  col('delivery_partner', 'Delivery Partner', 'text'),
  col('vehicle', 'Vehicle', 'text'),
]

// order_status: this backend's own live OpenAPI schema documents OrderOut.status directly as
// "Client-facing Order status: draft | confirmed | completed | cancelled" - the exact same
// canonical set api/orders.js's own ORDER_STATUS_OPTIONS already exports. Reused directly rather
// than re-declared, and NOT the placed/processing/awaiting_approval raw-legacy values an earlier
// pass used - those appear only in a stale, no-longer-current schema capture, not this backend's
// live contract.
const SALES_OVERVIEW_ORDER_STATUS_OPTIONS = [{ value: '', label: 'All Order Statuses' }, ...ORDER_STATUS_OPTIONS]

// fulfilment_status: the live schema documents OrderOut.fulfilment_status as the full 8-value
// "not_started | reserved | planned | loaded | in_transit | partially_delivered | delivered |
// failed" - exactly api/orders.js's FULFILMENT_STATUS_OPTIONS. An earlier pass narrowed this to
// only the 4 values this report's summary cards bucket, which was an unverified guess; the
// summary bucketing a subset for display doesn't mean the filter only accepts that subset.
const SALES_OVERVIEW_FULFILMENT_STATUS_OPTIONS = [{ value: '', label: 'All Fulfilment Statuses' }, ...FULFILMENT_STATUS_OPTIONS]

// delivery_status: the live schema documents DeliveryOut.status as the CLIENT-FACING vocabulary
// "pending | accepted | in_transit | partially_delivered | delivered | returned | rejected |
// cancelled" (its own description notes the internal-only raw values - planned/ready/loaded/
// failed - are collapsed into these before the client ever sees them). This is deliberately NOT
// api/deliveries.js's own DELIVERY_STATUS_OPTIONS, which is a raw/internal query-filter list for
// the Deliveries list page (a different endpoint) and includes several internal-only values this
// report's own filter has no evidence of accepting.
const SALES_OVERVIEW_DELIVERY_STATUS_OPTIONS = [
  { value: '', label: 'All Delivery Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

function flattenBriefObject(value, displayKeys) {
  if (value === null || value === undefined || typeof value !== 'object') return { display: value, id: undefined }
  for (const key of displayKeys) {
    if (value[key] !== undefined && value[key] !== null) return { display: value[key], id: value.id ?? null }
  }
  return { display: null, id: value.id ?? null }
}

// Sales Overview rows can carry `latest_delivery` as a nested object, and that object's OWN
// `delivery_partner`/`vehicle` sub-fields can themselves be nested objects too (confirmed shape
// on this backend's real Delivery model: delivery_partner -> UserBrief {id, name}, vehicle ->
// VehicleBrief {id, vehicle_number}). customer/salesperson on the row can likewise be nested
// (Order model: customer -> CustomerBrief {id, name, ...}, salesperson -> SalespersonBrief {id,
// name, ...}). ReportTable/ReferenceCell render one flat scalar + one sibling id per column
// (reportConfig.js's ref() columns) and would otherwise try to render a raw object as a React
// child at any of these levels. This flattens each row defensively, several levels deep: an
// already-flat top-level field always wins over reading into a nested object, and a nested
// object is only ever read for its real, confirmed display field (name / vehicle_number) -
// nothing here is invented.
function normalizeSalesOverviewRow(row) {
  if (!row || typeof row !== 'object') return row

  const latestDelivery = row.latest_delivery
  const hasLatestDeliveryObject = latestDelivery !== null && typeof latestDelivery === 'object'

  const nestedPartner = hasLatestDeliveryObject ? latestDelivery.delivery_partner : undefined
  const nestedVehicle = hasLatestDeliveryObject ? latestDelivery.vehicle : undefined
  const partner = flattenBriefObject(row.delivery_partner ?? nestedPartner, ['name'])
  const vehicle = flattenBriefObject(row.vehicle ?? nestedVehicle, ['vehicle_number'])
  const customer = flattenBriefObject(row.customer, ['name', 'business_name'])
  const salesperson = flattenBriefObject(row.salesperson, ['name'])

  return {
    ...row,
    latest_delivery: hasLatestDeliveryObject
      ? latestDelivery.delivery_number ?? latestDelivery.number ?? latestDelivery.id ?? null
      : latestDelivery,
    latest_delivery_id: row.latest_delivery_id ?? (hasLatestDeliveryObject ? latestDelivery.id ?? latestDelivery.delivery_id ?? null : null),
    delivery_status: row.delivery_status ?? (hasLatestDeliveryObject ? latestDelivery.delivery_status ?? latestDelivery.status ?? null : null),
    delivery_partner: partner.display,
    delivery_partner_id: row.delivery_partner_id ?? partner.id ?? null,
    vehicle: vehicle.display,
    vehicle_id: row.vehicle_id ?? vehicle.id ?? null,
    customer: customer.display,
    customer_id: row.customer_id ?? customer.id ?? null,
    salesperson: salesperson.display,
  }
}

// "Sales" in the client's sidebar structure is "Combined of Orders + Deliveries" - this is now a
// real backend report (GET /reports/sales-overview, one row per Sales Order with its own
// aggregated delivery fields), not a client-side merge of the separately-paginated Orders and
// Deliveries lists. The financial "Sales" report under Reports (net invoiced sales/collections)
// is a different, unrelated report and is intentionally not reused here.
export default function SalesOverview() {
  const { can } = usePermission()
  const canExport = can('reports', 'export')

  const [period, setPeriod] = useState('monthly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerLabel, setCustomerLabel] = useState('')
  const [salespersonId, setSalespersonId] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [fulfilmentStatus, setFulfilmentStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('25')

  const [salespeople, setSalespeople] = useState([])
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isExporting, setIsExporting] = useState('')
  const [exportError, setExportError] = useState('')

  // Same bounded, loaded-once salesperson list FinancialReports.jsx builds for its own
  // salesperson_id filter - Sales Officers and Admins, the only roles that can own a sale.
  useEffect(() => {
    let isMounted = true
    listUsers().then((result) => {
      if (!isMounted || !result.success) return
      setSalespeople(
        result.users
          .map(normalizeApiUser)
          .filter((user) => user.role === ROLES.SALES_OFFICER || user.role === ROLES.ADMIN)
          .map((user) => ({ value: user.id, label: user.name })),
      )
    })
    return () => { isMounted = false }
  }, [])

  const searchCustomers = useCallback(async (query) => {
    const result = await listCustomers({ search: query })
    if (!result.success) return []
    return (result.customers || []).slice(0, 50).map((item) => ({ value: item.id, label: item.name }))
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const { dateFrom, dateTo } = useMemo(
    () => getDateRangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const requestParams = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    customer_id: customerId || undefined,
    salesperson_id: salespersonId || undefined,
    order_status: orderStatus || undefined,
    fulfilment_status: fulfilmentStatus || undefined,
    delivery_status: deliveryStatus || undefined,
    search: search || undefined,
    page,
    page_size: Number(pageSize),
  }), [dateFrom, dateTo, customerId, salespersonId, orderStatus, fulfilmentStatus, deliveryStatus, search, page, pageSize])

  // Guards against an older, slower request overwriting a newer one if filters change again
  // before the first response arrives - same pattern FinancialReports.jsx uses.
  const requestIdRef = useRef(0)

  const loadReport = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setLoadError('')

    const result = await getReport(REPORT_TYPE, requestParams)
    if (requestIdRef.current !== requestId) return

    setIsLoading(false)

    if (!result.success) {
      setLoadError(result.error)
      setReport(null)
      return
    }

    if (result.report?.demoUnavailable) {
      setLoadError('demo-unavailable')
      setReport(null)
      return
    }

    setReport(result.report)
  }, [requestParams])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExport = async (format) => {
    setIsExporting(format)
    setExportError('')

    const { page: _page, page_size: _pageSize, ...exportParams } = requestParams
    const result = await exportReport(REPORT_TYPE, exportParams, format)

    setIsExporting('')
    if (!result.success) setExportError(result.error)
  }

  const handleClearFilters = () => {
    setCustomerId('')
    setCustomerLabel('')
    setSalespersonId('')
    setOrderStatus('')
    setFulfilmentStatus('')
    setDeliveryStatus('')
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const rows = useMemo(
    () => (Array.isArray(report?.rows) ? report.rows.map(normalizeSalesOverviewRow) : []),
    [report],
  )
  const columns = useMemo(() => resolveColumns(report, SALES_OVERVIEW_COLUMNS), [report])
  const pagination = report?.pagination
  const total = pagination?.total ?? rows.length
  const totalPages = pagination?.total_pages ?? 1
  const currentPage = pagination?.page ?? page
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * Number(pageSize) + 1
  const rangeEnd = total === 0 ? 0 : Math.min(currentPage * Number(pageSize), total)

  const isDemoUnavailable = loadError === 'demo-unavailable'
  const hasData = rows.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Sales</h1>
        <p className="mt-1 text-sm text-neutral-500">Combined view of sales orders and delivery fulfilment.</p>
      </div>

      <Card className="p-0">
        <div className="space-y-3 border-b border-neutral-100 px-4 py-4">
          <div className="flex flex-wrap items-end gap-2">
            <Select options={PERIOD_OPTIONS} value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1) }} className="w-44" />
            {period === 'custom' && (
              <>
                <DatePicker value={customFrom} onChange={(value) => { setCustomFrom(value); setPage(1) }} placeholder="From date" className="w-36" />
                <DatePicker value={customTo} onChange={(value) => { setCustomTo(value); setPage(1) }} placeholder="To date" className="w-36" />
              </>
            )}

            <EntitySearchSelect
              value={customerId}
              selectedLabel={customerLabel}
              onChange={(value, label) => { setCustomerId(value); setCustomerLabel(label); setPage(1) }}
              fetchOptions={searchCustomers}
              placeholder="Customer"
              className="w-48"
            />

            <Select
              searchable
              options={[{ value: '', label: 'All Salespeople' }, ...salespeople]}
              value={salespersonId}
              onChange={(event) => { setSalespersonId(event.target.value); setPage(1) }}
              placeholder="Salesperson"
              className="w-44"
            />

            <Select options={SALES_OVERVIEW_ORDER_STATUS_OPTIONS} value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setPage(1) }} className="w-44" />
            <Select options={SALES_OVERVIEW_FULFILMENT_STATUS_OPTIONS} value={fulfilmentStatus} onChange={(event) => { setFulfilmentStatus(event.target.value); setPage(1) }} className="w-48" />
            <Select options={SALES_OVERVIEW_DELIVERY_STATUS_OPTIONS} value={deliveryStatus} onChange={(event) => { setDeliveryStatus(event.target.value); setPage(1) }} className="w-44" />

            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search…"
              className="h-10 w-40 rounded-xl border border-neutral-200 bg-surface px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
            />

            <Button type="button" variant="outline" size="sm" onClick={loadReport} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>

            <button type="button" onClick={handleClearFilters} className="flex h-10 items-center px-2 text-sm font-medium text-neutral-500 hover:text-neutral-900">
              Clear filters
            </button>

            {canExport && !DEMO_MODE && (
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" loading={isExporting === 'pdf'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('pdf')}>
                  <Download className="size-4" aria-hidden="true" />
                  Export PDF
                </Button>
                <Button type="button" variant="secondary" size="sm" loading={isExporting === 'excel'} disabled={Boolean(isExporting) || isLoading} onClick={() => handleExport('excel')}>
                  <Download className="size-4" aria-hidden="true" />
                  Export Excel
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          {exportError && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{exportError}</div>
          )}
          {DEMO_MODE && (
            <p className="mb-4 text-xs text-neutral-400">Report export (PDF / Excel) is disabled in demo mode.</p>
          )}

          {isLoading ? (
            <LoadingSpinner label="Loading sales overview…" />
          ) : loadError && !isDemoUnavailable ? (
            <EmptyState icon={PieChart} title="Couldn't load the sales overview" description={loadError} action={{ label: 'Try again', onClick: loadReport }} />
          ) : isDemoUnavailable ? (
            <EmptyState icon={PieChart} title="Not available in demo mode" description="This report isn't simulated in demo mode. Connect the real backend to view it." />
          ) : !hasData ? (
            <EmptyState icon={PieChart} title="No orders found" description="No sales orders match the selected filters." />
          ) : (
            <div className="space-y-5">
              <ReportSummaryCards summary={report?.summary} cards={SUMMARY_CARDS} />
              <ReportTable columns={columns} rows={rows} />

              <div className="flex flex-col items-center justify-between gap-3 pt-1 text-sm text-neutral-500 sm:flex-row">
                <div className="flex items-center gap-3">
                  <span>Showing <span className="font-semibold text-neutral-900">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-neutral-900">{total}</span></span>
                  <Select
                    options={PAGE_SIZE_OPTIONS}
                    value={pageSize}
                    onChange={(event) => { setPageSize(event.target.value); setPage(1) }}
                    triggerClassName="h-8 bg-surface py-1 text-xs"
                    className="w-28"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Previous</button>
                  <span className="min-w-16 text-center font-medium text-neutral-700">{currentPage} / {totalPages || 1}</span>
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-600 disabled:opacity-40">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
