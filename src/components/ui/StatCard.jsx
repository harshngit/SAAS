import { ArrowUp, ArrowDown } from 'lucide-react'

const iconVariantClasses = {
  primary: 'bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-[0_4px_10px_-3px_rgb(147_51_234/0.45)]',
  success: 'bg-linear-to-br from-green-400 to-green-600 text-white shadow-[0_4px_10px_-3px_rgb(22_163_74/0.4)]',
  warning: 'bg-linear-to-br from-amber-400 to-amber-600 text-white shadow-[0_4px_10px_-3px_rgb(217_119_6/0.4)]',
  danger: 'bg-linear-to-br from-red-400 to-red-600 text-white shadow-[0_4px_10px_-3px_rgb(220_38_38/0.4)]',
  info: 'bg-linear-to-br from-blue-400 to-blue-600 text-white shadow-[0_4px_10px_-3px_rgb(37_99_235/0.4)]',
  neutral: 'bg-neutral-100 text-neutral-600',
}

export default function StatCard({ icon: Icon, label, value, iconVariant = 'primary', delta, actions, className = '' }) {
  return (
    <div
      className={`group rounded-2xl border border-neutral-100 bg-white p-5 shadow-(--shadow-card) transition-all duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-card-hover) ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500">{label}</p>
        <div className="flex shrink-0 items-center gap-1">
          {Icon && (
            <div className={`flex size-9 items-center justify-center rounded-xl ${iconVariantClasses[iconVariant]}`}>
              <Icon className="size-4" aria-hidden="true" />
            </div>
          )}
          {actions}
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      {delta && (
        <p
          className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
            delta.positive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {delta.trend === 'up' ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )}
          {delta.label}
        </p>
      )}
    </div>
  )
}
