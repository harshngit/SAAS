import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  LayoutTemplate,
  Maximize2,
  Minus,
  Palette,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  ScrollText,
  Type,
  Upload,
  User,
  Wallet,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'
import { getInvoiceSettings, updateInvoiceSettings } from '../../api/invoices'
import { uploadFile } from '../../api/files'
import { getOrganizationSettings, normalizeOrganizationBranding } from '../../api/organizations'
import { exportElementToPdf } from '../../utils/pdfExport'
import { sampleInvoice, RegularThemePreview, ThermalThemePreview } from './invoiceTemplates'
import { REGULAR_THEME_PRESETS, THERMAL_THEME_PRESETS, presetForBaseTemplate } from './invoiceThemePresets'
import { ITEM_COLUMN_DEFS, MAX_ITEM_COLUMNS, moveColumn, normalizeItemColumns, toggleItemColumn } from './invoiceColumns'
import { resolveInvoiceBranding } from './invoiceBranding'
import { SettingsSection, ToggleRow, ColumnRow } from './InvoiceSettingsSection'

// #063b00 first - the app's own brand color (src/index.css --color-primary-600), the single
// source of truth for "the existing product default accent color" (Part 3 of the theme redesign).
const COLOR_PRESETS = ['#063b00', '#16A34A', '#2563EB', '#DC2626', '#7C3AED', '#EA580C']
const FONT_FAMILY_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times', label: 'Times' },
  { value: 'Courier', label: 'Courier' },
]
// Backend-enforced ranges (app/schemas/workflow_settings.py TypographySettings).
const SIZE_RANGES = { headingSize: [10, 28], bodySize: [7, 16], tableSize: [6, 14] }
const REGULAR_LAYOUT_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'modern', label: 'Modern' },
  { value: 'compact', label: 'Compact' },
]
const PAPER_SIZE_OPTIONS = [{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }]
const ORIENTATION_OPTIONS = [{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]
const THERMAL_LAYOUT_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact', label: 'Compact' },
  { value: 'simple', label: 'Simple' },
  { value: 'classic', label: 'Classic' },
]
const THERMAL_WIDTH_OPTIONS = [
  { value: '58mm', label: '2 inch / 58mm' },
  { value: '80mm', label: '3 inch / 80mm' },
  { value: '110mm', label: '4 inch / 110mm' },
]

const NAV_SECTIONS = [
  { key: 'theme', label: 'Theme', icon: Palette },
  { key: 'business', label: 'Business', icon: Receipt },
  { key: 'invoiceDetails', label: 'Invoice', icon: ScrollText },
  { key: 'party', label: 'Party', icon: User },
  { key: 'items', label: 'Items', icon: LayoutTemplate },
  { key: 'payment', label: 'Payment', icon: Wallet },
  { key: 'typography', label: 'Type', icon: Type },
  { key: 'footer', label: 'Footer', icon: ScrollText },
  { key: 'printing', label: 'Printing', icon: Printer },
]

// Small, subtle "this depends on a backend change" hint - never a warning-style callout
// (no color, no border/background box), just a quiet caption under the relevant controls.
function InfoNote({ children }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[0.7rem] leading-snug text-neutral-400">
      <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

// One compact control reused for Logo, Signature, Stamp and Payment QR (Part 25: no new page, no
// modals - just a small preview + Replace/Use Company action inside the existing sections). Shows
// the resolved asset (invoice-specific override, or the Company Settings default) with a label
// naming its source, mirroring the exact precedence resolveInvoiceBranding computes so the label
// is never misleading. All four assets behave identically now - no "session only" distinction
// (Part 4/11: all four persist through settings.branding.*FileId, see api/invoices.js).
function BrandingAssetControl({ label, assetName, resolved, onReplace, onUseCompany, isUploading, emptyHint }) {
  const hasAsset = Boolean(resolved.url)
  const isOverride = resolved.source === 'invoice'
  const shortName = assetName || label

  return (
    <div className="mb-3">
      <p className="text-sm font-medium text-neutral-700">{label}</p>
      <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-2.5">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {hasAsset ? (
            <img src={resolved.url} alt="" className="size-full object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          ) : (
            <Upload className="size-4 text-neutral-300" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-500">
            {hasAsset
              ? isOverride
                ? 'Custom Invoice Asset'
                : 'Using Company Settings'
              : emptyHint}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer text-xs font-semibold text-primary-700 hover:underline">
              {isUploading ? 'Uploading…' : hasAsset ? 'Replace' : 'Upload for Invoice'}
              <input type="file" accept="image/*" className="hidden" onChange={onReplace} disabled={isUploading} />
            </label>
            {isOverride && (
              <button type="button" onClick={onUseCompany} className="text-xs font-semibold text-neutral-500 hover:underline">
                Use Company {shortName}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// A real, lightweight render of the actual preset (not a generic placeholder rectangle) scaled
// down to thumbnail size - Part 9's "meaningful thumbnail" requirement, satisfied by reusing the
// same renderer the full preview uses rather than a second illustration system.
function ThemeThumbnail({ presetId, primaryColor }) {
  return (
    <div className="aspect-3/4 w-full overflow-hidden rounded-lg border border-neutral-100 bg-white">
      <div className="pointer-events-none h-[400%] w-[400%] origin-top-left scale-[0.25] p-3">
        <RegularThemePreview presetId={presetId} primaryColor={primaryColor} data={sampleInvoice} />
      </div>
    </div>
  )
}

function ThermalThemeThumbnail({ presetId, primaryColor }) {
  return (
    <div className="aspect-3/5 w-full overflow-hidden rounded-lg border border-neutral-100 bg-white">
      <div className="pointer-events-none h-[350%] w-[350%] origin-top-left scale-[0.286] p-2">
        <ThermalThemePreview presetId={presetId} primaryColor={primaryColor} data={sampleInvoice} />
      </div>
    </div>
  )
}

// Compact horizontal carousel - Part 8: keeps the existing card-based picker (no dropdown, no
// modal), just scrollable now that there are up to 14 cards instead of 3. Native overflow-x
// scroll + two arrow buttons that nudge it; the scrollbar is local to this row, never the page.
function ThemeCarousel({ children }) {
  const scrollRef = useRef(null)
  const scrollBy = (delta) => scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })

  return (
    <div className="relative">
      <div ref={scrollRef} className="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth pb-1" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(-220)}
        aria-label="Scroll themes left"
        className="absolute -left-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-(--shadow-xs) hover:bg-neutral-50"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(220)}
        aria-label="Scroll themes right"
        className="absolute -right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-(--shadow-xs) hover:bg-neutral-50"
      >
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

function buildPreviewProps(settings, printMode, regularPresetId, previewData) {
  const template = printMode === 'thermal' ? 'thermal' : settings.template
  return {
    template,
    presetId: regularPresetId,
    primaryColor: settings.branding.primaryColor,
    data: previewData,
    businessDetails: settings.businessDetails,
    invoiceDetails: settings.invoiceDetails,
    partyDetails: settings.partyDetails,
    itemTable: settings.itemTable,
    paymentDetails: settings.paymentDetails,
    footer: settings.footer,
    fields: settings.fields,
    typography: settings.typography,
    thermalLayout: settings.thermalPrint.layout,
  }
}

// Design widths (px) that "100%" zoom means for each document type - not measured from
// anything, just a stand-in for each paper's real proportions relative to each other (A4 wider
// than A5, thermal narrow). "Fit" scales the content to the available panel width using these
// as the base; manual zoom (100%, 110%, ...) is relative to this same base, matching how
// document viewers usually define 100%.
const BASE_WIDTH_PX = { A4: 640, A5: 480, thermal: 280 }
const ZOOM_MIN = 50
const ZOOM_MAX = 160
const ZOOM_STEP = 10

// Scales `children` to fill the available width (Fit) or to an explicit zoom percentage,
// without ever needing a scrollbar: the wrapper's own box is resized to exactly the scaled
// content's footprint (via ResizeObserver measuring the natural, unscaled height), so the
// page grows/shrinks around it instead of clipping or scrolling internally. Width overflow at
// a high manual zoom on a narrow panel is clipped (not scrolled) - the one deliberate tradeoff,
// kept small by ZOOM_MAX, so "no scrollbar" and "no page overflow" both hold in the common case.
//
// This renders the VISUAL on-screen preview only. Export/print use a separate, always-natural-
// size copy (see PreviewPanel) - nesting them here would mean html2canvas/print inherit this
// wrapper's `transform: scale()`, since a transformed ancestor changes how a `position:fixed`
// descendant is positioned and rendered (a real CSS gotcha, not just a style preference).
function ScaledDocument({ baseWidth, mode, manualZoom, onFitScaleChange, children }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [fitScale, setFitScale] = useState(1)
  const [naturalHeight, setNaturalHeight] = useState(0)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return undefined
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) {
        const next = width / baseWidth
        setFitScale(next)
        onFitScaleChange?.(next)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseWidth])

  useEffect(() => {
    const el = innerRef.current
    if (!el) return undefined
    // Mount-only: the native ResizeObserver keeps firing on its own whenever `el`'s rendered
    // size changes (e.g. settings toggles growing/shrinking the invoice content) regardless of
    // this effect's dependencies - re-subscribing on every parent re-render (children is a new
    // element reference each time) would just churn the observer for no benefit.
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height) setNaturalHeight(height)
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scale = mode === 'fit' ? fitScale : manualZoom / 100
  // Only clip once a real measurement exists - before that (first paint, or while `naturalHeight`
  // is still 0), the box stays `overflow: visible` with no explicit height, so there is never a
  // window where a stale/zero height could hide content behind an incorrectly-short box.
  const hasMeasured = naturalHeight > 0

  return (
    <div
      ref={outerRef}
      className={`w-full ${hasMeasured ? 'overflow-hidden' : 'overflow-visible'}`}
      style={{ height: hasMeasured ? naturalHeight * scale : undefined }}
    >
      <div
        ref={innerRef}
        className="bg-white p-5 text-xs text-neutral-600 shadow-(--shadow-xs)"
        style={{ width: baseWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

function PreviewPanel({ settings, printMode, setPrintMode, regularPresetId, thermalPresetId, previewData, exportRef }) {
  const { showToast } = useToast()
  const [zoomMode, setZoomMode] = useState('fit') // 'fit' | 'manual'
  const [manualZoom, setManualZoom] = useState(100)
  const [fitScale, setFitScale] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  // Typed zoom input: `null` when not being edited (the field just displays `displayedZoom`);
  // a string while the user is typing, so a half-typed value (e.g. "1" on the way to "120") never
  // gets clamped/overwritten mid-keystroke - only committed (clamped + applied) on blur/Enter.
  const [zoomDraft, setZoomDraft] = useState(null)
  const previewProps = buildPreviewProps(settings, printMode, regularPresetId, previewData)
  const isThermal = printMode === 'thermal'
  // Rendered via a plain function call below (never `<TemplateComponent .../>`) - assigning an
  // inline arrow function to a variable and using it as a JSX tag would give React a brand-new
  // component identity every render, forcing an unmount/remount of the whole preview each time.
  const renderPreview = (props) => (isThermal
    ? <ThermalThemePreview presetId={thermalPresetId} {...props} />
    : <RegularThemePreview presetId={regularPresetId} {...props} />)
  const baseWidth = isThermal ? BASE_WIDTH_PX.thermal : BASE_WIDTH_PX[settings.regularPrint.paperSize] || BASE_WIDTH_PX.A4
  const displayedZoom = Math.round((zoomMode === 'fit' ? fitScale : manualZoom / 100) * 100)

  const adjustZoom = (delta) => {
    setZoomMode('manual')
    setManualZoom((current) => {
      const base = zoomMode === 'fit' ? Math.round(fitScale * 100) : current
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, base + delta))
    })
  }

  const commitZoomDraft = () => {
    if (zoomDraft === null) return
    const parsed = Number(zoomDraft)
    if (Number.isFinite(parsed) && parsed > 0) {
      setZoomMode('manual')
      setManualZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(parsed))))
    }
    setZoomDraft(null)
  }

  const handleDownloadSample = async () => {
    setIsExporting(true)
    try {
      await exportElementToPdf(exportRef.current, `sample-invoice-${previewProps.template}.pdf`, { widthRem: isThermal ? 13 : 32 })
    } catch (error) {
      showToast({ title: 'Download failed', message: error?.message || 'Unable to export the sample PDF.', variant: 'error' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="sticky top-4 flex flex-col rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-card)">
      {/* Scoped to this page only (unmounts with it) - hides everything else in the app during
          print and lets the invoice content print at its natural size, not the on-screen zoom. */}
      <style>{`
        .invoice-export-root { position: absolute; left: -10000px; top: 0; }
        @media print {
          body * { visibility: hidden; }
          .invoice-export-root, .invoice-export-root * { visibility: visible; }
          .invoice-export-root {
            position: fixed; inset: 0; left: 0; margin: 0; width: auto !important; height: auto !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Live Preview</p>
          <p className="text-xs text-neutral-400">This is how your invoice will look. Updates instantly.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-40"
            triggerClassName="h-8 py-1.5"
            options={[
              { value: 'regular', label: `Invoice (${settings.regularPrint.paperSize})` },
              { value: 'thermal', label: 'Thermal Receipt' },
            ]}
            value={printMode}
            onChange={(event) => setPrintMode(event.target.value)}
          />
          <div className="flex items-center gap-0.5 rounded-lg border border-neutral-200 px-1">
            <button type="button" onClick={() => adjustZoom(-ZOOM_STEP)} aria-label="Zoom out" className="flex size-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100">
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span className="flex w-11 items-center justify-center">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Zoom percentage"
                value={zoomDraft !== null ? zoomDraft : String(displayedZoom)}
                onFocus={(event) => { setZoomDraft(String(displayedZoom)); event.target.select() }}
                onChange={(event) => setZoomDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                onBlur={commitZoomDraft}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') { setZoomDraft(null); event.currentTarget.blur() }
                }}
                className="w-6 bg-transparent text-right text-xs font-medium tabular-nums text-neutral-500 focus:outline-none"
              />
              <span className="text-xs font-medium tabular-nums text-neutral-500">%</span>
            </span>
            <button type="button" onClick={() => adjustZoom(ZOOM_STEP)} aria-label="Zoom in" className="flex size-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100">
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => setZoomMode('fit')} aria-label="Fit to preview width" title="Fit" className="flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100">
            <Maximize2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="bg-neutral-50/60 p-5">
        <ScaledDocument baseWidth={baseWidth} mode={zoomMode} manualZoom={manualZoom} onFitScaleChange={setFitScale}>
          {renderPreview(previewProps)}
        </ScaledDocument>
      </div>

      {/* Always-natural-size, off-screen copy - what "Download Sample PDF" (html2canvas) and
          "Print Preview" (@media print above) actually capture, independent of the on-screen
          zoom level so neither output is ever distorted by it. */}
      <div ref={exportRef} aria-hidden="true" className="invoice-export-root" style={{ width: baseWidth }}>
        <div className="bg-white p-5 text-xs text-neutral-600">
          {renderPreview(previewProps)}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print Preview
        </Button>
        <Button type="button" variant="outline" size="sm" loading={isExporting} onClick={handleDownloadSample}>
          <Download className="size-4" aria-hidden="true" />
          Download Sample PDF
        </Button>
      </div>
    </div>
  )
}

// The card to highlight on load/reset: the persisted `templateVariant` if it names a preset this
// catalog still recognizes, otherwise the plain card matching the persisted `template` value
// (e.g. a variant name the backend hasn't returned yet, or one no longer in the catalog).
function resolveRegularPresetId(settings) {
  if (settings.templateVariant && REGULAR_THEME_PRESETS.some((preset) => preset.id === settings.templateVariant)) {
    return settings.templateVariant
  }
  return presetForBaseTemplate(settings.template).id
}

export default function InvoiceSettings() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const previewExportRef = useRef(null)

  const [settings, setSettings] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [openSection, setOpenSection] = useState('theme')
  const [printMode, setPrintMode] = useState('regular')
  // Company Settings branding (logo/signature/stamp/QR/letterhead) - the DEFAULT source every
  // asset falls back to (see invoiceBranding.js). Loaded independently of invoice settings and
  // never blocks the page: `getOrganizationSettings` failing just means every asset falls back to
  // its empty state below, same as a fresh org with nothing uploaded yet (Part 10).
  const [companyBranding, setCompanyBranding] = useState({})
  const [uploadingAsset, setUploadingAsset] = useState('') // '' | 'logo' | 'signature' | 'stamp' | 'qr'
  // The specific regular-theme preset (e.g. "GST Theme 3") persists via the real
  // `settings.templateVariant` field now (backend's `template_variant`, alongside
  // `baseTemplate`/`template` - see invoiceThemePresets.js and api/invoices.js). `regularPresetId`
  // is still local UI state (it drives which card is highlighted), but it's initialized FROM and
  // kept in sync WITH `settings.templateVariant`, so Save actually persists it - resolveRegularPresetId
  // below is the one place that reconciles the two. Thermal preset selection stays scoped to
  // `thermalPrint.layout` (4 base layouts) as before - the backend's template_variant field, per
  // its own spec, covers the regular theme picker only.
  const [regularPresetId, setRegularPresetId] = useState('classic')
  const [thermalPresetId, setThermalPresetId] = useState('thermal-classic')

  useEffect(() => {
    getInvoiceSettings().then((result) => {
      if (!result.success) {
        setLoadError(result.error)
        setIsLoading(false)
        return
      }
      setSettings(result.settings)
      setDefaults(result.settings)
      setRegularPresetId(resolveRegularPresetId(result.settings))
      const matchingThermal = THERMAL_THEME_PRESETS.find((preset) => preset.layout === result.settings.thermalPrint.layout)
      setThermalPresetId((matchingThermal || THERMAL_THEME_PRESETS[3]).id)
      setIsLoading(false)
    })
    // Independent of the invoice-settings load above (Part 10: "do not block the entire page
    // unnecessarily if company branding fails to load") - a failure here just leaves
    // companyBranding at {}, so every asset control shows its empty state instead of erroring.
    getOrganizationSettings().then((result) => {
      if (result.success) setCompanyBranding(normalizeOrganizationBranding(result.organization))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const orderedColumns = useMemo(() => {
    if (!settings) return []
    const selected = normalizeItemColumns(settings.itemTable.columns)
    const rest = ITEM_COLUMN_DEFS.map((def) => def.key).filter((key) => !selected.includes(key))
    return [...selected, ...rest].map((key) => {
      const def = ITEM_COLUMN_DEFS.find((d) => d.key === key)
      return { key, label: def.label, core: def.core, selected: selected.includes(key) }
    })
  }, [settings])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-10 shadow-(--shadow-card)">
        <LoadingSpinner label="Loading invoice settings..." />
      </div>
    )
  }

  if (loadError || !settings) {
    return (
      <div className="rounded-2xl border border-neutral-100 bg-white p-10 text-center shadow-(--shadow-card)">
        <p className="text-sm text-red-600">{loadError || 'Unable to load invoice settings.'}</p>
      </div>
    )
  }

  // One resolver, reused by the Live Preview here AND by InvoiceDetail.jsx/InvoicePrintView.jsx
  // for a real invoice (Part 8/20) - see invoiceBranding.js.
  const resolvedBranding = resolveInvoiceBranding(companyBranding, settings.branding)
  // Part 7: the preview must combine sample invoice/company data with REAL branding assets, never
  // let sampleInvoice's (branding-less) company object permanently control what's shown. Only the
  // asset URLs are swapped in - name/address/GSTIN/etc. stay the existing sample data.
  const previewData = {
    ...sampleInvoice,
    company: {
      ...sampleInvoice.company,
      logoUrl: resolvedBranding.logo.url,
      signatureUrl: resolvedBranding.signature.url,
      stampSealUrl: resolvedBranding.stamp.url,
      qrCodeUrl: resolvedBranding.qr.url,
    },
  }

  const toggleSection = (key) => setOpenSection((current) => (current === key ? '' : key))
  const setTop = (key, value) => setSettings((current) => ({ ...current, [key]: value }))
  const setBranding = (key, value) => setSettings((current) => ({ ...current, branding: { ...current.branding, [key]: value } }))
  const setBlock = (block) => (key, value) => setSettings((current) => ({ ...current, [block]: { ...current[block], [key]: value } }))
  const setFieldFlag = (key, value) => setSettings((current) => ({ ...current, fields: { ...current.fields, [key]: value } }))

  const setBusiness = setBlock('businessDetails')
  const setInvoiceDetails = setBlock('invoiceDetails')
  const setParty = setBlock('partyDetails')
  const setItemTable = setBlock('itemTable')
  const setPayment = setBlock('paymentDetails')
  const setFooter = setBlock('footer')
  const setTypography = setBlock('typography')
  const setRegularPrint = setBlock('regularPrint')
  const setThermalPrint = setBlock('thermalPrint')

  // Picking a preset never touches business/invoice/party/item-table/payment/footer settings
  // (Part 11) - only `template` + `templateVariant` (the exact preset id, now a real persisted
  // field - see api/invoices.js) change for a regular preset; thermal stays scoped to
  // `thermalPrint.layout`.
  const handleSelectRegularPreset = (preset) => {
    setRegularPresetId(preset.id)
    setTop('template', preset.baseTemplate)
    setTop('templateVariant', preset.id)
  }
  const handleSelectThermalPreset = (preset) => {
    setThermalPresetId(preset.id)
    setThermalPrint('layout', preset.layout)
  }

  const selectedColumnCount = normalizeItemColumns(settings.itemTable.columns).length
  const atMaxColumns = selectedColumnCount >= MAX_ITEM_COLUMNS

  const handleToggleColumn = (key) => {
    const next = toggleItemColumn(settings.itemTable.columns, key)
    setItemTable('columns', next)
    if (key === 'product_image') setItemTable('showProductImage', next.includes('product_image'))
  }
  const handleMoveColumn = (index, direction) => setItemTable('columns', moveColumn(settings.itemTable.columns, index, direction))

  // Shared upload step for all 4 branding assets - one upload call (existing infrastructure,
  // Part 28), then the caller stores the result in the matching real settings field
  // (branding.logoFileId/signatureFileId/stampFileId/paymentQrFileId - all four now the same
  // shape, api/invoices.js). Uploading here never touches Company Settings (Part 13) -
  // uploadFile() only stores the file and hands back a URL/id, it does not write to the
  // organization record.
  async function uploadBrandingAsset(file, assetKey) {
    setUploadingAsset(assetKey)
    const result = await uploadFile(file)
    setUploadingAsset('')
    if (!result.success) {
      showToast({ title: 'Upload failed', message: result.error, variant: 'error' })
      return null
    }
    return result.file
  }

  function handleAssetFileChange(assetKey, onUploaded) {
    return async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      const uploaded = await uploadBrandingAsset(file, assetKey)
      if (uploaded) onUploaded(uploaded)
    }
  }

  const handleReplaceLogo = handleAssetFileChange('logo', (file) => setBranding('logoFileId', file.path || file.file_id))
  const handleUseCompanyLogo = () => setBranding('logoFileId', '')

  const handleReplaceSignature = handleAssetFileChange('signature', (file) => setBranding('signatureFileId', file.path || file.file_id))
  const handleUseCompanySignature = () => setBranding('signatureFileId', '')

  const handleReplaceStamp = handleAssetFileChange('stamp', (file) => setBranding('stampFileId', file.path || file.file_id))
  const handleUseCompanyStamp = () => setBranding('stampFileId', '')

  const handleReplaceQr = handleAssetFileChange('qr', (file) => setBranding('paymentQrFileId', file.path || file.file_id))
  const handleUseCompanyQr = () => setBranding('paymentQrFileId', '')

  const handleReset = () => {
    if (!defaults) return
    setSettings(defaults)
    setRegularPresetId(resolveRegularPresetId(defaults))
    const matchingThermal = THERMAL_THEME_PRESETS.find((preset) => preset.layout === defaults.thermalPrint.layout)
    setThermalPresetId((matchingThermal || THERMAL_THEME_PRESETS[3]).id)
    // Part 24: Reset to Default also clears every invoice-specific branding override (logo,
    // signature, stamp, QR alike - all four now live in `defaults.branding`) - every asset falls
    // back to Company Settings, nothing in Company Settings itself is touched.
  }

  const handleSave = async () => {
    setIsSaving(true)
    const result = await updateInvoiceSettings(settings)
    setIsSaving(false)
    if (!result.success) {
      showToast({ title: 'Save failed', message: result.error, variant: 'error' })
      return
    }
    setSettings(result.settings)
    setDefaults(result.settings)
    showToast({ title: 'Settings saved', message: 'Invoice appearance and print settings updated.' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/invoices')}
            aria-label="Back to invoices"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Invoice Settings</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Customize your invoice appearance, print format and content. Changes reflect in the preview instantly.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Reset to Default
          </Button>
          <Button type="button" loading={isSaving} onClick={handleSave}>
            <Save className="size-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[auto_minmax(0,1.05fr)_minmax(0,1.3fr)]">
        {/* Quick-nav: jumps to a section below, mirrors the reference layout's icon list. */}
        <nav className="hidden xl:flex xl:w-20 xl:flex-col xl:gap-1 xl:sticky xl:top-4 xl:self-start">
          {NAV_SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpenSection(key)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 text-center text-[0.65rem] font-medium transition-colors ${
                openSection === key ? 'bg-primary-50 text-primary-700' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl border border-neutral-100 bg-white px-4 shadow-(--shadow-card)">
          <SettingsSection title="1. Template & Theme" description="Layout and accent color" isOpen={openSection === 'theme'} onToggle={() => toggleSection('theme')}>
            <ThemeCarousel>
              {REGULAR_THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectRegularPreset(preset)}
                  className={`w-24 shrink-0 rounded-xl border-2 p-1.5 text-center transition-colors ${
                    regularPresetId === preset.id ? 'border-primary-500 bg-primary-50/40' : 'border-neutral-100 hover:border-neutral-200'
                  }`}
                >
                  <ThemeThumbnail presetId={preset.id} primaryColor={settings.branding.primaryColor} />
                  <p className="mt-1.5 truncate text-[0.65rem] font-medium text-neutral-700">{preset.name}</p>
                </button>
              ))}
            </ThemeCarousel>
            <div className="mt-5">
              <p className="text-sm font-medium text-neutral-700">Theme Color</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    onClick={() => setBranding('primaryColor', color)}
                    className={`size-8 rounded-full border-2 transition-transform ${settings.branding.primaryColor === color ? 'scale-110 border-neutral-900' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300">
                  <input type="color" value={settings.branding.primaryColor} onChange={(event) => setBranding('primaryColor', event.target.value)} className="size-0 opacity-0" />
                  <Palette className="pointer-events-none size-3.5" aria-hidden="true" />
                </label>
                <span className="text-xs text-neutral-400">{settings.branding.primaryColor}</span>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="2. Business Details" description="Your company information" isOpen={openSection === 'business'} onToggle={() => toggleSection('business')}>
            <BrandingAssetControl
              label="Company Logo"
              assetName="Logo"
              resolved={resolvedBranding.logo}
              onReplace={handleReplaceLogo}
              onUseCompany={handleUseCompanyLogo}
              isUploading={uploadingAsset === 'logo'}
              emptyHint="No company logo configured"
            />
            <ToggleRow label="Business Name" checked={settings.businessDetails.showBusinessName} onChange={(v) => setBusiness('showBusinessName', v)} />
            <ToggleRow label="Logo" checked={settings.businessDetails.showLogo} onChange={(v) => setBusiness('showLogo', v)} />
            <ToggleRow label="Address" checked={settings.businessDetails.showAddress} onChange={(v) => setBusiness('showAddress', v)} />
            <ToggleRow label="Phone" checked={settings.businessDetails.showPhone} onChange={(v) => setBusiness('showPhone', v)} />
            <ToggleRow label="Email" checked={settings.businessDetails.showEmail} onChange={(v) => setBusiness('showEmail', v)} />
            <ToggleRow label="GSTIN" checked={settings.businessDetails.showGstin} onChange={(v) => setBusiness('showGstin', v)} />
            <ToggleRow label="PAN" checked={settings.businessDetails.showPan} onChange={(v) => setBusiness('showPan', v)} />
          </SettingsSection>

          <SettingsSection title="3. Invoice Details" description="Invoice number, dates and reference fields" isOpen={openSection === 'invoiceDetails'} onToggle={() => toggleSection('invoiceDetails')}>
            <ToggleRow label="Invoice Number" checked={settings.invoiceDetails.showInvoiceNumber} onChange={(v) => setInvoiceDetails('showInvoiceNumber', v)} />
            <ToggleRow label="Invoice Date" checked={settings.invoiceDetails.showInvoiceDate} onChange={(v) => setInvoiceDetails('showInvoiceDate', v)} />
            <ToggleRow label="Due Date" checked={settings.invoiceDetails.showDueDate} onChange={(v) => setInvoiceDetails('showDueDate', v)} />
            <ToggleRow label="Order Reference" checked={settings.invoiceDetails.showOrderReference} onChange={(v) => setInvoiceDetails('showOrderReference', v)} />
            <ToggleRow label="PO Number" checked={settings.invoiceDetails.showPoNumber} onChange={(v) => setInvoiceDetails('showPoNumber', v)} />
            <ToggleRow label="E-Way Bill Number" checked={settings.invoiceDetails.showEwayBillNumber} onChange={(v) => setInvoiceDetails('showEwayBillNumber', v)} />
            <ToggleRow label="Vehicle Number" checked={settings.invoiceDetails.showVehicleNumber} onChange={(v) => setInvoiceDetails('showVehicleNumber', v)} />
            <InfoNote>PO / E-Way Bill / Vehicle Number are saved here, but today's invoice records don't carry that data yet — turning these on won't show anything until that's added on the backend.</InfoNote>
          </SettingsSection>

          <SettingsSection title="4. Party Details" description="Customer and shipping information" isOpen={openSection === 'party'} onToggle={() => toggleSection('party')}>
            <ToggleRow label="Customer Name" checked={settings.partyDetails.showCustomerName} onChange={(v) => setParty('showCustomerName', v)} />
            <ToggleRow label="Customer Phone" checked={settings.partyDetails.showCustomerPhone} onChange={(v) => setParty('showCustomerPhone', v)} />
            <ToggleRow label="Customer GSTIN" checked={settings.partyDetails.showCustomerGstin} onChange={(v) => setParty('showCustomerGstin', v)} />
            <ToggleRow label="Billing Address" checked={settings.partyDetails.showBillingAddress} onChange={(v) => setParty('showBillingAddress', v)} />
            <ToggleRow label="Shipping Address" checked={settings.partyDetails.showShippingAddress} onChange={(v) => setParty('showShippingAddress', v)} />
          </SettingsSection>

          <SettingsSection
            title="5. Item Table"
            description="Choose up to 5 columns for the item table"
            isOpen={openSection === 'items'}
            onToggle={() => toggleSection('items')}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-neutral-500">The # (serial number) column is always shown and doesn't count toward the limit.</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${atMaxColumns ? 'bg-primary-50 text-primary-700' : 'bg-neutral-100 text-neutral-600'}`}>
                {selectedColumnCount} / {MAX_ITEM_COLUMNS} columns selected
              </span>
            </div>
            <div className="space-y-1">
              {orderedColumns.map((column, index) => (
                <ColumnRow
                  key={column.key}
                  column={column}
                  index={index}
                  total={selectedColumnCount}
                  onToggle={handleToggleColumn}
                  onMove={handleMoveColumn}
                  atCap={atMaxColumns}
                />
              ))}
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <ToggleRow label="Show Discount in Totals" checked={Boolean(settings.fields.show_discount)} onChange={(v) => setFieldFlag('show_discount', v)} />
              <ToggleRow label="Show Tax in Totals" checked={Boolean(settings.fields.show_tax_amount)} onChange={(v) => setFieldFlag('show_tax_amount', v)} />
            </div>
          </SettingsSection>

          <SettingsSection title="6. Payment Details" description="Bank details and UPI/QR code" isOpen={openSection === 'payment'} onToggle={() => toggleSection('payment')}>
            <ToggleRow label="Bank Details" checked={settings.paymentDetails.showBankDetails} onChange={(v) => setPayment('showBankDetails', v)} />
            <ToggleRow label="UPI / QR Code" checked={settings.paymentDetails.showUpiQr} onChange={(v) => setPayment('showUpiQr', v)} />
            {settings.paymentDetails.showUpiQr && (
              <BrandingAssetControl
                label="Payment QR"
                assetName="QR"
                resolved={resolvedBranding.qr}
                onReplace={handleReplaceQr}
                onUseCompany={handleUseCompanyQr}
                isUploading={uploadingAsset === 'qr'}
                emptyHint="No payment QR configured"
              />
            )}
          </SettingsSection>

          <SettingsSection title="7. Typography" description="Font family and text sizes" isOpen={openSection === 'typography'} onToggle={() => toggleSection('typography')}>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
              Font Family
              <Select options={FONT_FAMILY_OPTIONS} value={settings.typography.fontFamily} onChange={(event) => setTypography('fontFamily', event.target.value)} />
            </label>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { key: 'headingSize', label: 'Heading Size' },
                { key: 'bodySize', label: 'Body Size' },
                { key: 'tableSize', label: 'Table Size' },
              ].map(({ key, label }) => (
                <label key={key} className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                  {label} <span className="font-normal text-neutral-400">({settings.typography[key]}pt)</span>
                  <input
                    type="range"
                    min={SIZE_RANGES[key][0]}
                    max={SIZE_RANGES[key][1]}
                    value={settings.typography[key]}
                    onChange={(event) => setTypography(key, Number(event.target.value))}
                    className="accent-primary-600"
                  />
                </label>
              ))}
            </div>
            <InfoNote>Font Family applies to the generated PDF today. Heading/Body/Table size are saved but not yet applied by the PDF engine.</InfoNote>
          </SettingsSection>

          <SettingsSection title="8. Footer" description="Notes, terms and signature" isOpen={openSection === 'footer'} onToggle={() => toggleSection('footer')}>
            <ToggleRow label="Show Terms & Conditions" checked={settings.footer.showTerms} onChange={(v) => setFooter('showTerms', v)} />
            <ToggleRow label="Show Signature" checked={settings.footer.showSignature} onChange={(v) => setFooter('showSignature', v)} />
            {settings.footer.showSignature && (
              <BrandingAssetControl
                label="Signature"
                resolved={resolvedBranding.signature}
                onReplace={handleReplaceSignature}
                onUseCompany={handleUseCompanySignature}
                isUploading={uploadingAsset === 'signature'}
                emptyHint="No company signature configured"
              />
            )}
            <ToggleRow label="Show Company Stamp" checked={settings.footer.showStamp} onChange={(v) => setFooter('showStamp', v)} />
            {settings.footer.showStamp && (
              <BrandingAssetControl
                label="Company Stamp"
                assetName="Stamp"
                resolved={resolvedBranding.stamp}
                onReplace={handleReplaceStamp}
                onUseCompany={handleUseCompanyStamp}
                isUploading={uploadingAsset === 'stamp'}
                emptyHint="No company stamp configured"
              />
            )}
            <div className="mt-3">
              <p className="text-sm font-medium text-neutral-700">Footer Text</p>
              <textarea
                value={settings.footer.footerText}
                maxLength={500}
                onChange={(event) => setFooter('footerText', event.target.value)}
                className="mt-1.5 h-16 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <div className="mt-3">
              <p className="text-sm font-medium text-neutral-700">Terms & Conditions</p>
              <textarea
                value={settings.footer.terms}
                maxLength={2000}
                onChange={(event) => setFooter('terms', event.target.value)}
                className="mt-1.5 h-24 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
          </SettingsSection>

          <SettingsSection title="9. Printing" description="Regular and thermal print configuration" isOpen={openSection === 'printing'} onToggle={() => toggleSection('printing')}>
            <Tabs value={printMode} onValueChange={setPrintMode}>
              <TabsList>
                <TabsTrigger value="regular">Regular Printer</TabsTrigger>
                <TabsTrigger value="thermal">Thermal Printer</TabsTrigger>
              </TabsList>
              <TabsContent value="regular" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Layout
                    <Select options={REGULAR_LAYOUT_OPTIONS} value={settings.regularPrint.layout} onChange={(event) => setRegularPrint('layout', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Paper Size
                    <Select options={PAPER_SIZE_OPTIONS} value={settings.regularPrint.paperSize} onChange={(event) => setRegularPrint('paperSize', event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Orientation
                    <Select options={ORIENTATION_OPTIONS} value={settings.regularPrint.orientation} onChange={(event) => setRegularPrint('orientation', event.target.value)} />
                  </label>
                </div>
              </TabsContent>
              <TabsContent value="thermal" className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-neutral-700">Thermal Theme</p>
                  <div className="mt-2">
                    <ThemeCarousel>
                      {THERMAL_THEME_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectThermalPreset(preset)}
                          className={`w-20 shrink-0 rounded-xl border-2 p-1.5 text-center transition-colors ${
                            thermalPresetId === preset.id ? 'border-primary-500 bg-primary-50/40' : 'border-neutral-100 hover:border-neutral-200'
                          }`}
                        >
                          <ThermalThemeThumbnail presetId={preset.id} primaryColor={settings.branding.primaryColor} />
                          <p className="mt-1.5 truncate text-[0.65rem] font-medium text-neutral-700">{preset.name}</p>
                        </button>
                      ))}
                    </ThemeCarousel>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Layout
                    <Select
                      options={THERMAL_LAYOUT_OPTIONS}
                      value={settings.thermalPrint.layout}
                      onChange={(event) => {
                        setThermalPrint('layout', event.target.value)
                        const matching = THERMAL_THEME_PRESETS.find((preset) => preset.layout === event.target.value)
                        if (matching) setThermalPresetId(matching.id)
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Paper Width
                    <Select options={THERMAL_WIDTH_OPTIONS} value={settings.thermalPrint.paperWidth} onChange={(event) => setThermalPrint('paperWidth', event.target.value)} />
                  </label>
                </div>
                <ToggleRow label="Use Text Styling / Bold" checked={settings.thermalPrint.boldText} onChange={(v) => setThermalPrint('boldText', v)} />
                <ToggleRow label="Auto Cut Paper" checked={settings.thermalPrint.autoCut} onChange={(v) => setThermalPrint('autoCut', v)} />
                <ToggleRow label="Open Cash Drawer" checked={settings.thermalPrint.openCashDrawer} onChange={(v) => setThermalPrint('openCashDrawer', v)} />
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Extra Lines at End
                    <input
                      type="number" min={0} max={20}
                      value={settings.thermalPrint.extraLines}
                      onChange={(event) => setThermalPrint('extraLines', Math.max(0, Math.min(20, Number(event.target.value) || 0)))}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-700">
                    Number of Copies
                    <input
                      type="number" min={1} max={10}
                      value={settings.thermalPrint.copies}
                      onChange={(event) => setThermalPrint('copies', Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                    />
                  </label>
                </div>
              </TabsContent>
            </Tabs>
            <InfoNote>Paper size, orientation and paper width apply to the generated PDF today. Layout, bold styling, auto-cut, cash drawer and copies are saved but not yet used by the PDF/print engine.</InfoNote>
          </SettingsSection>
        </div>

        <PreviewPanel
          settings={settings}
          printMode={printMode}
          setPrintMode={setPrintMode}
          regularPresetId={regularPresetId}
          thermalPresetId={thermalPresetId}
          previewData={previewData}
          exportRef={previewExportRef}
        />
      </div>
    </div>
  )
}
