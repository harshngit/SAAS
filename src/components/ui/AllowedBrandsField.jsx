import { X } from 'lucide-react'
import Select from './Select'
import Button from './Button'

export default function AllowedBrandsField({ selection, disabled = false }) {
  const { brands, selectedIds, setSelectedIds, loading, error, reload } = selection
  return (
    <div className="space-y-2">
      <Select key={selectedIds.join(',')} label="Allowed brands" value="" searchable
        disabled={disabled || loading || Boolean(error)}
        placeholder={loading ? 'Loading brands...' : 'Select brands'}
        options={brands.filter((brand) => brand.is_active !== false && !selectedIds.includes(brand.id)).map((brand) => ({ value: brand.id, label: brand.name }))}
        onChange={(event) => { if (event.target.value) setSelectedIds((ids) => [...new Set([...ids, event.target.value])]) }} />
      <p className="text-xs text-neutral-500">Leave empty to allow all brands</p>
      {selectedIds.length > 0 && <div className="flex flex-wrap gap-2">
        {selectedIds.map((id) => <span key={id} className="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-2.5 py-1 text-sm text-primary-700">
          {brands.find((brand) => brand.id === id)?.name || 'Saved brand'}
          <button type="button" disabled={disabled || loading} aria-label={`Remove allowed brand ${brands.find((brand) => brand.id === id)?.name || id}`}
            onClick={() => setSelectedIds((ids) => ids.filter((value) => value !== id))} className="rounded p-0.5 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-primary-500">
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>)}
      </div>}
      {error && <div className="flex items-center gap-2"><p role="alert" className="text-sm text-red-600">{error}</p><Button type="button" size="sm" variant="ghost" onClick={reload}>Retry</Button></div>}
    </div>
  )
}
