// Item-table column config - kept in exact lockstep with the backend's real, ground-truth values
// (app/core/workflow.py ALLOWED_ITEM_COLUMNS, app/core/pdf_docs.py COLUMN_WEIGHTS/HEADERS/ALIGNS),
// inspected directly in the backend repo. One list, used by the settings UI (which columns are
// selected/ordered) AND the preview renderer (weighted column widths, so the preview always
// matches how the real PDF lays the same columns out - never a plain scrollable HTML table).
//
// `product` and `amount` are backend-mandatory (ItemTableSettings.validate_columns rejects a
// `columns` list without either) - never removable here either.
export const CORE_COLUMN_KEYS = ['product', 'amount']

// No column cap: the backend (crm_changes, 18 Nov) removed the old 5-column limit - PATCH
// /invoice-settings accepts any number of the keys below (product + amount required, no duplicates).
// Only the SIMPLE copy and the thermal receipt still print at most 5 columns - see
// resolveActiveColumns({ simple }) and SIMPLE_MAX_COLUMNS.
export const SIMPLE_MAX_COLUMNS = 5

// Per-line GST columns belong on the detailed tax invoice only; the simple copy shows GST once, in
// its totals (mirrors GST_COLUMNS in the backend's app/core/invoice_regular_pdf.py).
export const GST_COLUMN_KEYS = ['taxable_value', 'tax_rate', 'tax_amount']

export const ITEM_COLUMN_DEFS = [
  { key: 'product', label: 'Product', core: true, weight: 42, align: 'left' },
  { key: 'description', label: 'Description', core: false, weight: 30, align: 'left' },
  { key: 'product_image', label: 'Product Image', core: false, weight: 16, align: 'center' },
  { key: 'hsn_sac', label: 'HSN/SAC', core: false, weight: 18, align: 'center' },
  { key: 'quantity', label: 'Quantity', core: false, weight: 14, align: 'right' },
  { key: 'uom', label: 'UOM', core: false, weight: 12, align: 'center' },
  { key: 'rate', label: 'Rate', core: false, weight: 20, align: 'right' },
  { key: 'mrp', label: 'MRP', core: false, weight: 18, align: 'right' },
  { key: 'discount', label: 'Discount', core: false, weight: 16, align: 'right' },
  { key: 'taxable_value', label: 'Taxable Value', core: false, weight: 20, align: 'right' },
  { key: 'tax_rate', label: 'GST %', core: false, weight: 14, align: 'right' },
  { key: 'tax_amount', label: 'GST Amount', core: false, weight: 18, align: 'right' },
  { key: 'batch_number', label: 'Batch Number', core: false, weight: 16, align: 'center' },
  { key: 'expiry_date', label: 'Expiry Date', core: false, weight: 18, align: 'center' },
  // line_total: the line's value BEFORE tax (also for tax-inclusive products, whose unit_price is the price as entered).
  { key: 'amount', label: 'Amount (before tax)', core: true, weight: 24, align: 'right' },
]

const COLUMN_BY_KEY = Object.fromEntries(ITEM_COLUMN_DEFS.map((col) => [col.key, col]))
export const ITEM_COLUMN_KEYS = ITEM_COLUMN_DEFS.map((col) => col.key)

export const DEFAULT_ITEM_TABLE_COLUMNS = ['product', 'hsn_sac', 'quantity', 'rate', 'amount']

function isCore(key) {
  return CORE_COLUMN_KEYS.includes(key)
}

// A raw `columns` array (snake_case keys, from the backend) -> the ordered list the settings UI
// and preview both render from. Drops unknown keys defensively; guarantees product/amount exist.
export function normalizeItemColumns(columns) {
  const list = Array.isArray(columns) && columns.length > 0 ? columns : DEFAULT_ITEM_TABLE_COLUMNS
  const seen = new Set()
  const ordered = []

  list.forEach((key) => {
    if (!COLUMN_BY_KEY[key] || seen.has(key)) return
    seen.add(key)
    ordered.push(key)
  })

  CORE_COLUMN_KEYS.forEach((key) => {
    if (!seen.has(key)) ordered.push(key)
  })

  return ordered
}

export function moveColumn(columns, index, direction) {
  const list = normalizeItemColumns(columns)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= list.length) return list
  const next = [...list]
  ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
  return next
}

// Adds/removes a column: core columns are never removable. There is no upper limit any more.
export function toggleItemColumn(columns, key) {
  const list = normalizeItemColumns(columns)
  if (isCore(key)) return list
  if (list.includes(key)) return list.filter((col) => col !== key)
  return [...list, key]
}

// The ordered {key, label, weight, align} list the preview/PDF actually render - "product_image"
// only appears when showProductImage is also on, exactly matching the backend's own dual gate
// (app/core/pdf_docs.py invoice_detailed_pdf: `if c == "product_image" and not show_images: continue`).
//
// `simple` (the short customer copy) mirrors the backend's _columns(simple=True): the per-line GST columns
// are dropped and at most SIMPLE_MAX_COLUMNS are kept - extra columns are dropped from the END, product and
// amount are always kept.
export function resolveActiveColumns(columns, { showProductImage = false, simple = false } = {}) {
  let keys = normalizeItemColumns(columns).filter((key) => key !== 'product_image' || showProductImage)
  if (simple) {
    keys = keys.filter((key) => !GST_COLUMN_KEYS.includes(key))
    while (keys.length > SIMPLE_MAX_COLUMNS) {
      let dropIndex = -1
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        if (!isCore(keys[i])) { dropIndex = i; break }
      }
      if (dropIndex < 0) break
      keys.splice(dropIndex, 1)
    }
  }
  return keys.map((key) => COLUMN_BY_KEY[key])
}
