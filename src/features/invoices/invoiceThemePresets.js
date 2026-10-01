// Theme presets - a configuration-driven catalog of visual variants layered on top of the 4
// backend-valid `template` values (classic/modern/compact/thermal - see
// app/schemas/workflow_settings.py InvoiceTemplate, a strict enum). Each preset names a
// `baseTemplate` (what actually gets persisted via PATCH /invoice-settings) plus style axes the
// renderer branches on (header/table/totals/accent/density) - this is what lets 14 regular +
// 8 thermal presets exist without 22 bespoke components or a backend schema change.
//
// PERSISTENCE: the exact regular preset id (e.g. "gst-3") round-trips via the real
// `template_variant` field (`settings.templateVariant` / api/invoices.js). The exact thermal
// preset id (e.g. "thermal-theme-2") round-trips via `thermal_print.layout` - the backend is
// adding validation for these preset-id strings there (replacing the older 4 plain layout names
// compact/standard/simple/classic). findThermalPreset below accepts either: a real preset id, or
// one of those 4 legacy layout names (what an org saved before this change), which maps to that
// layout's plain/no-variant card - so an older saved value is never fatal.

export const REGULAR_THEME_PRESETS = [
  { id: 'classic', name: 'Classic', baseTemplate: 'classic', header: 'plain', table: 'bordered', totals: 'plain', accent: 'standard', density: 'normal' },
  { id: 'modern', name: 'Modern', baseTemplate: 'modern', header: 'band', table: 'lined', totals: 'boxed', accent: 'bold', density: 'normal' },
  { id: 'compact', name: 'Compact', baseTemplate: 'compact', header: 'plain', table: 'lined', totals: 'plain', accent: 'minimal', density: 'compact' },
  { id: 'tally', name: 'Tally Theme', baseTemplate: 'classic', header: 'plain', table: 'grid', totals: 'grid', accent: 'minimal', density: 'compact' },
  { id: 'landscape-1', name: 'Landscape Theme 1', baseTemplate: 'modern', header: 'split', table: 'wide', totals: 'inline', accent: 'standard', density: 'normal' },
  { id: 'landscape-2', name: 'Landscape Theme 2', baseTemplate: 'modern', header: 'split-alt', table: 'wide', totals: 'boxed', accent: 'standard', density: 'normal' },
  { id: 'gst-1', name: 'GST Theme 1', baseTemplate: 'classic', header: 'plain', table: 'grid', totals: 'grid', accent: 'standard', density: 'normal' },
  { id: 'gst-2', name: 'GST Theme 2', baseTemplate: 'classic', header: 'split', table: 'grid', totals: 'grid', accent: 'standard', density: 'normal' },
  { id: 'gst-3', name: 'GST Theme 3', baseTemplate: 'compact', header: 'band-sm', table: 'lined', totals: 'boxed', accent: 'bold', density: 'compact' },
  { id: 'gst-4', name: 'GST Theme 4', baseTemplate: 'modern', header: 'band', table: 'grid', totals: 'grid', accent: 'bold', density: 'normal' },
  { id: 'gst-5', name: 'GST Theme 5', baseTemplate: 'modern', header: 'banner', table: 'lined', totals: 'banded', accent: 'bold', density: 'normal' },
  { id: 'gst-6', name: 'GST Theme 6', baseTemplate: 'classic', header: 'plain', table: 'grid', totals: 'banded', accent: 'bold', density: 'compact' },
  { id: 'double-divine', name: 'Double Divine', baseTemplate: 'modern', header: 'banner-split', table: 'banded', totals: 'banded', accent: 'bold', density: 'normal' },
  { id: 'french-elite', name: 'French Elite', baseTemplate: 'classic', header: 'plain-spacious', table: 'minimal', totals: 'plain', accent: 'title-only', density: 'spacious' },
]

export const THERMAL_THEME_PRESETS = [
  { id: 'thermal-compact', name: 'Compact', layout: 'compact' },
  { id: 'thermal-advanced', name: 'Advanced', layout: 'standard', showExtras: true },
  { id: 'thermal-simple', name: 'Simple', layout: 'simple' },
  { id: 'thermal-classic', name: 'Classic', layout: 'classic' },
  { id: 'thermal-theme-1', name: 'Theme 1', layout: 'standard', variant: 1 },
  { id: 'thermal-theme-2', name: 'Theme 2', layout: 'compact', variant: 2 },
  { id: 'thermal-theme-3', name: 'Theme 3', layout: 'simple', variant: 3 },
  { id: 'thermal-theme-4', name: 'Theme 4', layout: 'classic', variant: 4 },
]

export function findRegularPreset(id) {
  return REGULAR_THEME_PRESETS.find((preset) => preset.id === id) || REGULAR_THEME_PRESETS[0]
}

// A legacy save only ever had one of these 4 base layout names (no variant/showExtras info) -
// map each to the one preset that represents that layout with nothing extra turned on.
const LEGACY_LAYOUT_TO_PRESET_ID = {
  compact: 'thermal-compact',
  standard: 'thermal-advanced',
  simple: 'thermal-simple',
  classic: 'thermal-classic',
}

export function findThermalPreset(id) {
  const direct = THERMAL_THEME_PRESETS.find((preset) => preset.id === id)
  if (direct) return direct
  const legacyId = LEGACY_LAYOUT_TO_PRESET_ID[id]
  const legacy = legacyId && THERMAL_THEME_PRESETS.find((preset) => preset.id === legacyId)
  return legacy || THERMAL_THEME_PRESETS[0]
}

// The base-layout preset for a given layout name (used by the standalone "Layout" dropdown,
// which only offers the 4 plain looks as a quick-pick shortcut alongside the full Theme carousel).
export function findBaseThermalPresetForLayout(layout) {
  return THERMAL_THEME_PRESETS.find((preset) => preset.layout === layout && !preset.variant) || THERMAL_THEME_PRESETS[0]
}

// mm -> px at 96dpi (the CSS reference pixel), so the on-screen/export thermal receipt is sized
// to the actually-selected paper width ('58mm'/'80mm'/'110mm') instead of one fixed guess -
// shared by the Invoice Settings Live Preview and a real invoice's Print Receipt (Thermal).
export function thermalWidthPx(paperWidth) {
  const mm = parseInt(paperWidth, 10) || 80
  return Math.round(mm * (96 / 25.4))
}

// Preset whose id matches a bare backend `template` value - what a freshly-loaded page (or a
// theme this preset system doesn't recognize) falls back to, since only `template` is real.
export function presetForBaseTemplate(template) {
  return REGULAR_THEME_PRESETS.find((preset) => preset.id === template) || REGULAR_THEME_PRESETS[0]
}

// The preset id to actually render for a persisted (template, template_variant) pair: the exact
// variant if it still names a preset in this catalog, otherwise the plain card matching the base
// template (an unset, null, or since-removed variant is never fatal - see the backend's
// "Invoice Branding, Company Asset Fallback & Template Variant" contract). Shared by
// InvoiceSettings.jsx (which preset card to highlight) and InvoiceDetail.jsx/InvoicePrintView.jsx
// (which preset to actually render for a real invoice) so this logic exists in exactly one place.
export function resolveRegularPresetId(template, templateVariant) {
  if (templateVariant && REGULAR_THEME_PRESETS.some((preset) => preset.id === templateVariant)) {
    return templateVariant
  }
  return presetForBaseTemplate(template).id
}
