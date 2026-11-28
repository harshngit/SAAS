// Excel export for the Reports screens, built in the browser with the shared renderer (utils/exportToExcel.js)
// instead of the backend's own .xlsx (which has no frozen header / filters / ₹ formats and mixes ISO text dates and
// raw enums). It uses the SAME column schema the screen table uses (backend meta.columns + the report's config), and
// walks every page of the report, so the file always holds the complete filtered dataset - never just the visible page.
import { getAllReportRows } from '../../api/reports'
import { useAuthStore } from '../../store/authStore'
import { exportSheetsToExcel, xlCell } from '../../utils/exportToExcel'
import { resolveColumns, resolveSummaryValue } from './reportDataUtils'

// screen column type -> workbook column type
const COLUMN_TYPE = {
  currency: 'currency',
  number: 'number',
  percent: 'number',
  date: 'date',
  datetime: 'datetime',
  status: 'status',
  reference: 'id',
  text: undefined, // inferred from the header (long text wraps, phone/email stay text)
}

function percentValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value
  // same rule the screen uses: a value <= 1 is a fraction that still needs x100
  return Math.abs(number) <= 1 ? Number((number * 100).toFixed(2)) : number
}

function cellFor(column, row) {
  const value = row?.[column.key]
  if (value === undefined || value === null || value === '') return null
  if (column.type === 'percent') return percentValue(value)
  if (column.type === 'currency' || column.type === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  // Never an internal id: a reference column shows its business value (order number, invoice #, name), not `idKey`.
  if (typeof value === 'object') return value.name ?? value.display ?? value.number ?? ''
  return value
}

export function buildReportSheets({ label, columns, rows, summary, summaryCards, info = {} }) {
  const header = columns.map((column) => (column.type === 'percent' && !/%/.test(column.label) ? `${column.label} (%)` : column.label))
  const dataRows = rows.map((row) => columns.map((column) => cellFor(column, row)))
  const sheets = [
    { name: label, rows: [header, ...dataRows], columns: columns.map((column) => ({ type: COLUMN_TYPE[column.type] })) },
  ]

  // Second sheet "Summary": what the backend file used to print above its table (company, report, period) plus the KPI cards.
  const details = [
    info.company ? ['Company', info.company] : null,
    ['Report', label],
    info.period ? ['Period', info.period] : null,
    info.search ? ['Search', info.search] : null,
    ['Rows exported', xlCell('integer', rows.length)],
    ['Generated', xlCell('datetime', new Date())],
  ].filter(Boolean)
  const metrics = (summaryCards || [])
    .map((card) => {
      const value = resolveSummaryValue(summary, card.keys)
      if (value === undefined) return null
      const type = card.format === 'currency' ? 'currency' : 'number'
      return [card.label, xlCell(type, card.format === 'percent' ? percentValue(value) : Number(value))]
    })
    .filter(Boolean)
  sheets.push({ name: 'Summary', rows: [['Detail', 'Value'], ...details, ...metrics], columns: [{ type: 'text', width: 30 }, { type: 'text', width: 30 }] })
  return sheets
}

// reportType: API path segment (sales, purchase, cash-collection ...). config: { label, columns, extraColumns?, normalizeRow?, summaryCards? }
// filters: the same params the screen sends (page / page_size are ignored - every page is fetched).
export async function exportReportToExcel({ reportType, config, filters = {} }) {
  const result = await getAllReportRows(reportType, filters)
  if (!result.success) return result

  const rows = config.normalizeRow ? result.rows.map(config.normalizeRow) : result.rows
  const columns = resolveColumns({ meta: result.meta, rows }, config.columns || [], config.extraColumns || [])
  const from = filters.date_from
  const to = filters.date_to
  const info = {
    company: useAuthStore.getState().currentOrganization?.name || '',
    period: from && to ? (from === to ? from : `${from} to ${to}`) : '',
    search: filters.search || '',
  }
  const sheets = buildReportSheets({ label: config.label || reportType, columns, rows, summary: result.summary, summaryCards: config.summaryCards, info })

  const groupBy = filters.group_by && !config.fixedParams?.group_by ? `_by_${filters.group_by}` : ''
  await exportSheetsToExcel(`${reportType}${groupBy}`, sheets, { dateRange: from && to ? { from, to } : undefined })
  return { success: true, rowCount: rows.length }
}
