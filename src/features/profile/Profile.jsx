import { useMemo, useState } from 'react'
import { Building2, Calendar, Camera, CreditCard, Hash, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'
import { roleLabels } from '../../auth/roles'
import { getCurrentProfile } from '../../api/auth'
import { updateUser } from '../../api/users'
import { getFileUrl, uploadFile } from '../../api/files'

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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)

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

  const photoUrl = currentUser?.profilePhoto ? getFileUrl(currentUser.profilePhoto) : ''
  const showPhoto = Boolean(photoUrl) && !photoLoadFailed

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !currentUser?.id) return

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

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatTile icon={CreditCard} iconClassName="bg-primary-50 text-primary-700" label="Plan" value={currentOrganization?.plan?.name || currentOrganization?.plan} />
        <StatTile icon={ShieldCheck} iconClassName="bg-emerald-50 text-emerald-700" label="Upgrade Status" value={currentOrganization?.upgrade_status || currentOrganization?.upgradeStatus} />
        <StatTile icon={Calendar} iconClassName="bg-amber-50 text-amber-700" label="Trial Ends" value={formatDate(currentOrganization?.trial_ends_at || currentOrganization?.trialEndsAt)} />
      </section>
    </div>
  )
}
