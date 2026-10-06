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
  DEFAULT_PRIMARY_COLOR,
  resetOrganizationTheme,
  updateOrganizationTheme,
  uploadThemeBackground,
} from '../../api/theme'
import { resolveAccentContrast, resolveThemeTokens } from '../../theme/themeConfig'
import { getFileUrl } from '../../api/files'

const COLOR_PRESETS = [DEFAULT_PRIMARY_COLOR, '#16A34A', '#2563EB', '#DC2626', '#7C3AED', '#EA580C']
const DEFAULT_OVERLAY_BY_MODE = { dark: 0.05, light: 0.05 }

// Single canonical list of the bundled predefined backgrounds - frontend/public assets only, the
// backend has no "predefined theme id" field (see api/theme.js's contract comment). Referenced by
// id everywhere below instead of scattering `/themes/theme1.png`-style literals through JSX.
const PREDEFINED_BACKGROUNDS = [
  { id: 'theme1', name: 'Soft Mint', src: '/themes/theme1.png' },
  { id: 'theme2', name: 'Aqua Flow', src: '/themes/theme2.png' },
  { id: 'theme3', name: 'Grid Paper', src: '/themes/theme3.png' },
  { id: 'theme4', name: 'Lime Collage', src: '/themes/theme4.png' },
]

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Not a fake mockup: `resolveThemeTokens(draft)` is the EXACT same function ThemeProvider calls to
// theme the real app - here it's applied as inline style + data-mode/data-bg attributes on this
// wrapper instead of document.documentElement, so index.css's own [data-mode="dark"]/
// [data-bg="image"] rules cascade to this subtree exactly as they would to the real CRM. Everything
// below then uses the real Tailwind classes (bg-surface, bg-(--sidebar-bg), text-fg, ...) the
// actual Layout/Sidebar/Card use - if the real app's theming is broken, this preview shows it
// broken too, rather than silently looking fine on its own.
//
// `displayBackgroundUrl` is pre-resolved by the caller (resolvePreviewBackgroundUrl below) - it
// may be a saved backend file URL, a bundled public asset path, or a local blob: object URL from
// a staged upload. This component never calls getFileUrl() itself, since doing so would mangle a
// public asset path or a blob: URL (getFileUrl's job is resolving backend file references only).
function ThemePreview({ draft, displayBackgroundUrl }) {
  const tokens = resolveThemeTokens(draft)
  const hasBackground = Boolean(draft.customEnabled && displayBackgroundUrl)
  const overlayOpacity = draft.background?.overlayOpacity ?? DEFAULT_OVERLAY_BY_MODE[draft.mode] ?? 0.05

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
            <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${displayBackgroundUrl})` }} />
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

// Shared selected/unselected chip style for the Mode and Background-type toggles - solid fill + a
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
            // Literal hex, not border/bg-neutral-900: this "selected" chip is always dark with
            // white text, but --color-neutral-900 inverts to a light value in dark mode.
            !value ? 'border-[#111827] bg-[#111827] text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
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
            // A ring + white offset (not just a border) stays visible regardless of the swatch's
            // own color - a dark-neutral border on a dark green swatch barely showed at all.
            className={`size-8 rounded-full ring-2 ring-offset-2 transition-transform disabled:cursor-not-allowed disabled:opacity-50 ${value === color ? 'scale-110 ring-primary-600' : 'ring-transparent'}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <label className={`flex size-8 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary-300'}`}>
          <input type="color" value={value || DEFAULT_PRIMARY_COLOR} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="size-0 opacity-0" />
          <Palette className="pointer-events-none size-3.5" aria-hidden="true" />
        </label>
        <Input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={DEFAULT_PRIMARY_COLOR} className="w-28" />
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

// Fetches a bundled public asset and converts it to a File, only ever called from the Save flow
// (section 6 of the spec) - never at selection time. The backend only accepts an uploaded image
// through POST /organization/theme/background; there is no "predefined id" field to persist.
async function presetToFile(preset) {
  const response = await fetch(preset.src)
  if (!response.ok) throw new Error('Unable to load this preset image.')
  const blob = await response.blob()
  return new File([blob], `${preset.id}.png`, { type: blob.type || 'image/png' })
}

// Where the Live Preview (and the small thumbnails) should draw their image from, given the
// current draft + whatever is staged this session. A staged pick always wins over the saved
// background - that's the whole point of staging. Returns '' when Background Type is Plain.
function resolvePreviewBackgroundUrl(draft, stagedBackground) {
  if (!draft.customEnabled) return ''
  if (stagedBackground?.kind === 'custom') return stagedBackground.previewUrl
  if (stagedBackground?.kind === 'preset') return stagedBackground.src
  return draft.background?.url ? getFileUrl(draft.background.url) : ''
}

export default function ThemeSettings() {
  const { showToast } = useToast()
  const { can } = usePermission()
  const { theme, refreshTheme, setOptimisticTheme } = useTheme()
  const [draft, setDraft] = useState(theme)
  // Exactly one of: null (nothing staged this session - Live Preview falls back to the saved
  // background, if any) | { kind: 'preset', id, name, src } | { kind: 'custom', file, previewUrl }.
  // Never written to the backend until Save Changes - see handleSave.
  const [stagedBackground, setStagedBackground] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
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

  // Revokes the PREVIOUS staged custom file's object URL whenever stagedBackground changes to a
  // new value (including null) or this page unmounts - the one place any blob: URL this page
  // creates ever gets released, so nothing leaks regardless of how staging ends (replaced,
  // removed, discarded, saved, or navigating away mid-edit).
  useEffect(() => {
    return () => {
      if (stagedBackground?.kind === 'custom' && stagedBackground.previewUrl) {
        URL.revokeObjectURL(stagedBackground.previewUrl)
      }
    }
  }, [stagedBackground])

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

  const previewBackgroundUrl = resolvePreviewBackgroundUrl(draft, stagedBackground)
  const hasBackgroundImage = Boolean(draft.customEnabled && previewBackgroundUrl)
  // Image mode is on but there is nothing to show yet - no staged pick, and no previously-saved
  // background either. Must be resolved (pick a preset or upload one) before Save is allowed.
  const needsImageSelection = Boolean(draft.customEnabled) && !previewBackgroundUrl
  const contrast = resolveAccentContrast(draft.primaryColor || DEFAULT_PRIMARY_COLOR)

  const selectMode = (mode) => updateDraft({ mode })

  // "Plain" / "Image" is the Background Type toggle. Switching to Plain drops whatever was
  // staged this session (there's nothing left to preview an image for) but - per the spec - never
  // calls DELETE here; that only happens in handleSave if the final choice is still Plain.
  const selectBackgroundKind = (wantsImage) => {
    setAssetError('')
    updateDraft({ customEnabled: wantsImage })
    if (!wantsImage) setStagedBackground(null)
  }

  // Selecting a predefined card only updates the local draft/preview - no fetch, no upload. The
  // bundled asset is only ever turned into a File at Save time (presetToFile, in handleSave).
  const handleSelectPreset = (preset) => {
    setAssetError('')
    setStagedBackground({ kind: 'preset', id: preset.id, name: preset.name, src: preset.src })
    updateDraft({ customEnabled: true })
  }

  const handleChooseCustomFile = (file) => {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAssetError('Only PNG, JPG/JPEG, or WebP images are supported.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setAssetError('Image must be 5 MB or smaller.')
      return
    }
    setAssetError('')
    setStagedBackground({ kind: 'custom', file, previewUrl: URL.createObjectURL(file) })
    updateDraft({ customEnabled: true })
  }

  // "Remove selection" next to the Custom Background thumbnail - clears whatever is currently
  // selected (a fresh staged pick, or a previously-saved background) and stages Plain. This is
  // the one case section 9 describes as clearing the draft selection; going all the way to Plain
  // (rather than leaving Image mode on with nothing chosen) is what keeps the result unambiguous.
  // No DELETE call happens here - that's handleSave's job, only if Plain is still the choice then.
  const handleRemoveSelection = () => {
    setAssetError('')
    setStagedBackground(null)
    updateDraft({ customEnabled: false })
  }

  const handleSave = async () => {
    if (isSaving) return
    // Belt-and-suspenders: the Save button is already disabled while this is true, but guard
    // here too in case that ever gets bypassed.
    if (needsImageSelection) {
      setAssetError('Please select a predefined background or upload an image.')
      return
    }
    setIsSaving(true)
    setAssetError('')

    const hasStagedNewBackground = Boolean(stagedBackground)
    const isSwitchingToPlain = !draft.customEnabled && theme.customEnabled && Boolean(theme.background?.url)

    try {
      let nextBackgroundUrl = theme.background?.url || ''
      let backgroundTouched = false

      if (hasStagedNewBackground) {
        let file = stagedBackground.file
        if (stagedBackground.kind === 'preset') {
          try {
            file = await presetToFile(stagedBackground)
          } catch {
            setAssetError('Unable to load this preset. Please try another image or upload your own.')
            return
          }
        }
        const uploadResult = await uploadThemeBackground(file)
        if (!uploadResult.success) {
          setAssetError(uploadResult.error)
          return
        }
        nextBackgroundUrl = uploadResult.url
        backgroundTouched = true
      } else if (isSwitchingToPlain) {
        const deleteResult = await deleteThemeBackground()
        if (!deleteResult.success) {
          setAssetError(deleteResult.error)
          return
        }
        nextBackgroundUrl = ''
        backgroundTouched = true
      }

      // Only send what actually changed - the backend's own partial-update contract.
      // background.url is never part of this payload - it's set exclusively by the
      // upload/delete endpoints above, which aren't in PATCH's field list.
      const patchPayload = {}
      if (draft.mode !== theme.mode) patchPayload.mode = draft.mode
      if (draft.primaryColor !== theme.primaryColor) patchPayload.primaryColor = draft.primaryColor
      if (draft.background?.overlayOpacity !== theme.background?.overlayOpacity) patchPayload.overlayOpacity = draft.background.overlayOpacity
      if (draft.customEnabled !== theme.customEnabled) patchPayload.customEnabled = draft.customEnabled

      let patchedTheme = null
      if (Object.keys(patchPayload).length > 0) {
        const patchResult = await updateOrganizationTheme(patchPayload)
        if (!patchResult.success) {
          setAssetError(patchResult.error)
          return
        }
        patchedTheme = patchResult.theme
      }

      if (!backgroundTouched && !patchedTheme) {
        showToast({ title: 'Nothing to save', message: 'No appearance changes were made.' })
        return
      }

      // PATCH's response doesn't carry the background url, so merge rather than fully replace -
      // `nextBackgroundUrl` is known directly from the upload/delete call above, never guessed.
      const base = patchedTheme || theme
      const finalTheme = {
        ...base,
        background: {
          ...base.background,
          url: nextBackgroundUrl,
          overlayOpacity: draft.background?.overlayOpacity ?? base.background?.overlayOpacity,
        },
      }

      setStagedBackground(null)
      setOptimisticTheme(finalTheme)
      setDraft(finalTheme)
      showToast({ title: 'Appearance saved', message: 'Applied across the CRM immediately.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraft(theme)
    setStagedBackground(null)
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
    setStagedBackground(null)
    setOptimisticTheme(result.theme)
    setDraft(result.theme)
    setAssetError('')
    showToast({ title: 'Appearance reset', message: 'Reverted to the default CRM look for everyone in this organization.' })
    refreshTheme()
  }

  const overlayPercent = Math.round((draft.background?.overlayOpacity ?? DEFAULT_OVERLAY_BY_MODE[draft.mode] ?? 0.05) * 100)
  const selectedPresetId = stagedBackground?.kind === 'preset' ? stagedBackground.id : ''
  // The Custom Background thumbnail only ever shows a FRESH staged pick for this session - never
  // an attempt to guess whether the already-saved background happens to have come from an upload,
  // since the backend stores just a file URL with no record of which path it came from.
  const stagedCustomPreviewUrl = stagedBackground?.kind === 'custom' ? stagedBackground.previewUrl : ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Appearance</h1>
          <p className="mt-1 text-sm text-neutral-500">Applies across the whole CRM for everyone in your organization, immediately after Save.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setIsResetConfirmOpen(true)}>
            <RotateCcw className="size-4" />
            Reset to Default
          </Button>
          <Button type="button" variant="outline" onClick={handleDiscard}>
            <RotateCcw className="size-4" />
            Discard Changes
          </Button>
          <Button type="button" loading={isSaving} disabled={needsImageSelection} onClick={handleSave}>
            <Save className="size-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_520px]">
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

      <Card title="Background" subtitle="Image mode shows a photo behind the CRM, with a blurred glass effect on cards, sidebar and header">
        <p className="text-sm font-medium text-neutral-700">Background Type</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ToggleChip selected={!draft.customEnabled} onClick={() => selectBackgroundKind(false)}>
            Plain
          </ToggleChip>
          <ToggleChip selected={Boolean(draft.customEnabled)} onClick={() => selectBackgroundKind(true)}>
            Image
          </ToggleChip>
        </div>
        {needsImageSelection && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            Select a predefined background or upload an image below to continue.
          </p>
        )}

        {draft.customEnabled && (
          <>
            <div className="mt-5 border-t border-neutral-100 pt-5">
              <p className="text-sm font-medium text-neutral-700">Predefined Backgrounds</p>
              <p className="mt-1 text-xs text-neutral-500">Picking one only updates the preview - nothing uploads until Save Changes.</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PREDEFINED_BACKGROUNDS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`group overflow-hidden rounded-xl border-2 text-left transition-all ${selectedPresetId === preset.id ? 'border-primary-600 ring-2 ring-primary-200' : 'border-neutral-200 hover:border-primary-300'}`}
                  >
                    <img src={preset.src} alt="" className="h-20 w-full object-cover transition-transform group-hover:scale-105" />
                    <span className="block truncate px-2.5 py-2 text-xs font-medium text-neutral-700">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-neutral-100 pt-5">
              <p className="text-sm font-medium text-neutral-700">Custom Background</p>
              <p className="mt-1 text-xs text-neutral-500">Upload your own image - staged here too, uploaded only on Save Changes.</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                  {stagedCustomPreviewUrl ? (
                    <img src={stagedCustomPreviewUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-neutral-300" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => backgroundInputRef.current?.click()}>
                    <Upload className="size-3.5" aria-hidden="true" />
                    {stagedCustomPreviewUrl ? 'Replace' : 'Upload'}
                  </Button>
                  {(stagedCustomPreviewUrl || previewBackgroundUrl) && (
                    <Button type="button" variant="outline" size="sm" onClick={handleRemoveSelection}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Remove selection
                    </Button>
                  )}
                  <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => { handleChooseCustomFile(event.target.files?.[0]); event.target.value = '' }}
                  />
                </div>
              </div>
              {assetError && <p className="mt-2 text-sm text-red-600">{assetError}</p>}
            </div>

            <div className="mt-5 border-t border-neutral-100 pt-5">
              <p className="text-sm font-medium text-neutral-700">Dimming <span className="font-normal text-neutral-400">({overlayPercent}%)</span></p>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                disabled={!hasBackgroundImage}
                value={draft.background?.overlayOpacity ?? DEFAULT_OVERLAY_BY_MODE[draft.mode] ?? 0.05}
                onChange={(event) => updateBackground({ overlayOpacity: Number(event.target.value) })}
                className="mt-1.5 w-full accent-primary-600"
              />
              <div className="mt-1 flex justify-between text-[0.65rem] text-neutral-400">
                <span>0% - image fully visible</span>
                <span>90% - very dark</span>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card title="Accent Color" subtitle="Buttons, active states, focus rings and links only - surfaces stay controlled by Mode.">
        <ColorField
          label="Primary Color"
          value={draft.primaryColor}
          onChange={(value) => updateDraft({ primaryColor: value })}
          warning={!contrast.meetsAA ? 'This color may be hard to read as button text. Consider a darker or more saturated shade.' : ''}
        />
      </Card>

      </div>

      <div className="xl:sticky xl:top-4">
        <Card title="Live Preview" subtitle="Uses the real theme tokens - updates instantly, not persisted until Save">
          <ThemePreview draft={draft} displayBackgroundUrl={previewBackgroundUrl} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              {draft.mode === 'dark' ? <Moon className="size-3" aria-hidden="true" /> : <Sun className="size-3" aria-hidden="true" />}
              {draft.mode === 'dark' ? 'Dark' : 'Light'}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${needsImageSelection ? 'bg-amber-50 text-amber-700' : 'bg-primary-50 text-primary-700'}`}>
              {hasBackgroundImage && <ImageIcon className="size-3" aria-hidden="true" />}
              {needsImageSelection ? <AlertTriangle className="size-3" aria-hidden="true" /> : null}
              {hasBackgroundImage ? 'Image background' : needsImageSelection ? 'No image selected' : 'Plain background'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: draft.primaryColor || DEFAULT_PRIMARY_COLOR }} aria-hidden="true" />
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
