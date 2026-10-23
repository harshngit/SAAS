import { useEffect, useMemo, useState } from 'react'
import { Bell, BellOff, Building2, Calendar, Camera, CreditCard, Hash, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { roleLabels } from '../../auth/roles'
import { getCurrentProfile } from '../../api/auth'
import { updateUser } from '../../api/users'
import { getFileUrl, uploadFile } from '../../api/files'
import { sendTestPush } from '../../api/pushDevices'
import { disablePush, enablePush, getPushStatus, isPushAvailable } from '../../push/pushService'

const PUSH_STATUS_META = {
  unsupported: { label: 'Not supported', badge: 'neutral' },
  denied: { label: 'Blocked', badge: 'danger' },
  granted: { label: 'On', badge: 'success' },
  default: { label: 'Off', badge: 'neutral' },
}

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Not available'
  }

  if (typeof value === 'object') {
    return value.name || value.title || value.id || 'Not available'
  }

  return String(value)
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-neutral-900">{formatDetailValue(value)}</p>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, iconClassName, label, value }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-neutral-400">{label}</p>
          <p className="truncate text-sm font-semibold text-neutral-900">{formatDetailValue(value)}</p>
        </div>
      </div>
    </Card>
  )
}

export default function Profile() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const { showToast } = useToast()
  // PATCH /users/{id} is admin-only on the backend, regardless of what the permissions matrix
  // grants a custom role - fullAccess is this app's existing signal for "is actually Admin" (see
  // usePermission.js: full_access short-circuits every permission check the same way the backend
  // does). A non-admin role must never see the upload affordance and then eat an avoidable 403.
  const { fullAccess: canEditOwnPhoto } = usePermission()
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)
  // null while unresolved (and the whole card stays hidden) - pushAvailable is a build-time
  // config check (no Firebase env vars = feature doesn't exist for this deployment, never shown);
  // pushStatus is the actual per-browser status, resolved async since it depends on an
  // isSupported() capability check.
  const pushAvailable = useMemo(() => isPushAvailable(), [])
  const [pushStatus, setPushStatus] = useState(null)
  const [isEnablingPush, setIsEnablingPush] = useState(false)
  const [isDisablingPush, setIsDisablingPush] = useState(false)
  const [isSendingTestPush, setIsSendingTestPush] = useState(false)

  useEffect(() => {
    if (!pushAvailable) return undefined
    let isMounted = true
    getPushStatus().then((status) => {
      if (isMounted) setPushStatus(status)
    })
    return () => {
      isMounted = false
    }
  }, [pushAvailable])

  const handleEnablePush = async () => {
    setIsEnablingPush(true)
    const result = await enablePush()
    setIsEnablingPush(false)

    if (result.success) {
      setPushStatus('granted')
      showToast({ title: 'Notifications enabled', message: 'You will now receive browser notifications from this app.' })
      return
    }

    if (result.reason === 'denied') {
      setPushStatus('denied')
      showToast({
        title: 'Notifications blocked',
        message: 'Allow notifications for this site in your browser settings, then reload this page.',
        variant: 'error',
      })
      return
    }

    if (result.reason === 'dismissed') return // user closed the permission prompt - stay "Off", no error needed

    showToast({ title: 'Could not enable notifications', message: 'Please try again.', variant: 'error' })
  }

  const handleDisablePush = async () => {
    setIsDisablingPush(true)
    await disablePush()
    setIsDisablingPush(false)
    setPushStatus('default')
    showToast({ title: 'Notifications disabled', message: 'You will no longer receive browser notifications.' })
  }

  const handleSendTestPush = async () => {
    setIsSendingTestPush(true)
    const result = await sendTestPush()
    setIsSendingTestPush(false)

    if (!result.success) {
      showToast({ title: 'Test failed', message: result.error, variant: 'error' })
      return
    }

    // Plain-words summary of the full response, not just enabled/accepted - the extra counts only
    // show up when they're non-zero, so a clean run still reads as a short, single-line message.
    const parts = [`Enabled: ${result.enabled ? 'yes' : 'no'}`]
    if (result.attempted !== undefined) parts.push(`sent to ${result.accepted} of ${result.attempted} device(s)`)
    else if (result.accepted !== undefined) parts.push(`accepted by ${result.accepted} device(s)`)
    if (result.invalidTokensRemoved) parts.push(`${result.invalidTokensRemoved} stale device(s) removed`)
    if (result.transientFailures) parts.push(`${result.transientFailures} temporary failure(s)`)
    if (result.detail) parts.push(result.detail)

    showToast({
      title: result.enabled ? 'Test notification sent' : 'Push notifications are off on the server',
      message: parts.join(' · '),
      variant: result.enabled ? 'success' : 'error',
    })
  }

  const orgAddress = currentOrganization?.address || currentOrganization?.billingAddress || ''
  // Same keyless Google Maps pattern already used in CompanySettings.jsx for this exact
  // organization address - a plain text-query deep link/embed, no API key or billing involved.
  const mapUrl = orgAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(orgAddress)}` : ''
  const mapEmbedUrl = orgAddress ? `https://www.google.com/maps?q=${encodeURIComponent(orgAddress)}&output=embed` : ''

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

  // authStore's setAuthenticatedSession spreads the raw /auth/me user as-is (never maps
  // snake_case -> camelCase), so profilePhoto/basic_information are defensive aliases of the
  // SAME field only - the real value normally arrives flat as profile_photo. This is the
  // logged-in user's OWN photo and nothing else - never the organization's Authorized Person
  // photo (a completely independent concept, shown only on Company Settings).
  const rawProfilePhoto = currentUser?.profile_photo || currentUser?.profilePhoto || currentUser?.basic_information?.profile_photo
  const photoUrl = rawProfilePhoto ? getFileUrl(rawProfilePhoto) : ''
  const showPhoto = Boolean(photoUrl) && !photoLoadFailed

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !currentUser?.id || !canEditOwnPhoto) return

    setIsUploadingPhoto(true)
    const uploadResult = await uploadFile(file)
    if (!uploadResult.success) {
      setIsUploadingPhoto(false)
      showToast({ title: 'Upload failed', message: uploadResult.error, variant: 'error' })
      return
    }

    const updateResult = await updateUser(currentUser.id, { profilePhotoUrl: uploadResult.file.url })
    setIsUploadingPhoto(false)
    if (!updateResult.success) {
      showToast({ title: 'Could not update photo', message: updateResult.error, variant: 'error' })
      return
    }

    setPhotoLoadFailed(false)
    await getCurrentProfile()
    showToast({ title: 'Photo updated', message: 'Your profile photo has been changed.' })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Profile</h1>
        <p className="mt-1 text-sm text-neutral-500">Your account and organization details</p>
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <Card bodyClassName="flex flex-col items-center text-center">
          {canEditOwnPhoto ? (
            <label
              className={`group relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-4 ring-primary-50 transition-all ${
                showPhoto ? '' : 'bg-linear-to-br from-primary-500 to-primary-700'
              }`}
            >
              {showPhoto ? (
                <img src={photoUrl} alt={currentUser?.name} className="absolute inset-0 size-full object-cover" onError={() => setPhotoLoadFailed(true)} />
              ) : (
                <span className="font-(--font-display) text-2xl font-semibold text-white">{initials}</span>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/0 opacity-0 transition-all group-hover:bg-neutral-900/55 group-hover:opacity-100">
                <Camera className="size-5 text-white" aria-hidden="true" />
              </div>
              <input type="file" accept="image/*" className="sr-only" disabled={isUploadingPhoto} onChange={handlePhotoChange} />
            </label>
          ) : (
            // Read-only: this role can't call PATCH /users/{id} (admin-only on the backend), so
            // no hover/camera upload affordance - just the plain avatar.
            <div
              className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full ring-4 ring-primary-50 ${
                showPhoto ? '' : 'bg-linear-to-br from-primary-500 to-primary-700'
              }`}
            >
              {showPhoto ? (
                <img src={photoUrl} alt={currentUser?.name} className="size-full object-cover" onError={() => setPhotoLoadFailed(true)} />
              ) : (
                <span className="font-(--font-display) text-2xl font-semibold text-white">{initials}</span>
              )}
            </div>
          )}
          {isUploadingPhoto && <p className="mt-2 text-xs font-medium text-primary-600">Uploading...</p>}
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">{currentUser?.name || 'User'}</h2>
          <p className="mt-1 text-sm text-neutral-500">{currentUser?.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge variant={currentUser?.is_active === false ? 'danger' : 'success'} dot>
              {currentUser?.is_active === false ? 'Inactive' : 'Active'}
            </Badge>
            <Badge>{roleLabels[currentUser?.role] || currentUser?.role || 'User'}</Badge>
          </div>
        </Card>

        <Card title="Account Details">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailItem icon={Phone} label="Phone" value={currentUser?.phone} />
            <DetailItem icon={ShieldCheck} label="Role" value={roleLabels[currentUser?.role] || currentUser?.role} />
            <DetailItem icon={Calendar} label="Joined" value={formatDate(currentUser?.created_at || currentUser?.joinedAt)} />
            <DetailItem icon={Hash} label="User ID" value={currentUser?.id} />
          </div>
        </Card>
      </section>

      <Card title="Organization">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem icon={Building2} label="Name" value={currentOrganization?.name} />
          <DetailItem icon={Hash} label="Business Type" value={currentOrganization?.business_type || currentOrganization?.businessType} />
          <DetailItem icon={Mail} label="Email" value={currentOrganization?.email} />
          <DetailItem icon={Phone} label="Phone" value={currentOrganization?.phone} />
          <DetailItem icon={Hash} label="GST Number" value={currentOrganization?.gst_number || currentOrganization?.gstNumber} />
          <DetailItem icon={Hash} label="PAN Number" value={currentOrganization?.pan_number || currentOrganization?.panNumber} />
          <DetailItem icon={Calendar} label="Financial Year" value={currentOrganization?.financial_year || currentOrganization?.financialYear} />
          <DetailItem icon={Calendar} label="Created" value={formatDate(currentOrganization?.created_at || currentOrganization?.createdAt)} />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4 md:grid-cols-[1fr_14rem]">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Address</p>
              <p className="mt-0.5 text-sm font-medium text-neutral-900">{orgAddress || 'Not available'}</p>
            </div>
          </div>
          {orgAddress && (
            <div className="relative min-h-36 overflow-hidden rounded-xl border border-neutral-100 bg-surface">
              <iframe
                title={`Map location for ${currentOrganization?.name || 'organization'}`}
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 size-full border-0"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-transparent" />
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 right-3 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-sm ring-1 ring-neutral-100"
              >
                View on Map
              </a>
            </div>
          )}
        </div>
      </Card>

      {pushAvailable && pushStatus && (
        <Card title="Browser Notifications">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${
                  pushStatus === 'granted' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {pushStatus === 'granted' ? <Bell className="size-4.5" aria-hidden="true" /> : <BellOff className="size-4.5" aria-hidden="true" />}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">Status</p>
                  <Badge variant={PUSH_STATUS_META[pushStatus]?.badge || 'neutral'} dot>
                    {PUSH_STATUS_META[pushStatus]?.label || pushStatus}
                  </Badge>
                </div>
                <p className="mt-1 max-w-md text-sm text-neutral-500">
                  {pushStatus === 'unsupported' && 'This browser does not support push notifications.'}
                  {pushStatus === 'denied' &&
                    'Notifications are blocked for this site. Open your browser\'s site settings (click the lock icon next to the address bar), allow Notifications, then reload this page.'}
                  {pushStatus === 'granted' && 'You will receive browser notifications from this app, even in a background tab.'}
                  {pushStatus === 'default' && 'Turn this on to get browser notifications for things that need your attention.'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {pushStatus === 'default' && (
                <Button type="button" size="sm" loading={isEnablingPush} onClick={handleEnablePush}>
                  Enable notifications
                </Button>
              )}
              {pushStatus === 'granted' && (
                <>
                  <Button type="button" variant="outline" size="sm" loading={isSendingTestPush} onClick={handleSendTestPush}>
                    Send test notification
                  </Button>
                  <Button type="button" variant="outline" size="sm" loading={isDisablingPush} onClick={handleDisablePush}>
                    Disable
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatTile icon={CreditCard} iconClassName="bg-primary-50 text-primary-700" label="Plan" value={currentOrganization?.plan?.name || currentOrganization?.plan} />
        <StatTile icon={ShieldCheck} iconClassName="bg-emerald-50 text-emerald-700" label="Upgrade Status" value={currentOrganization?.upgrade_status || currentOrganization?.upgradeStatus} />
        <StatTile icon={Calendar} iconClassName="bg-amber-50 text-amber-700" label="Trial Ends" value={formatDate(currentOrganization?.trial_ends_at || currentOrganization?.trialEndsAt)} />
      </section>
    </div>
  )
}
