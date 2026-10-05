// Centralized theme configuration: color-ramp generation and the runtime application that makes
// a saved org theme take effect. See src/api/theme.js for the API layer and ThemeProvider.jsx for
// how this gets wired in.
//
// The theme has two independent axes now (no more themeName/"Professional"):
//   mode        -> "light" | "dark". Drives `data-mode` on <html>; index.css inverts the entire
//                  neutral color scale plus the semantic surface/text tokens under
//                  `[data-mode="dark"]`, so every shared component that already uses those tokens
//                  (or the raw Tailwind neutral-* scale) goes dark with zero JS-applied overrides.
//   customEnabled + background.url -> whether a background image is active. Drives `data-bg` on
//                  <html> ("image" | "none"); index.css's `[data-bg="image"]` (and the mode-
//                  combined variants) declare the glass surface tokens/blur that let the image
//                  show through the chrome.
// Primary color is an accent only in both modes (buttons, active states, focus rings, sidebar
// active tint) - it never tints the neutral background/surface tokens, which is what data-mode
// alone controls.
export const THEME_MODE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

// ---- Color ramp generation --------------------------------------------------------------
// The app's Button/Badge/etc. already consume Tailwind's own --color-primary-50..950 scale
// directly (bg-primary-600, text-primary-700, bg-primary-50/40, ...) - overriding those CSS
// variables at runtime re-colors accents with zero per-component changes. A single hex can't
// just replace every shade though (50 is used for subtle tinted backgrounds, 700 for readable
// text on white) - this derives a full ramp from one seed color's hue/saturation so contrast
// stays sane regardless of how light/dark the picked color itself is.
const RAMP_LIGHTNESS = { 50: 96, 100: 92, 200: 84, 300: 72, 400: 58, 500: 46, 600: 38, 700: 30, 800: 24, 900: 18, 950: 10 }

function hexToHsl(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Returns { 50: '#...', 100: '#...', ..., 950: '#...' } or null for an invalid/empty hex.
export function generateColorRamp(hex) {
  if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null
  const { h, s } = hexToHsl(hex)
  const ramp = {}
  Object.entries(RAMP_LIGHTNESS).forEach(([shade, lightness]) => {
    ramp[shade] = hslToHex(h, s, lightness)
  })
  // Shades 400-800 (buttons, active states, focus rings - "the accent color" as anyone actually
  // sees it) are pinned to the EXACT picked hex, matching this brand's own default ramp
  // (--color-primary-400..800 are all hand-pinned to the same literal value in index.css, not a
  // generated progression). Forcing them to a fixed 38%-ish lightness instead made the accent
  // color on buttons visibly brighter than the color someone actually picked (e.g. a dark
  // a dark brand color rendered as a much lighter tint). Only the light tints (50-300, hover/badge
  // backgrounds) and dark text shades (900/950) still vary in computed lightness.
  ;['400', '500', '600', '700', '800'].forEach((shade) => { ramp[shade] = hex })
  return ramp
}

const PRIMARY_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

// ---- WCAG contrast (accent button/badge text color) -------------------------------------
// Picks readable text (white or near-black) for a solid accent-colored surface (e.g. a primary
// button), per WCAG 2.x relative luminance / contrast ratio math.
function srgbChannelToLinear(channel) {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b)
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

// Returns { color, ratio, meetsAA } - meetsAA uses the WCAG AA "large text"/UI-component
// threshold (3:1), since accent color is used on buttons/badges, not body text.
export function resolveAccentContrast(accentHex) {
  if (!accentHex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentHex)) {
    return { color: '#ffffff', ratio: null, meetsAA: true }
  }
  const whiteRatio = contrastRatio('#ffffff', accentHex)
  const darkRatio = contrastRatio('#0a0e14', accentHex)
  const useWhite = whiteRatio >= darkRatio
  const ratio = useWhite ? whiteRatio : darkRatio
  return { color: useWhite ? '#ffffff' : '#0a0e14', ratio, meetsAA: ratio >= 3 }
}

const RUNTIME_TOKENS = [
  ...PRIMARY_SHADES.map((shade) => `--color-primary-${shade}`),
  '--color-accent',
  '--color-accent-contrast',
  '--sidebar-active-bg',
]

// Pure resolver: given a normalized theme (src/api/theme.js's shape), returns exactly which CSS
// custom properties should be overridden - as a plain { '--token': 'value' } object, no DOM
// access. A token absent from the result means "no override" (inherits index.css's default). This
// is the SINGLE source of truth both applyThemeToDocument (below, for the real app) and the
// Appearance page's Live Preview use - the preview scopes this same object as inline style on its
// own wrapper div instead of document.documentElement, so it renders with the literal same tokens
// the real CRM would use, not a separate re-implementation.
export function resolveThemeTokens(theme) {
  if (!theme) return {}
  const tokens = {}

  const primaryRamp = generateColorRamp(theme.primaryColor)
  if (primaryRamp) {
    PRIMARY_SHADES.forEach((shade) => { tokens[`--color-primary-${shade}`] = primaryRamp[shade] })
    tokens['--color-accent'] = primaryRamp['600']
    tokens['--color-accent-contrast'] = resolveAccentContrast(primaryRamp['600']).color
    // Sidebar active-nav background: a light TINT of the accent color (ramp shade 200), never
    // the raw accent as a solid block - keeps the same visual weight as the default #adbfff
    // regardless of mode.
    tokens['--sidebar-active-bg'] = primaryRamp['200']
  }

  return tokens
}

// Which `data-mode`/`data-bg` attributes document.documentElement should carry for a given
// normalized theme. This (not JS-applied CSS variables) is what drives dark mode and glass mode -
// index.css's `[data-mode="dark"]`/`[data-bg="image"]` selectors do the actual token inversion.
export function resolveThemeAttributes(theme) {
  return {
    mode: theme?.mode === 'dark' ? 'dark' : 'light',
    bg: theme?.customEnabled && theme?.background?.url ? 'image' : 'none',
  }
}

// Applies a normalized theme to `document.documentElement`: sets data-mode/data-bg attributes
// (index.css reacts to these) and inline-overrides the accent color ramp tokens (inline style
// wins over the stylesheet's @theme-generated :root rule, so this overrides Tailwind's compiled
// primary-* tokens without touching index.css itself). resetThemeDocument() below cleanly reverts
// everything to the exact original look.
export function applyThemeToDocument(theme) {
  const root = document.documentElement
  const { mode, bg } = resolveThemeAttributes(theme)
  root.setAttribute('data-mode', mode)
  root.setAttribute('data-bg', bg)
  const tokens = resolveThemeTokens(theme)
  RUNTIME_TOKENS.forEach((token) => {
    if (tokens[token] !== undefined) root.style.setProperty(token, tokens[token])
    else root.style.removeProperty(token)
  })
}

// Belt-and-suspenders fallback for the glass/background-image surface tokens, applied as an
// inline `style` object directly on Layout.jsx's root wrapper (not just via the
// document.documentElement data-mode/data-bg attributes index.css reacts to). Inline styles set
// directly on an element take precedence over any stylesheet rule regardless of selector
// specificity, and a CSS custom property set this way cascades to every descendant that reads it
// via var(--x) - so this guarantees the glass surfaces render correctly even if, for any reason,
// the attribute-selector mechanism above doesn't end up applying. Mirrors index.css's
// [data-mode="X"][data-bg="image"] blocks value-for-value; returns null (no override) when no
// background image is actually active, so index.css's own defaults are untouched otherwise.
export function resolveGlassSurfaceStyle(theme, hasLoadedBackground) {
  if (!hasLoadedBackground) return null
  const isDark = theme?.mode === 'dark'
  if (isDark) {
    return {
      '--app-bg': 'transparent',
      '--color-surface': 'rgba(10, 25, 47, 0.55)',
      '--color-surface-muted': 'rgba(255, 255, 255, 0.05)',
      '--color-surface-border': 'rgba(255, 255, 255, 0.14)',
      '--color-fg': '#ffffff',
      '--color-fg-muted': 'rgba(255, 255, 255, 0.72)',
      '--row-divider': 'rgba(255, 255, 255, 0.08)',
      '--input-bg': 'rgba(255, 255, 255, 0.06)',
      '--input-border': 'rgba(255, 255, 255, 0.20)',
      '--sidebar-bg': 'rgba(10, 25, 47, 0.55)',
      '--btn-outline-bg': 'transparent',
      '--btn-outline-border': 'rgba(255, 255, 255, 0.35)',
      '--btn-outline-text': '#ffffff',
      '--glass-blur': 'blur(6px) saturate(140%)',
    }
  }
  return {
    '--app-bg': 'transparent',
    '--color-surface': 'rgba(255, 255, 255, 0.05)',
    '--color-surface-muted': 'rgba(255, 255, 255, 0.03)',
    '--color-surface-border': 'rgba(15, 23, 42, 0.16)',
    '--row-divider': 'rgba(15, 23, 42, 0.14)',
    '--input-bg': 'rgba(255, 255, 255, 0.05)',
    '--input-border': 'rgba(15, 23, 42, 0.2)',
    '--sidebar-bg': 'rgba(243, 246, 255, 0.05)',
    '--glass-blur': 'blur(6px) saturate(140%)',
  }
}

// Removes every inline override / attribute this module can set, falling back to the stylesheet's
// own default (Light, no accent override, no background) - byte-for-byte the existing CRM look.
// Called on logout/org switch (multi-tenant safety) or if the theme API fails on load.
export function resetThemeDocument() {
  const root = document.documentElement
  root.setAttribute('data-mode', 'light')
  root.setAttribute('data-bg', 'none')
  RUNTIME_TOKENS.forEach((token) => root.style.removeProperty(token))
}
