import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const Input = forwardRef(function Input(
  { label, error, as = 'input', type = 'text', className = '', required = false, ...rest },
  ref,
) {
  const Component = as
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = as === 'input' && type === 'password'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <div className="relative">
        <Component
          ref={ref}
          required={required}
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          className={`w-full rounded-xl border bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:placeholder:text-neutral-300 ${
            isPassword ? 'pr-10' : ''
          } ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12'
          } ${as === 'textarea' ? 'min-h-20 resize-y' : ''}`}
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
