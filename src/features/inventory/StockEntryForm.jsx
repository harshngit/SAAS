import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { movementTypes, getMovementMeta } from './inventoryConstants'

const directionOptions = [
  { value: 'add', label: 'Add to stock' },
  { value: 'remove', label: 'Remove from stock' },
]

export default function StockEntryForm({ isOpen, onClose, product, saving = false, formError = '', onSave }) {
  const [movementType, setMovementType] = useState('purchase_in')
  const [adjustDirection, setAdjustDirection] = useState('add')
  const [note, setNote] = useState('')
  const [quantities, setQuantities] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setMovementType('purchase_in')
    setAdjustDirection('add')
    setNote('')
    setQuantities({})
  }, [isOpen, product])

  if (!isOpen || !product) return null

  const meta = getMovementMeta(movementType)
  const direction = meta.direction === 'either' ? adjustDirection === 'remove' ? 'out' : 'in' : meta.direction
  const rows = product.variations?.length
    ? product.variations
    : [{ id: null, name: product.name, inventory: product.total_stock || 0 }]

  const rowKey = (row) => row.id ?? 'default'

  const handleQuantityChange = (row, value) => {
    setQuantities((current) => ({ ...current, [rowKey(row)]: value }))
  }

  // Rounds on blur, not on every keystroke - a controlled number input jumps its cursor to the
  // end after any programmatic value change mid-typing, so rounding while "5." is still being
  // typed turns the next digit into the wrong place (e.g. "50" instead of "5").
  const handleQuantityBlur = (row) => (event) => {
    const rounded = Math.round(Number(event.target.value))
    setQuantities((current) => ({ ...current, [rowKey(row)]: Number.isFinite(rounded) ? String(Math.max(rounded, 0)) : '' }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const movements = rows
      .filter((row) => Number(quantities[rowKey(row)]) > 0)
      .map((row) => {
        const magnitude = Math.abs(Number(quantities[rowKey(row)])) || 0
        return {
          product_id: product.id,
          variant_id: row.id || undefined,
          movement_type: movementType,
          quantity: direction === 'out' ? -magnitude : magnitude,
          note: note.trim() || undefined,
        }
      })

    if (movements.length === 0) return
    onSave(movements)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[1.75rem] border border-neutral-100 bg-white p-6 shadow-(--shadow-card)"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-lg font-semibold text-neutral-900">Record stock movement</p>
          <p className="mt-1 text-sm text-neutral-500">
            {product.name} — enter quantities only for the variants you want to update.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Back to Inventory
        </Button>
      </div>

      {formError && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Select
          label="Movement Type"
          options={movementTypes}
          value={movementType}
          onChange={(event) => setMovementType(event.target.value)}
        />
        {meta.direction === 'either' && (
          <Select
            label="Direction"
            options={directionOptions}
            value={adjustDirection}
            onChange={(event) => setAdjustDirection(event.target.value)}
          />
        )}
        <Input
          label="Note"
          className="lg:col-span-2"
          placeholder="e.g. PO-2024-010 from Prime Manufacturing, cycle count correction..."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-neutral-900">Variants</p>
        <div className="overflow-x-auto rounded-xl border border-neutral-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-neutral-50/80 text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-400">
                <th className="whitespace-nowrap px-4 py-2.5">Variant</th>
                <th className="whitespace-nowrap px-4 py-2.5">Available Stock</th>
                <th className="whitespace-nowrap px-4 py-2.5">
                  {direction === 'out' ? 'Qty to Deduct' : 'Qty to Add'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-neutral-800">{row.name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">{row.inventory}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={quantities[rowKey(row)] || ''}
                      onChange={(event) => handleQuantityChange(row, event.target.value)}
                      onBlur={handleQuantityBlur(row)}
                      placeholder="0"
                      className="w-28 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 transition-all focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>Save Entry</Button>
      </div>
    </form>
  )
}
