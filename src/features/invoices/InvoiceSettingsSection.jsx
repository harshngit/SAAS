import { ChevronDown, ChevronUp } from 'lucide-react'

// Shared collapsible-section shell for the Invoice Settings and Print Settings accordions -
// reuses the same visual pattern already established in CompanySettings.jsx's `CompanySection`
// rather than inventing a second accordion style.
export function SettingsSection({ title, description, isOpen, onToggle, children }) {
  return (
    <section className="border-b border-neutral-100 py-2.5 last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={`${isOpen ? 'mb-4 border-primary-100 bg-primary-50/40' : 'mb-0 border-neutral-100 bg-neutral-50'} flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors hover:bg-neutral-100`}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {description && <p className="text-xs text-neutral-500">{description}</p>}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen && <div className="px-1">{children}</div>}
    </section>
  )
}

export function SettingsToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-neutral-200'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span className={`inline-block size-4.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-1'}`} />
    </button>
  )
}

export function ToggleRow({ label, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <p className="text-sm text-neutral-700">{label}</p>
      <SettingsToggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// One row per item-table column: checkbox to show/hide + up/down reorder (spec explicitly
// allows up/down controls in place of drag-and-drop for this first implementation).
//
// `atCap` is a page-level "5 already selected" flag - it must NEVER disable a row that is
// itself currently selected (that column has to stay removable), only an unselected row once
// the cap is reached. The per-row disabled state is computed here, not passed in from the
// caller as one blanket value.
export function ColumnRow({ column, index, total, onToggle, onMove, atCap = false, showReorder = true }) {
  const checkboxDisabled = column.core || (atCap && !column.selected)
  return (
    <div className={`flex items-center justify-between gap-2.5 rounded-lg border border-neutral-100 bg-white px-2.5 py-1.5 ${checkboxDisabled && !column.core ? 'opacity-50' : ''}`}>
      <label className="flex min-w-0 items-center gap-2.5">
        <input
          type="checkbox"
          checked={column.selected}
          disabled={checkboxDisabled}
          onChange={() => onToggle(column.key)}
          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 disabled:opacity-60"
        />
        <span className="truncate text-sm text-neutral-700">
          {column.label}
          {column.core && <span className="ml-1.5 text-xs text-neutral-400">(required)</span>}
        </span>
      </label>
      {showReorder && column.selected && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${column.label} up`}
            className="flex size-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Move ${column.label} down`}
            className="flex size-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
