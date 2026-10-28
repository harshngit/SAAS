import { label } from './platformHelpers'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

export function RequestStatus({ value }) {
  return <Badge variant={({ pending: 'warning', approved: 'success', rejected: 'danger' })[value] || 'neutral'}>{label(value)}</Badge>
}
export function PlatformError({ error, retry }) {
  if (!error) return null
  return <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p>{retry && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={retry}>Retry</Button>}</div>
}
