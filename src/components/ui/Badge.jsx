// index.css's --badge-*-bg/-text tokens default to these exact colors everywhere except
// dark+image mode, where they become tinted-translucent with a colored border (variantBorderClasses
// below) instead of the opaque *-50 swatches - those are pinned hex and never inverted with the
// neutral-scale dark-mode remap.
const variantClasses = {
  neutral: 'bg-(--badge-neutral-bg) text-(--badge-neutral-text)',
  primary: 'bg-(--badge-primary-bg) text-(--badge-primary-text)',
  success: 'bg-(--badge-success-bg) text-(--badge-success-text)',
  warning: 'bg-(--badge-warning-bg) text-(--badge-warning-text)',
  danger: 'bg-(--badge-danger-bg) text-(--badge-danger-text)',
  info: 'bg-(--badge-info-bg) text-(--badge-info-text)',
  purple: 'bg-(--badge-primary-bg) text-(--badge-primary-text)',
}

// Dark-mode tinted borders (index.css's --badge-*-border tokens - transparent in Light, so this
// never changes today's look there). Purple reuses the primary tint, matching variantClasses.
const variantBorderClasses = {
  neutral: 'border-(--badge-neutral-border)',
  primary: 'border-(--badge-primary-border)',
  success: 'border-(--badge-success-border)',
  warning: 'border-(--badge-warning-border)',
  danger: 'border-(--badge-danger-border)',
  info: 'border-(--badge-info-border)',
  purple: 'border-(--badge-primary-border)',
}

const dotClasses = {
  neutral: 'bg-neutral-400',
  primary: 'bg-primary-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  purple: 'bg-primary-500',
}

export default function Badge({ variant = 'neutral', dot = false, className = '', children }) {
  return (
    <span
      // app-badge: a stable marker a list table can target to shrink this to match its own
      // compact typography (index.css's .listing-table .app-badge) - not a visual class itself.
      className={`app-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight ring-1 ring-inset ring-black/3 ${variantClasses[variant]} ${variantBorderClasses[variant]} ${className}`}
    >
      {dot && <span className={`size-1.5 shrink-0 rounded-full ${dotClasses[variant]}`} aria-hidden="true" />}
      {children}
    </span>
  )
}
