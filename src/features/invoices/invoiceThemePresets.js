// Theme presets - a configuration-driven catalog of visual variants layered on top of the 4
// backend-valid `template` values (classic/modern/compact/thermal - see
// app/schemas/workflow_settings.py InvoiceTemplate, a strict enum). Each preset names a
// `baseTemplate` (what actually gets persisted via PATCH /invoice-settings) plus style axes the
// renderer branches on (header/table/totals/accent/density) - this is what lets 14 regular +
// 8 thermal presets exist without 22 bespoke components or a backend schema change.
//
// IMPORTANT PERSISTENCE CAVEAT: only `baseTemplate` round-trips through the backend today. The
// specific preset id (e.g. "gst-3" vs "classic") is NOT a real backend field, so it is kept in
// local React state only - never localStorage, per this project's standing rule against faking
// backend persistence. On reload, the picker falls back to whichever preset's id equals the
// loaded `template` value (the plain Classic/Modern/Compact/Thermal card). See the redesign
// report for the exact backend field this would need to fully persist.

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

export function findThermalPreset(id) {
  return THERMAL_THEME_PRESETS.find((preset) => preset.id === id) || THERMAL_THEME_PRESETS[0]
}

// Preset whose id matches a bare backend `template` value - what a freshly-loaded page (or a
// theme this preset system doesn't recognize) falls back to, since only `template` is real.
export function presetForBaseTemplate(template) {
  return REGULAR_THEME_PRESETS.find((preset) => preset.id === template) || REGULAR_THEME_PRESETS[0]
}
