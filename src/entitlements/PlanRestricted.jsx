import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'

// The plan-restriction blocked state (§6/§7) - deliberately distinct from a role-permission
// denial, which silently redirects home (RequirePermissionRoute). This renders IN PLACE, names
// the plan as the reason, and offers a direct path to upgrade, so it never looks like a broken
// link or a generic 403.
export default function PlanRestricted({ title = 'Feature Not Available', description = 'This feature is not included in your current plan.' }) {
  const navigate = useNavigate()
  return (
    <Card>
      <EmptyState
        icon={Lock}
        title={title}
        description={description}
        action={{ label: 'View Plans', onClick: () => navigate('/admin/plans') }}
      />
    </Card>
  )
}
