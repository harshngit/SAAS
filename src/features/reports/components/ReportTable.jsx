import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ChevronsUpDown, FileSpreadsheet, FileText } from 'lucide-react'
import Badge from '../../../components/ui/Badge'
import { ENTITY_ROUTES } from '../reportConfig'
import { formatCellValue } from '../reportDataUtils'

const DANGER_WORDS = ['reject', 'cancel', 'mismatch', 'fail', 'voided']
const WARNING_WORDS = ['overdue', 'pending', 'draft', 'requested', 'clarification']
const SUCCESS_WORDS = ['approve', 'paid', 'matched', 'complete', 'confirm', 'closed', 'received', 'recorded', 'success']

// Columns whose values are genuinely comparable - the ones a client-side sort (of the currently
// loaded page of real rows, nothing fetched or fabricated) can meaningfully reorder.
const SORTABLE_TYPES = new Set(['currency', 'number', 'percent', 'date', 'datetime'])

function statusVariant(value) {
  const normalized = String(value || '').toLowerCase()
  if (DANGER_WORDS.some((word) => normalized.includes(word))) return 'danger'
  if (SUCCESS_WORDS.some((word) => normalized.includes(word))) return 'success'
  if (WARNING_WORDS.some((word) => normalized.includes(word))) return 'warning'
  return 'neutral'
}

function humanizeStatus(value) {
  return String(value ?? '—').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function ReferenceCell({ column, row }) {
  const text = row[column.key]
  const idValue = column.idKey ? row[column.idKey] : null
  const routeBuilder = column.refType ? ENTITY_ROUTES[column.refType] : null
  const href = routeBuilder ? routeBuilder(idValue) : null

  if (!text && text !== 0) return <span className="text-neutral-300">—</span>
  if (!href) return <span>{text}</span>

  return (
    <Link to={href} className="font-medium text-primary-600 hover:underline">
      {text}
    </Link>
  )
}

function Cell({ column, row }) {
  if (column.type === 'reference') return <ReferenceCell column={column} row={row} />
  if (column.type === 'status') {
    const value = row[column.key]
    if (value === undefined || value === null || value === '') return <span className="text-neutral-300">—</span>
    return <Badge variant={statusVariant(value)}>{humanizeStatus(value)}</Badge>
  }
  return <span>{formatCellValue(row[column.key], column)}</span>
}

// A row reads as overdue when its own days_overdue is positive, or its status column literally
// says "overdue" - a subtle amber left-rule, never a full red row (§19: "do not overuse red").
function isOverdueRow(row) {
  if (Number(row.days_overdue) > 0) return true
  return Object.values(row).some((value) => String(value).toLowerCase() === 'overdue')
}

function sortRows(rows, sort, columns) {
  if (!sort.key) return rows
  const column = columns.find((item) => item.key === sort.key)
  if (!column) return rows

  const factor = sort.direction === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = a[sort.key]
    const right = b[sort.key]
    if (left === undefined || left === null || left === '') return 1
    if (right === undefined || right === null || right === '') return -1

    if (column.type === 'date' || column.type === 'datetime') {
      return (new Date(left).getTime() - new Date(right).getTime()) * factor
    }
    if (column.type === 'currency' || column.type === 'number' || column.type === 'percent') {
      return (Number(left) - Number(right)) * factor
    }
    return String(left).localeCompare(String(right)) * factor
  })
}

// `sortable` opts a caller into clickable, client-side-sortable column headers. Row-level
// export (an Actions column with real PDF/Excel buttons) is a SEPARATE opt-in: it only renders
// when the caller passes BOTH `resolveRowId` and `onExportRow` - SalesOverview.jsx's bespoke
// report layout passes neither, so it keeps using this same table for its column/cell rendering
// without picking up chrome it didn't ask for. A row whose `resolveRowId` comes back empty
// (filters moved on since the row was fetched, etc.) still gets its buttons - disabled, not
// hidden, so the table layout never jumps row to row.
export default function ReportTable({ columns, rows, getRowKey, sortable = false, resolveRowId, onExportRow }) {
  const [sort, setSort] = useState({ key: null, direction: 'asc' })
  const [exportingRow, setExportingRow] = useState(null) // { key, format } while a row export is in flight
  const resolveRowKey = getRowKey || ((row, index) => row.id || row.reference || index)
  const sortedRows = useMemo(() => (sortable ? sortRows(rows, sort, columns) : rows), [sortable, rows, sort, columns])

  const hasRowExport = typeof resolveRowId === 'function' && typeof onExportRow === 'function'

  const handleSortClick = (column) => {
    if (!SORTABLE_TYPES.has(column.type)) return
    setSort((current) => {
      if (current.key !== column.key) return { key: column.key, direction: 'asc' }
      return { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  const handleRowExportClick = async (row, rowKey, format) => {
    if (exportingRow) return
    setExportingRow({ key: rowKey, format })
    try {
      await onExportRow(row, format)
    } finally {
      setExportingRow(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
            {columns.map((column) => {
              const isSortable = sortable && SORTABLE_TYPES.has(column.type)
              const isActive = sort.key === column.key
              return (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-2.5 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortClick(column)}
                      className={`inline-flex items-center gap-1 ${column.align === 'right' ? 'flex-row-reverse' : ''} hover:text-neutral-600`}
                    >
                      {column.label}
                      {isActive ? (
                        sort.direction === 'asc' ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronsUpDown className="size-3.5 text-neutral-300" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
            {hasRowExport && <th className="px-4 py-2.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {sortedRows.map((row, index) => {
            const overdue = isOverdueRow(row)
            const rowKey = resolveRowKey(row, index)
            const rowId = hasRowExport ? resolveRowId(row) : null
            const isExportingThisRow = exportingRow?.key === rowKey
            return (
              <tr key={rowKey} className={overdue ? 'border-l-2 border-l-amber-400 bg-amber-50/30' : ''}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-4 py-2.5 text-neutral-700 ${column.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
                  >
                    <Cell column={column} row={row} />
                  </td>
                ))}
                {hasRowExport && (
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={!rowId || Boolean(exportingRow)}
                        title={rowId ? 'Export this row as PDF' : "This row can't be exported - refresh the report and try again"}
                        onClick={() => handleRowExportClick(row, rowKey, 'pdf')}
                        className="flex size-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isExportingThisRow && exportingRow.format === 'pdf' ? (
                          <span className="size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600" aria-hidden="true" />
                        ) : (
                          <FileText className="size-3.5" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={!rowId || Boolean(exportingRow)}
                        title={rowId ? 'Export this row as Excel' : "This row can't be exported - refresh the report and try again"}
                        onClick={() => handleRowExportClick(row, rowKey, 'excel')}
                        className="flex size-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isExportingThisRow && exportingRow.format === 'excel' ? (
                          <span className="size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600" aria-hidden="true" />
                        ) : (
                          <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
