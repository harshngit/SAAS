import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import NumericInput from './NumericInput'
import DatePicker from './DatePicker'

const Input = forwardRef(function Input(
  { label, error, as = 'input', type = 'text', className = '', inputClassName = '', compact = false, required = false, ...rest },
  ref,
) {
  const Component = as === 'input' && (type === 'number' || ['numeric', 'decimal'].includes(rest.inputMode)) ? NumericInput : as
  const [showPassword, setShowPassword] = useState(false)
  // Used only by the date branch when a caller passes defaultValue instead of value.
  const [uncontrolledDate, setUncontrolledDate] = useState(rest.defaultValue ?? '')
  const isPassword = as === 'input' && type === 'password'
  const fieldAnchorId = typeof rest.name === 'string' ? rest.name : undefined

  // type="date" -> the app's own DatePicker (one consistent calendar everywhere). The value stays
  // 'yyyy-mm-dd' and onChange still receives an event-like object ({ target: { name, value } }),
  // so every existing `event.target.value` / `event.target.name` handler works unchanged.
  // Display is dd-mm-yyyy. Optional (non-required) dates get a Clear button, like the native input.
  if (as === 'input' && type === 'date') {
    const isControlled = rest.value !== undefined
    const dateValue = isControlled ? rest.value || '' : uncontrolledDate
    const handleDateChange = (nextValue) => {
      if (!isControlled) setUncontrolledDate(nextValue)
      const target = { name: rest.name, id: rest.id, type: 'date', value: nextValue }
      rest.onChange?.({ target, currentTarget: target, type: 'change', preventDefault() {}, stopPropagation() {}, persist() {} })
    }

    return (
      <div
        id={fieldAnchorId}
        data-profile-field={fieldAnchorId}
        className={`flex flex-col gap-1.5 ${className}`}
      >
        {label && (
          <label className="text-sm font-medium text-fg">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </label>
        )}
        <DatePicker
          value={dateValue}
          onChange={handleDateChange}
          min={rest.min}
          max={rest.max}
          name={rest.name}
          id={rest.id}
          required={required}
          disabled={rest.disabled}
          title={rest.title}
          ariaLabel={rest['aria-label'] || (typeof label === 'string' ? label : undefined)}
          placeholder={rest.placeholder || 'dd-mm-yyyy'}
          displayFormat="dd-MM-yyyy"
          clearable={!required}
          invalid={Boolean(error)}
          triggerClassName={`rounded-xl border bg-(--input-bg) px-3.5 text-sm text-fg transition-all focus:bg-(--modal-bg) focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? 'py-1.5' : 'py-2.5'
          } ${error ? '' : 'border-surface-border focus:border-primary-400 focus:ring-primary-500/12'} ${inputClassName}`}
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div
      id={fieldAnchorId}
      data-profile-field={fieldAnchorId}
      className={`flex flex-col gap-1.5 ${className}`}
    >
      {label && (
        <label className="text-sm font-medium text-fg">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div className="relative">
        <Component
          ref={ref}
          required={required}
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          className={`w-full rounded-xl border bg-(--input-bg) px-3.5 text-sm text-fg transition-all placeholder:text-neutral-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:placeholder:text-neutral-300 ${
            compact ? 'py-1.5' : 'py-2.5'
          } ${
            isPassword ? 'pr-10' : ''
          } ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
              : 'border-surface-border focus:border-primary-400 focus:ring-primary-500/12'
          } ${as === 'textarea' ? 'min-h-20 resize-y' : ''} ${inputClassName}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

export default Input
