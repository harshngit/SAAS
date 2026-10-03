import { Target } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'

// No targets/performance backend endpoint exists anywhere in this frontend's API surface, and
// this feature isn't in the approved MVP scope. Previously showed hardcoded target/achieved
// numbers as if real. The nav entry ("My Performance") has been removed from
// auth/roles.js; this honest state stays as a safety net for anyone who already has the
// /sales/performance URL bookmarked or open.
export default function MyTargets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Targets</h1>
        <p className="text-sm text-neutral-500">Track your monthly progress</p>
      </div>

      <Card>
        <EmptyState
          icon={Target}
          title="Targets tracking is not available yet"
          description="This feature isn't part of the current product yet. Once a real targets/performance endpoint exists, your monthly progress will show here."
        />
      </Card>
    </div>
  )
}
