import { Inbox } from 'lucide-react'
import Button from './Button'

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}>
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-800">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-neutral-400">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
