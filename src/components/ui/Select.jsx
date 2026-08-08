import { forwardRef, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

const Select = forwardRef(function Select(
  {
    label,
    options = [],
    placeholder = 'Select...',
    error,
    className = '',
    id,
    name,
    onChange,
    onBlur,
    defaultValue = '',
    value,
    disabled = false,
    triggerClassName = '',
    required = false,
    ...rest
  },
  ref,
) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
  const wrapperRef = useRef(null)
  const menuRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue ?? '')
  const selectedOption = options.find((option) => option.value === selectedValue)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    }
  }, [value])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined

    const updateMenuPosition = () => {
      const trigger = wrapperRef.current?.querySelector('[role="button"]')
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const menuHeight = Math.min(224, options.length * 41 + 8)
      const spaceBelow = window.innerHeight - rect.bottom
      const shouldOpenUp = spaceBelow < menuHeight + 12 && rect.top > menuHeight
      // Menus must be at least as wide as the trigger, but a narrow trigger (sized to
      // whatever option happens to be selected) shouldn't force other option labels to overflow.
      const menuWidth = Math.min(Math.max(rect.width, 160), window.innerWidth - rect.left - 16)

      setMenuStyle({
        left: rect.left,
        top: shouldOpenUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
        width: menuWidth,
        maxHeight: menuHeight,
      })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen, options.length])

  const emitChange = (nextValue) => {
    const event = { target: { name, value: nextValue }, type: 'change' }
    onChange?.(event)
  }

  const handleSelect = (nextValue) => {
    if (disabled) return

    setSelectedValue(nextValue)
    emitChange(nextValue)
    setIsOpen(false)
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen((current) => !current)
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div ref={wrapperRef} className="relative">
        <input
          ref={ref}
          type="hidden"
          id={selectId}
          name={name}
          value={selectedValue}
          readOnly
          {...rest}
        />
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={selectId}
          onClick={() => !disabled && setIsOpen((current) => !current)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          className={`flex w-full max-w-full cursor-pointer items-center justify-between rounded-xl border bg-neutral-50 py-2.5 pl-3.5 pr-3 text-sm text-neutral-900 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${triggerClassName}`}
        >
          <span className={selectedOption ? 'truncate' : 'truncate text-neutral-400'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>

        {isOpen && menuStyle && createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={menuStyle}
            className="fixed z-50 overflow-x-hidden overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 text-sm text-neutral-900 shadow-popover"
          >
            {options.map((option) => {
              const isSelected = option.value === selectedValue

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onClick={() => handleSelect(option.value)}
                  title={option.label}
                  className={`cursor-pointer truncate rounded-lg px-3 py-2 transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white'
                      : 'text-neutral-700 hover:bg-primary-50 hover:text-primary-700'
                  }`}
                >
                  {option.label}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

export default Select
