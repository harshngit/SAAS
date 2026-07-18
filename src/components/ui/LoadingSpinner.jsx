import { Loader2 } from 'lucide-react'

const sizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

export default function LoadingSpinner({ size = 'md', label, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-6 text-primary-400 ${className}`}>
      <Loader2 className={`animate-spin ${sizeClasses[size]}`} aria-hidden="true" />
      {label && <p className="text-sm text-neutral-400">{label}</p>}
    </div>
  )
}
