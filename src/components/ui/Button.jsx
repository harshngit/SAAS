import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

const variantClasses = {
  primary:
    'bg-linear-to-b from-primary-500 to-primary-600 text-white shadow-[0_1px_0_0_rgb(255_255_255/0.15)_inset,0_8px_20px_-6px_rgb(147_51_234/0.4)] hover:from-primary-500 hover:to-primary-700 hover:shadow-[0_1px_0_0_rgb(255_255_255/0.15)_inset,0_10px_24px_-6px_rgb(147_51_234/0.5)] active:scale-[0.98] focus-visible:outline-primary-600',
  secondary:
    'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-[0.98] focus-visible:outline-neutral-400',
  outline:
    'border border-neutral-200 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700 active:scale-[0.98] focus-visible:outline-primary-600',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 active:scale-[0.98] focus-visible:outline-neutral-400',
  danger:
    'bg-linear-to-b from-red-500 to-red-600 text-white shadow-[0_1px_0_0_rgb(255_255_255/0.15)_inset,0_8px_20px_-6px_rgb(220_38_38/0.4)] hover:from-red-500 hover:to-red-700 active:scale-[0.98] focus-visible:outline-red-600',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-base gap-2',
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-full font-medium tracking-tight transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

export default Button
