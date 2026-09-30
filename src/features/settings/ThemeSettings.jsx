import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Image as ImageIcon, Moon, Palette, RotateCcw, Save, Sun, Trash2, Upload } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/toastContext'
import { usePermission } from '../../auth/usePermission'
import { useTheme } from '../../theme/useTheme'
import {
  deleteThemeBackground,
  resetOrganizationTheme,
  updateOrganizationTheme,
  uploadThemeBackground,
} from '../../api/theme'
import { resolveAccentContrast, resolveThemeTokens } from '../../theme/themeConfig'

const COLOR_PRESETS = ['#063b00', '#16A34A', '#2563EB', '#DC2626', '#7C3AED', '#EA580C']
const DEFAULT_OVERLAY_BY_MODE = { dark: 0.45, light: 0.2 }

// Not a fake mockup: `resolveThemeTokens(draft)` is the EXACT same function ThemeProvider calls to
// theme the real app - here it's applied as inline style + data-mode/data-bg attributes on this
// wrapper instead of document.documentElement, so index.css's own [data-mode="dark"]/
// [data-bg="image"] rules cascade to this subtree exactly as they would to the real CRM. Everything
// below then uses the real Tailwind classes (bg-surface, bg-(--sidebar-bg), text-fg, ...) the
// actual Layout/Sidebar/Card use - if the real app's theming is broken, this preview shows it
// broken too, rather than silently looking fine on its own.
function ThemePreview({ draft }) {
  const tokens = resolveThemeTokens(draft)
  const hasBackground = Boolean(draft.customEnabled && draft.background?.url)
  const overlayOpacity = draft.background?.overlayOpacity ?? DEFAULT_OVERLAY_BY_MODE[draft.mode] ?? 0.3

  return (
    <div
      data-mode={draft.mode === 'dark' ? 'dark' : 'light'}
      data-bg={hasBackground ? 'image' : 'none'}
      style={tokens}
      className="overflow-hidden rounded-2xl border border-surface-border shadow-(--shadow-card)"
    >
      <div className="relative bg-(--app-bg)">
        {hasBackground && (
          <>
            <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${draft.background.url})` }} />
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ backgroundColor: draft.mode === 'dark' ? '#000000' : '#ffffff', opacity: overlayOpacity }}
            />
          </>
        )}
        <div className="relative flex gap-2 p-3">
          {/* Sidebar */}
          <div className={`flex w-12 shrink-0 flex-col items-center gap-2 rounded-xl bg-(--sidebar-bg) py-2.5 ${hasBackground ? 'theme-glass' : ''}`}>
            <div className="size-4 rounded bg-(--sidebar-active-bg)" />
            <div className="size-3 rounded bg-surface-border" />
            <div className="size-3 rounded bg-surface-border" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {/* Topbar */}
            <div className={`flex items-center justify-between rounded-lg bg-surface px-2.5 py-2 ${hasBackground ? 'theme-glass' : ''}`}>
              <span className="text-[0.65rem] font-semibold text-fg">Dashboard</span>
              <div className="size-3 rounded-full bg-accent" />
            </div>
            {/* Card + Button + Input */}
            <div className={`rounded-lg bg-surface p-2.5 ${hasBackground ? 'theme-glass' : ''}`}>
              <p className="text-xs font-semibold text-fg">Card heading</p>
              <p className="text-[0.62rem] text-fg-muted">Supporting text</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-accent px-2 py-1 text-[0.6rem] font-medium text-(--color-accent-contrast)">Button</span>
                <span className="rounded-full border border-surface-border bg-(--input-bg) px-2 py-1 text-[0.6rem] text-fg-muted">Input</span>
              </div>
              {/* Table row + active nav badge */}
              <div className="mt-2 flex items-center justify-between border-t border-(--row-divider) pt-1.5 text-[0.6rem] text-fg">
                <span>Table row</span>
                <span className="rounded-full bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Shared selected/unselected chip style for the Mode and Background toggles - solid fill + a
// check icon when selected (not just a faint border) so the active choice is unambiguous at a
// glance, matching how the color presets below already show selection.
function ToggleChip({ selected, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        selected
          ? 'border-primary-600 bg-primary-600 text-white shadow-(--shadow-xs)'
          : 'border-neutral-200 bg-surface text-neutral-600 hover:border-primary-300 hover:text-primary-700'
      }`}
    >
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
      {selected && <Check className="size-4" aria-hidden="true" />}
    </button>
  )
}

function ColorField({ label, value, onChange, disabled, warning }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('')}
          title="Use the CRM's default color - clears this custom override"
          className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            !value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
          }`}
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Default
        </button>
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={`size-8 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-50 ${value === color ? 'scale-110 border-neutral-900' : 'border-transparent'}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <label className={`flex size-8 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary-300'}`}>
          <input type="color" value={value || '#063b00'} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="size-0 opacity-0" />
          <Palette className="pointer-events-none size-3.5" aria-hidden="true" />
        </label>
        <Input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder="#063b00" className="w-28" />
      </div>
      {warning && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  )
}

export default function ThemeSettings() {
  const { showToast } = useToast()
  const { can } = usePermission()
  const { theme, refreshTheme, setOptimisticTheme } = useTheme()
  const [draft, setDraft] = useState(theme)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingBackground, setIsUploadingBackground] = useState(false)
  const [isRemovingBackground, setIsRemovingBackground] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [assetError, setAssetError] = useState('')
  const backgroundInputRef = useRef(null)

  // Re-seed the draft whenever the provider's real theme changes (initial load, or a refresh
  // after this page's own save/discard/reset) - never while the user has unsaved edits in
  // progress in the same session.
  const hasLoadedRef = useRef(false)
  useEffect(() => {
    if (!hasLoadedRef.current && theme) {
      setDraft(theme)
      hasLoadedRef.current = true
    }
  }, [theme])

  if (!can('settings')) {
    return (
      <Card>
        <div className="py-8 text-center text-sm text-neutral-500">You don&apos;t have permission to manage appearance settings.</div>
      </Card>
    )
  }

  if (!draft) {
    return (
      <Card>
        <LoadingSpinner label="Loading appearance settings..." />
      </Card>
    )
  }

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const updateBackground = (patch) => setDraft((current) => ({ ...current, background: { ...current.background, ...patch } }))

  const hasBackgroundImage = Boolean(draft.customEnabled && draft.background?.url)
  const contrast = resolveAccentContrast(draft.primaryColor || '#063b00')

  const selectMode = (mode) => updateDraft({ mode })
  // "Plain" / "Image" is the background toggle - selecting Image without an uploaded file yet
  // just arms it (nothing visually changes until an upload succeeds, since Layout/Sidebar/Card
  // all also require background.url to be non-empty before rendering the glass treatment).
  const selectBackgroundKind = (wantsImage) => updateDraft({ customEnabled: wantsImage })

  const handleUploadBackground = async (file) => {
    if (!file) return
    const isValidType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    if (!isValidType) {
      setAssetError('Only PNG, JPG/JPEG, or WebP images are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAssetError('Image must be 5 MB or smaller.')
      return
    }
    setAssetError('')
    setIsUploadingBackground(true)
    const result = await uploadThemeBackground(file)
    setIsUploadingBackground(false)
    if (!result.success) {
      setAssetError(result.error)
      return
    }
    updateDraft({ customEnabled: true })
    updateBackground({ url: result.url })
    showToast({ title: 'Background uploaded', message: 'Background image updated.' })
  }

  const handleRemoveBackground = async () => {
    if (!draft.background?.url) return
    if (!window.confirm('Remove the background image? This clears it for the whole organization.')) return
    setIsRemovingBackground(true)
    const result = await deleteThemeBackground()
    setIsRemovingBackground(false)
    if (!result.success) {
      setAssetError(result.error)
      return
    }
    updateBackground({ url: '' })
    updateDraft({ customEnabled: false })
    showToast({ title: 'Background removed', message: 'Reverted to a plain background.' })
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Only send what actually changed - the backend's own partial-update contract.
    // background.url is never sent here - it's set exclusively by the upload/delete endpoints,
    // which aren't part of the PATCH field list.
    const payload = {}
    if (draft.customEnabled !== theme.customEnabled) payload.customEnabled = draft.customEnabled
    if (draft.mode !== theme.mode) payload.mode = draft.mode
    if (draft.primaryColor !== theme.primaryColor) payload.primaryColor = draft.primaryColor
    if (draft.background?.overlayOpacity !== theme.background?.overlayOpacity) payload.overlayOpacity = draft.background.overlayOpacity

    if (Object.keys(payload).length === 0) {
      showToast({ title: 'Nothing to save', message: 'No appearance changes were made.' })
      setIsSaving(false)
      return
    }

    const result = await updateOrganizationTheme(payload)
    setIsSaving(false)
    if (!result.success) {
      showToast({ title: 'Save failed', message: result.error, variant: 'error' })
      return
    }
    // Apply instantly across the whole app - no reload required. The uploaded/removed background
    // URL already lives in `draft`, PATCH's response doesn't carry it, so merge rather than fully
    // replace.
    const merged = { ...result.theme, background: { ...result.theme.background, url: draft.background.url } }
    setOptimisticTheme(merged)
    setDraft(merged)
    showToast({ title: 'Appearance saved', message: 'Applied across the CRM immediately.' })
  }

  const handleDiscard = () => {
    setDraft(theme)
    setAssetError('')
  }

  const handleResetToDefault = async () => {
    setIsResetting(true)
    const result = await resetOrganizationTheme()
    setIsResetting(false)
    setIsResetConfirmOpen(false)
    if (!result.success) {
      showToast({ title: 'Reset failed', message: result.error, variant: 'error' })
      return
    }
    setOptimisticTheme(result.theme)
    setDraft(result.theme)
    setAssetError('')
    showToast({ title: 'Appearance reset', message: 'Reverted to the default CRM look for everyone in this organization.' })
    refreshTheme()
  }

  const overlayPercent = Math.round((draft.background?.overlayOpacity ?? DEFAULT_OVERLAY_BY_MODE[draft.mode] ?? 0.3) * 100)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Appearance</h1>
          <p className="mt-1 text-sm text-neutral-500">Applies across the whole CRM for everyone in your organization, immediately after Save.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleDiscard}>
            <RotateCcw className="size-4" />
            Discard Changes
          </Button>
          <Button type="button" loading={isSaving} onClick={handleSave}>
            <Save className="size-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">

      <Card title="Mode">
        <div className="flex flex-wrap gap-2">
          <ToggleChip selected={draft.mode !== 'dark'} onClick={() => selectMode('light')} icon={Sun}>
            Light
          </ToggleChip>
          <ToggleChip selected={draft.mode === 'dark'} onClick={() => selectMode('dark')} icon={Moon}>
            Dark
          </ToggleChip>
        </div>
      </Card>

      <Card title="Background" subtitle="Image mode shows an uploaded photo behind the CRM, with a blurred glass effect on cards, sidebar and header">
        <div className="flex flex-wrap gap-2">
          <ToggleChip selected={!draft.customEnabled} onClick={() => selectBackgroundKind(false)}>
            Plain
          </ToggleChip>
          <ToggleChip selected={Boolean(draft.customEnabled)} onClick={() => selectBackgroundKind(true)}>
            Image
          </ToggleChip>
        </div>

        <div className={`mt-4 flex items-center gap-3 ${!draft.customEnabled ? 'opacity-50' : ''}`}>
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
            {draft.background?.url ? (
              <img src={draft.background.url} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-5 text-neutral-300" aria-hidden="true" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!draft.customEnabled} loading={isUploadingBackground} onClick={() => backgroundInputRef.current?.click()}>
              <Upload className="size-3.5" aria-hidden="true" />
              {draft.background?.url ? 'Replace' : 'Upload'}
            </Button>
            {draft.background?.url && (
              <Button type="button" variant="outline" size="sm" disabled={!draft.customEnabled} loading={isRemovingBackground} onClick={handleRemoveBackground}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            )}
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => { handleUploadBackground(event.target.files?.[0]); event.target.value = '' }}
            />
          </div>
        </div>
        {assetError && <p className="mt-2 text-sm text-red-600">{assetError}</p>}
        <div className={`mt-4 ${!hasBackgroundImage ? 'opacity-50' : ''}`}>
          <p className="text-sm font-medium text-neutral-700">Dimming <span className="font-normal text-neutral-400">({overlayPercent}%)</span></p>
          <input
            type="range"
            min="0"
            max="0.9"
            step="0.05"
            disabled={!hasBackgroundImage}
            value={draft.background?.overlayOpacity ?? DEFAULT_OVERLAY_BY_MODE[draft.mode] ?? 0.3}
            onChange={(event) => updateBackground({ overlayOpacity: Number(event.target.value) })}
            className="mt-1.5 w-full accent-primary-600"
          />
          <div className="mt-1 flex justify-between text-[0.65rem] text-neutral-400">
            <span>0% - image fully visible</span>
            <span>90% - very dark</span>
          </div>
        </div>
      </Card>

      <Card title="Accent Color" subtitle="Buttons, active states, focus rings and links only - surfaces stay controlled by Mode.">
        <ColorField
          label="Primary Color"
          value={draft.primaryColor}
          onChange={(value) => updateDraft({ primaryColor: value })}
          warning={!contrast.meetsAA ? 'This color may be hard to read as button text. Consider a darker or more saturated shade.' : ''}
        />
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setIsResetConfirmOpen(true)}>
          <RotateCcw className="size-4" />
          Reset to Default
        </Button>
      </div>

      </div>

      <div className="xl:sticky xl:top-4">
        <Card title="Live Preview" subtitle="Uses the real theme tokens - updates instantly, not persisted until Save">
          <ThemePreview draft={draft} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              {draft.mode === 'dark' ? <Moon className="size-3" aria-hidden="true" /> : <Sun className="size-3" aria-hidden="true" />}
              {draft.mode === 'dark' ? 'Dark' : 'Light'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              {hasBackgroundImage ? <ImageIcon className="size-3" aria-hidden="true" /> : null}
              {hasBackgroundImage ? 'Image background' : 'Plain background'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: draft.primaryColor || '#063b00' }} aria-hidden="true" />
              {draft.primaryColor || 'Default accent'}
            </span>
          </div>
        </Card>
      </div>

      </div>

      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Reset appearance to default?"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setIsResetConfirmOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" loading={isResetting} onClick={handleResetToDefault}>Reset</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          This removes the custom accent color and background image and reverts every user in your organization to the default light CRM look. This can&apos;t be undone, though you can set it up again afterwards.
        </p>
      </Modal>
    </div>
  )
}
