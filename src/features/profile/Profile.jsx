import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, Building2, Calendar, Camera, CreditCard, Hash, Mail, MapPin, Pencil, Phone, ShieldCheck, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { roleLabels } from '../../auth/roles'
import { changePassword, getCurrentProfile, logout as logoutApi, removeMyProfilePhoto, updateMyProfile, uploadMyProfilePhoto } from '../../api/auth'
import { updateUser } from '../../api/users'
import { getFileUrl } from '../../api/files'
import { sendTestPush } from '../../api/pushDevices'
import { disablePush, enablePush, getPushStatus, isPushAvailable } from '../../push/pushService'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]
const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((value) => ({ value, label: value }))
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
]
const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
]

// Every field PATCH /auth/me accepts, for every signed-in role (tenant staff/admin, Sales
// Manager, Super Admin) - see crm_changes15.md "everyone edits their own profile". `name` is
// deliberately left out of this editable set: the backend rebuilds it from first_name/last_name
// whenever either changes, so a separate raw `name` field here would just race that rule.
const PROFILE_FIELD_GROUPS = [
  {
    label: 'Personal',
    fields: [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'display_name', label: 'Display Name' },
      { key: 'gender', label: 'Gender', kind: 'select', options: GENDER_OPTIONS },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'marital_status', label: 'Marital Status', kind: 'select', options: MARITAL_STATUS_OPTIONS },
      { key: 'blood_group', label: 'Blood Group', kind: 'select', options: BLOOD_GROUP_OPTIONS },
      { key: 'nationality', label: 'Nationality' },
    ],
  },
  {
    label: 'Contact',
    fields: [
      { key: 'alternate_mobile_number', label: 'Alternate Mobile Number', type: 'tel' },
      { key: 'personal_email', label: 'Personal Email', type: 'email' },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
      { key: 'emergency_contact_number', label: 'Emergency Contact Number', type: 'tel' },
      { key: 'emergency_contact_relationship', label: 'Emergency Contact Relationship' },
    ],
  },
  {
    label: 'Address',
    fields: [
      { key: 'current_address', label: 'Current Address', kind: 'textarea' },
      { key: 'permanent_address', label: 'Permanent Address', kind: 'textarea' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'country', label: 'Country' },
      { key: 'pin_zip_code', label: 'PIN/ZIP Code' },
    ],
  },
  {
    label: 'Preferences',
    fields: [
      { key: 'language', label: 'Language', kind: 'select', options: LANGUAGE_OPTIONS },
      { key: 'time_zone', label: 'Time Zone', kind: 'select', options: TIME_ZONE_OPTIONS },
    ],
  },
]
const PROFILE_FIELD_KEYS = PROFILE_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.key))

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

function DetailItem({ icon: Icon, label, value, verified = false }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        <div className="flex flex-wrap items-center gap-2"><p className="mt-0.5 truncate text-sm font-medium text-neutral-900">{formatDetailValue(value)}</p>{verified && <Badge variant="success">Verified</Badge>}</div>
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
  const navigate = useNavigate()
  // PATCH /users/{id} is admin-only on the backend, regardless of what the permissions matrix
  // grants a custom role - fullAccess is this app's existing signal for "is actually Admin" (see
  // usePermission.js: full_access short-circuits every permission check the same way the backend
  // does). Mobile number is read-only on PATCH /auth/me for every role (see PROFILE_FIELD_GROUPS'
  // comment), so changing it still only ever goes through the admin-only /users/{id} route -
  // unrelated to the photo/details sections below, which now use /auth/me and are open to everyone.
  const { fullAccess } = usePermission()
  const canEditOwnPhoneViaAdminRoute = fullAccess
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState({})
  const [detailsErrors, setDetailsErrors] = useState({})
  const [savingDetails, setSavingDetails] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
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

  // POST /auth/me/photo - available to every signed-in role now (not just admins, unlike the
  // old /users/{id} route), see crm_changes15.md "everyone edits their own profile".
  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !currentUser?.id) return

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      showToast({ title: 'Unsupported file', message: 'Profile photo must be a JPEG, PNG or WebP image.', variant: 'error' })
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast({ title: 'File too large', message: 'Profile photo must be 5 MB or smaller.', variant: 'error' })
      return
    }

    setIsUploadingPhoto(true)
    const uploadResult = await uploadMyProfilePhoto(file)
    if (!uploadResult.success) {
      setIsUploadingPhoto(false)
      showToast({ title: 'Upload failed', message: uploadResult.error, variant: 'error' })
      return
    }

    setPhotoLoadFailed(false)
    await getCurrentProfile()
    setIsUploadingPhoto(false)
    showToast({ title: 'Photo updated', message: 'Your profile photo has been changed.' })
  }

  const handleRemovePhoto = async () => {
    if (!currentUser?.id || isUploadingPhoto) return
    setIsUploadingPhoto(true)
    const result = await removeMyProfilePhoto()
    if (!result.success) {
      setIsUploadingPhoto(false)
      showToast({ title: 'Could not remove photo', message: result.error, variant: 'error' })
      return
    }
    await getCurrentProfile()
    setIsUploadingPhoto(false)
    showToast({ title: 'Photo removed' })
  }

  const savePhone = async (event) => {
    event.preventDefault()
    if (!canEditOwnPhoneViaAdminRoute || !currentUser?.id || savingPhone) return
    setPhoneError('')
    if (!/^\+?[0-9][0-9\s-]{9,14}$/.test(phoneDraft.trim())) {
      setPhoneError('Enter a valid phone number')
      return
    }
    setSavingPhone(true)
    const result = await updateUser(currentUser.id, { phone: phoneDraft.trim() })
    if (!result.success) {
      setSavingPhone(false)
      setPhoneError(result.fieldErrors?.phone || result.error)
      return
    }
    const profile = await getCurrentProfile()
    setSavingPhone(false)
    if (!profile.success) { setPhoneError(profile.error); return }
    setEditingPhone(false)
    showToast({ title: 'Phone number updated.' })
  }

  const startEditDetails = () => {
    const draft = {}
    for (const key of PROFILE_FIELD_KEYS) draft[key] = currentUser?.[key] ?? ''
    setDetailsDraft(draft)
    setDetailsErrors({})
    setEditingDetails(true)
  }

  const saveDetails = async (event) => {
    event.preventDefault()
    if (savingDetails) return

    const payload = {}
    for (const key of PROFILE_FIELD_KEYS) {
      const nextValue = (detailsDraft[key] ?? '').toString()
      const currentValue = (currentUser?.[key] ?? '').toString()
      if (nextValue !== currentValue) payload[key] = nextValue
    }

    if (Object.keys(payload).length === 0) {
      setEditingDetails(false)
      return
    }

    setSavingDetails(true)
    setDetailsErrors({})
    const result = await updateMyProfile(payload)
    if (!result.success) {
      setSavingDetails(false)
      if (Object.keys(result.fieldErrors || {}).length > 0) setDetailsErrors(result.fieldErrors)
      else showToast({ title: 'Could not save details', message: result.error, variant: 'error' })
      return
    }

    const profile = await getCurrentProfile()
    setSavingDetails(false)
    if (!profile.success) {
      showToast({ title: 'Saved, but could not refresh profile', message: profile.error, variant: 'error' })
      return
    }
    setEditingDetails(false)
    showToast({ title: 'Profile updated' })
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')

    if (!passwordDraft.currentPassword.trim()) {
      setPasswordError('Current password is required.')
      return
    }
    if (passwordDraft.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError('New password and confirm password must match.')
      return
    }

    setIsChangingPassword(true)
    const result = await changePassword({ currentPassword: passwordDraft.currentPassword, newPassword: passwordDraft.newPassword })
    setIsChangingPassword(false)

    if (!result.success) {
      setPasswordError(result.error)
      return
    }

    // Every other session's refresh token is revoked by this call, including this one's - stay
    // signed in locally would just mean failing on the next silent refresh, so sign out now
    // while the message is still on screen (see crm_changes15.md "Change password").
    showToast({ title: 'Password changed', message: 'Please log in again.' })
    await logoutApi()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Profile</h1>
        <p className="mt-1 text-sm text-neutral-500">Your account and organization details</p>
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <Card bodyClassName="flex flex-col items-center text-center">
          {/* Photo is now self-service for every signed-in role via POST/DELETE /auth/me/photo -
              not gated to admins any more (that gate only ever applied to the old /users/{id}
              route). See crm_changes15.md "everyone edits their own profile". */}
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
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isUploadingPhoto} onChange={handlePhotoChange} />
          </label>
          {isUploadingPhoto && <p className="mt-2 text-xs font-medium text-primary-600">Uploading...</p>}
          {!isUploadingPhoto && showPhoto && (
            <button type="button" onClick={handleRemovePhoto} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-red-600">
              <Trash2 className="size-3" aria-hidden="true" />
              Remove photo
            </button>
          )}
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">{currentUser?.name || 'User'}</h2>
          <p className="mt-1 text-sm text-neutral-500">{currentUser?.email}</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            {fullAccess ? 'Change your login email from Company Settings → Account.' : 'Ask your admin to change your login email.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge variant={currentUser?.is_active === false ? 'danger' : 'success'} dot>
              {currentUser?.is_active === false ? 'Inactive' : 'Active'}
            </Badge>
            <Badge>{roleLabels[currentUser?.role] || currentUser?.role || 'User'}</Badge>
          </div>
        </Card>

        <Card title="Account Details">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              {editingPhone ? (
                <form onSubmit={savePhone} className="space-y-3">
                  <Input label="Phone" type="tel" placeholder="+91 98765 43210" value={phoneDraft} error={phoneError} disabled={savingPhone}
                    onChange={(event) => { setPhoneDraft(event.target.value); setPhoneError('') }} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" loading={savingPhone}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={savingPhone} onClick={() => setEditingPhone(false)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <>
                  <DetailItem icon={Phone} label="Phone" value={currentUser?.phone} verified={currentUser?.phone_verified === true} />
                  {canEditOwnPhoneViaAdminRoute && <button type="button" className="ml-11 mt-1 text-xs font-medium text-primary-600 hover:underline"
                    onClick={() => { setPhoneDraft(currentUser?.phone || ''); setPhoneError(''); setEditingPhone(true) }}>Edit phone</button>}
                </>
              )}
            </div>
            <DetailItem icon={ShieldCheck} label="Role" value={roleLabels[currentUser?.role] || currentUser?.role} />
            <DetailItem icon={Calendar} label="Joined" value={formatDate(currentUser?.created_at || currentUser?.joinedAt)} />
            <DetailItem icon={Hash} label="User ID" value={currentUser?.id} />
          </div>
        </Card>
      </section>

      <Card
        title="Additional Details"
        actions={!editingDetails && (
          <Button type="button" size="sm" variant="outline" onClick={startEditDetails}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Button>
        )}
      >
        {editingDetails ? (
          <form onSubmit={saveDetails} className="space-y-6">
            {PROFILE_FIELD_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">{group.label}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {group.fields.map((field) =>
                    field.kind === 'select' ? (
                      <Select
                        key={field.key}
                        label={field.label}
                        placeholder={`Select ${field.label.toLowerCase()}`}
                        options={field.options}
                        value={detailsDraft[field.key] || ''}
                        error={detailsErrors[field.key]}
                        onChange={(event) => setDetailsDraft((value) => ({ ...value, [field.key]: event.target.value }))}
                      />
                    ) : field.kind === 'textarea' ? (
                      <div key={field.key} className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-sm font-medium text-fg">{field.label}</label>
                        <textarea
                          rows={2}
                          value={detailsDraft[field.key] || ''}
                          onChange={(event) => setDetailsDraft((value) => ({ ...value, [field.key]: event.target.value }))}
                          className="w-full rounded-xl border border-surface-border bg-(--input-bg) px-3.5 py-2.5 text-sm text-fg transition-all focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                        />
                        {detailsErrors[field.key] && <span className="text-xs text-red-600">{detailsErrors[field.key]}</span>}
                      </div>
                    ) : (
                      <Input
                        key={field.key}
                        label={field.label}
                        type={field.type || 'text'}
                        value={detailsDraft[field.key] || ''}
                        error={detailsErrors[field.key]}
                        onChange={(event) => setDetailsDraft((value) => ({ ...value, [field.key]: event.target.value }))}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={savingDetails}>Save Details</Button>
              <Button type="button" size="sm" variant="ghost" disabled={savingDetails} onClick={() => setEditingDetails(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PROFILE_FIELD_GROUPS.flatMap((group) => group.fields).map((field) => (
              <DetailItem
                key={field.key}
                label={field.label}
                value={field.kind === 'select' ? field.options.find((option) => option.value === currentUser?.[field.key])?.label || currentUser?.[field.key] : currentUser?.[field.key]}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Change Password">
        <form onSubmit={savePassword} className="grid max-w-md grid-cols-1 gap-4">
          {passwordError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{passwordError}</p>}
          <Input
            label="Current Password"
            type="password"
            autoComplete="current-password"
            value={passwordDraft.currentPassword}
            disabled={isChangingPassword}
            onChange={(event) => setPasswordDraft((value) => ({ ...value, currentPassword: event.target.value }))}
          />
          <Input
            label="New Password"
            type="password"
            autoComplete="new-password"
            value={passwordDraft.newPassword}
            disabled={isChangingPassword}
            onChange={(event) => setPasswordDraft((value) => ({ ...value, newPassword: event.target.value }))}
          />
          <Input
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            value={passwordDraft.confirmPassword}
            disabled={isChangingPassword}
            onChange={(event) => setPasswordDraft((value) => ({ ...value, confirmPassword: event.target.value }))}
          />
          <Button type="submit" size="sm" className="w-fit" loading={isChangingPassword}>Change Password</Button>
        </form>
      </Card>

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
