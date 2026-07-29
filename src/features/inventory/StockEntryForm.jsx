import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import DatePicker from '../../components/ui/DatePicker'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { movementTypes, stockItems } from '../../mockData/stockItems'

const today = () => new Date().toISOString().slice(0, 10)

const productOptions = [...new Set(stockItems.map((item) => item.productName))].map((name) => ({
  value: name,
  label: name,
}))

export default function StockEntryForm({ isOpen, onClose, stockItem, onSave }) {
  const [productName, setProductName] = useState('')
  const [type, setType] = useState('purchase')
  const [date, setDate] = useState(today())
  const [poNumber, setPoNumber] = useState('')
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [quantities, setQuantities] = useState({})

  useEffect(() => {
    if (!isOpen) return
    setProductName(stockItem?.productName || '')
    setType('purchase')
    setDate(today())
    setPoNumber('')
    setSupplier('')
    setReference('')
    setQuantities({})
  }, [isOpen, stockItem])

  if (!isOpen) return null

  const isPurchase = type === 'purchase'
  const isDeduction = ['sale', 'damaged', 'expired', 'return'].includes(type)
  const variants = stockItem
    ? [stockItem]
    : stockItems.filter((item) => item.productName === productName)

  const handleProductChange = (value) => {
    setProductName(value)
    setQuantities({})
  }

  const handleQuantityChange = (sku, value) => {
    setQuantities((current) => ({ ...current, [sku]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const entries = variants
      .filter((variant) => Number(quantities[variant.sku]) > 0)
      .map((variant) => {
        const magnitude = Math.abs(Number(quantities[variant.sku])) || 0
        return {
          sku: variant.sku,
          type,
          date,
          quantity: isDeduction ? -magnitude : magnitude,
          ...(isPurchase ? { poNumber, supplier, reference: poNumber } : { reference }),
        }
      })

    if (entries.length === 0) return
    onSave(entries)
    onClose()
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
            Select a product to see every size, then enter quantities only for the variants you want to update.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Back to Inventory
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Select
          label="Product"
          options={productOptions}
          placeholder="Select product"
          value={productName}
          onChange={(event) => handleProductChange(event.target.value)}
          disabled={Boolean(stockItem)}
          required
        />
        <Select
          label="Movement Type"
          options={movementTypes}
          value={type}
          onChange={(event) => setType(event.target.value)}
        />
        <DatePicker label="Date" value={date} onChange={(value) => setDate(value)} />
        {isPurchase ? (
          <>
            <Input
              label="Supplier PO Number"
              placeholder="e.g. PO-2024-010"
              value={poNumber}
              onChange={(event) => setPoNumber(event.target.value)}
              required
            />
            <Input
              label="Supplier"
              placeholder="e.g. Prime Manufacturing"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
              required
            />
          </>
        ) : (
          <Input
            label="Reference / Notes"
            className="lg:col-span-2"
            placeholder="e.g. SO-1062, batch expired, cycle count correction"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        )}
      </div>

      {productName && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-neutral-900">Variants</p>
          <div className="overflow-x-auto rounded-xl border border-neutral-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-neutral-50/80 text-[0.65rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-4 py-2.5">Size</th>
                  <th className="whitespace-nowrap px-4 py-2.5">SKU</th>
                  <th className="whitespace-nowrap px-4 py-2.5">Active Stock</th>
                  <th className="whitespace-nowrap px-4 py-2.5">{isDeduction ? 'Qty to Deduct' : 'Qty to Add'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {variants.map((variant) => (
                  <tr key={variant.sku}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-neutral-800">{variant.size}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-neutral-500">{variant.sku}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">
                      {variant.currentStock} {variant.unit}s
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        value={quantities[variant.sku] || ''}
                        onChange={(event) => handleQuantityChange(variant.sku, event.target.value)}
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
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save Entry</Button>
      </div>
    </form>
  )
}
