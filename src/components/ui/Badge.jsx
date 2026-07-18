const variantClasses = {
  neutral: 'bg-neutral-100 text-neutral-600',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
}

const dotClasses = {
  neutral: 'bg-neutral-400',
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  purple: 'bg-purple-500',
}

export default function Badge({ variant = 'neutral', dot = false, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-tight ring-1 ring-inset ring-black/3 ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`size-1.5 shrink-0 rounded-full ${dotClasses[variant]}`} aria-hidden="true" />}
      {children}
    </span>
  )
}
