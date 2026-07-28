import { useMemo } from 'react'
import { Building2, CalendarDays, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../auth/roles'

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value || 'Not available'}</p>
    </div>
  )
}

export default function Profile() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentOrganization = useAuthStore((state) => state.currentOrganization)

  const initials = useMemo(
    () =>
      (currentUser?.name || 'User')
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
    [currentUser?.name],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Profile</h1>
        <p className="mt-1 text-sm text-neutral-500">Your account and organization details</p>
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <Card bodyClassName="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 font-(--font-display) text-2xl font-semibold text-white">
            {initials}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">{currentUser?.name || 'User'}</h2>
          <p className="mt-1 text-sm text-neutral-500">{currentUser?.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge variant={currentUser?.is_active === false ? 'danger' : 'success'}>
              {currentUser?.is_active === false ? 'Inactive' : 'Active'}
            </Badge>
            <Badge>{roleLabels[currentUser?.role] || currentUser?.role || 'User'}</Badge>
          </div>
        </Card>

        <Card title="Account Details" subtitle="Information returned by /auth/me">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <DetailItem label="User ID" value={currentUser?.id} />
            <DetailItem label="Organization ID" value={currentUser?.organization_id || currentUser?.orgId} />
            <DetailItem label="Phone" value={currentUser?.phone} />
            <DetailItem label="Role" value={roleLabels[currentUser?.role] || currentUser?.role} />
            <DetailItem label="Created At" value={formatDate(currentUser?.created_at || currentUser?.joinedAt)} />
            <DetailItem label="Status" value={currentUser?.is_active === false ? 'Inactive' : 'Active'} />
          </div>
        </Card>
      </section>

      <Card title="Organization" subtitle="Workspace details saved in local storage">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="Name" value={currentOrganization?.name} />
          <DetailItem label="Business Type" value={currentOrganization?.business_type || currentOrganization?.businessType} />
          <DetailItem label="Email" value={currentOrganization?.email} />
          <DetailItem label="Phone" value={currentOrganization?.phone} />
          <DetailItem label="GST Number" value={currentOrganization?.gst_number || currentOrganization?.gstNumber} />
          <DetailItem label="PAN Number" value={currentOrganization?.pan_number || currentOrganization?.panNumber} />
          <DetailItem label="Financial Year" value={currentOrganization?.financial_year || currentOrganization?.financialYear} />
          <DetailItem label="Created At" value={formatDate(currentOrganization?.created_at || currentOrganization?.createdAt)} />
        </div>
        <div className="mt-5 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase text-neutral-400">Address</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{currentOrganization?.address || currentOrganization?.billingAddress || 'Not available'}</p>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-primary-600" />
            <DetailItem label="Plan" value={currentOrganization?.plan} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-emerald-600" />
            <DetailItem label="Upgrade Status" value={currentOrganization?.upgrade_status || currentOrganization?.upgradeStatus} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <CalendarDays className="size-5 text-amber-600" />
            <DetailItem label="Trial Ends" value={formatDate(currentOrganization?.trial_ends_at || currentOrganization?.trialEndsAt)} />
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <UserRound className="size-5 text-neutral-500" />
            <DetailItem label="Admin Name" value={currentUser?.name} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-neutral-500" />
            <DetailItem label="Admin Email" value={currentUser?.email} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Phone className="size-5 text-neutral-500" />
            <DetailItem label="Admin Phone" value={currentUser?.phone} />
          </div>
        </Card>
      </div>
    </div>
  )
}
