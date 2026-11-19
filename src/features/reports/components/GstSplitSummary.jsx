import { formatCurrency } from '../../../utils/format'

// GST Summary (group_by=transaction): the CGST / SGST / IGST / Unsplit split of each group, straight from summary
// output_*, output_adjustment_*, input_* and input_adjustment_* (<group>_tax_amount, _cgst_total, _sgst_total, _igst_total,
// _unsplit_tax_amount). Nothing is calculated here. "Unsplit" is tax on documents whose party state is unknown.
const GROUPS = [
  { key: 'output', label: 'Output (sales invoices)' },
  { key: 'output_adjustment', label: 'Output adjustment (sales returns)' },
  { key: 'input', label: 'Input (purchases)' },
  { key: 'input_adjustment', label: 'Input adjustment (purchase returns)' },
]
const COLUMNS = [
  ['tax_amount', 'Tax amount'],
  ['cgst_total', 'CGST'],
  ['sgst_total', 'SGST'],
  ['igst_total', 'IGST'],
  ['unsplit_tax_amount', 'Unsplit tax'],
]

export default function GstSplitSummary({ summary }) {
  if (!summary || !GROUPS.some((group) => summary[`${group.key}_cgst_total`] !== undefined)) return null
  const value = (group, column) => {
    const raw = summary[`${group}_${column}`]
    return raw === undefined || raw === null ? '-' : formatCurrency(Number(raw) || 0)
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-100">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50 text-[0.7rem] font-semibold uppercase tracking-wide text-neutral-400">
            <th className="px-4 py-3">GST split</th>
            {COLUMNS.map(([, label]) => <th key={label} className="whitespace-nowrap px-4 py-3 text-right">{label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {GROUPS.map((group) => (
            <tr key={group.key}>
              <td className="px-4 py-2.5 font-medium text-neutral-700">{group.label}</td>
              {COLUMNS.map(([column]) => <td key={column} className="whitespace-nowrap px-4 py-2.5 text-right text-neutral-800">{value(group.key, column)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
