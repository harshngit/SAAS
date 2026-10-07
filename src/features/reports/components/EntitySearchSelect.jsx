import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

// Server-searched entity picker - for catalogs the frontend can't safely preload in full
// (listCustomers/listProducts expose no page-size override at all, so a one-shot "load
// everything on mount" silently stops at whatever the backend's own default page size is for
// any organization with more customers/products than that). Queries `fetchOptions(search)`
// on each keystroke (debounced), rather than filtering a client-side list that may already be
// missing most of the catalog.
export default function EntitySearchSelect({ value, selectedLabel, onChange, fetchOptions, placeholder, className = '' }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    setIsLoading(true)
    const timeout = setTimeout(async () => {
      const result = await fetchOptions(query.trim())
      setOptions(result)
      setIsLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, open, fetchOptions])

  useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const displayLabel = value ? selectedLabel || value : ''

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between gap-1.5 rounded-xl border border-neutral-200 bg-surface px-3.5 text-left text-sm text-neutral-900"
      >
        <span className={`truncate ${displayLabel ? '' : 'text-neutral-400'}`}>{displayLabel || placeholder}</span>
        {value && (
          <X
            className="size-3.5 shrink-0 text-neutral-400 hover:text-neutral-700"
            onClick={(event) => {
              event.stopPropagation()
              onChange('', '')
            }}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-64 overflow-hidden rounded-xl border border-surface-border bg-(--modal-bg) shadow-(--shadow-popover)">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${placeholder?.toLowerCase() || ''}…`}
              className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto app-scrollbar py-1">
            {isLoading ? (
              <p className="px-3 py-3 text-sm text-neutral-400">Searching…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-3 text-sm text-neutral-400">{query ? 'No matches.' : 'Type to search.'}</p>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value, option.label)
                    setOpen(false)
                  }}
                  className={`block w-full truncate px-3 py-2 text-left text-sm transition-colors ${
                    option.value === value ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
