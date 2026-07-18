import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

const Select = forwardRef(function Select(
  { label, options = [], placeholder = 'Select...', error, className = '', id, ...rest },
  ref,
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`w-full appearance-none rounded-xl border bg-neutral-50 py-2.5 pl-3.5 pr-9 text-sm text-neutral-900 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
          }`}
          {...rest}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

export default Select
