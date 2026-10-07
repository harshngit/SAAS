import { Link } from 'react-router-dom'
import Badge from '../../../components/ui/Badge'
import { ENTITY_ROUTES } from '../reportConfig'
import { formatCellValue } from '../reportDataUtils'

const DANGER_WORDS = ['reject', 'cancel', 'mismatch', 'fail', 'voided']
const WARNING_WORDS = ['overdue', 'pending', 'draft', 'requested', 'clarification']
const SUCCESS_WORDS = ['approve', 'paid', 'matched', 'complete', 'confirm', 'closed', 'received', 'recorded', 'success']

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

export default function ReportTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-4 py-2.5 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {rows.map((row, index) => {
            const overdue = isOverdueRow(row)
            return (
              <tr key={row.id || row.reference || index} className={overdue ? 'border-l-2 border-l-amber-400 bg-amber-50/30' : ''}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-4 py-2.5 text-neutral-700 ${column.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}
                  >
                    <Cell column={column} row={row} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
