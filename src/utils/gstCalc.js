// GST maths for the Create Sales Order / Create Sales Invoice forms.
//
// This mirrors the backend's app/services/gst_calc.py (backend crm_changes25) line for line, so the
// total a form shows is the total the backend saves:
//   * An order-level (bill-level) discount is a discount BEFORE tax. It is split across the lines in
//     proportion to each line's value (after the line's own discount, before tax), rounded to the
//     paisa; the last line takes the remainder so the shares add up to the discount exactly.
//     GST per line = (line value - its share) x the line's GST rate.
//   * Tax-inclusive pricing (product / variant `pricing.tax_inclusive`): the entered price already
//     contains GST. Value before tax = price / (1 + rate/100); GST = price - that value. With no
//     bill discount the customer pays exactly the entered price.
// All amounts are rounded half-up to 2 places.
import { productVariants } from './productVariants'

export function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  // +EPSILON-style nudge so e.g. 1.005 rounds half-up like the backend's Decimal ROUND_HALF_UP.
  const sign = n < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(n) * 100 + 1e-9)) / 100
}

// The canonical flag: the variant's own pricing.tax_inclusive when it has one, else the product's
// pricing.tax_inclusive (the old product-level columns only for a product with no pricing row).
export function productTaxInclusive(product, variantId = '') {
  if (!product) return false
  if (variantId) {
    const variant = productVariants(product).find((entry) => entry.id === variantId)
    if (variant && variant.taxInclusive !== null && variant.taxInclusive !== undefined) return Boolean(variant.taxInclusive)
  }
  if (product.pricing) return Boolean(product.pricing.tax_inclusive)
  return Boolean(product.tax_inclusive || product.tax_inclusive_price)
}

// (value before tax, GST contained in the price) for an amount as entered. `contained` is null
// unless the price was tax-inclusive.
export function preTaxValue(amount, rate, inclusive) {
  const entered = money(amount)
  const r = Number(rate) || 0
  if (!inclusive || r <= 0) return { value: entered, contained: null }
  const value = money(entered / (1 + r / 100))
  return { value, contained: money(entered - value) }
}

// Shares of `discount` per line, proportional to `values`, summing to the discount exactly.
export function splitDiscount(values, discount) {
  const shares = values.map(() => 0)
  const base = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0)
  const total = Math.min(money(discount), base)
  if (total <= 0 || base <= 0) return shares
  const positive = values.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0)
  let given = 0
  positive.slice(0, -1).forEach((i) => {
    shares[i] = money((total * values[i]) / base)
    given += shares[i]
  })
  shares[positive[positive.length - 1]] = money(total - given)
  return shares
}

// lines: [{ value, rate, containedTax? }] where `value` is already before tax and after the line's own
// discount. Returns the per-line result plus totals.
export function taxLines(lines, billDiscount = 0) {
  const values = lines.map((line) => money(line.value))
  const subtotal = money(values.reduce((sum, v) => sum + v, 0))
  const discountAmount = Math.min(money(billDiscount), subtotal)
  const shares = splitDiscount(values, discountAmount)
  const rows = lines.map((line, index) => {
    const value = values[index]
    const share = shares[index]
    const taxable = money(value - share)
    const rate = Number(line.rate) || 0
    // No bill discount on the line and a tax-inclusive price: exactly the GST the price contained.
    const tax = share === 0 && line.containedTax != null ? money(line.containedTax) : money((taxable * rate) / 100)
    return { value, share, taxable, tax }
  })
  const gstAmount = money(rows.reduce((sum, row) => sum + row.tax, 0))
  const taxableAmount = money(rows.reduce((sum, row) => sum + row.taxable, 0))
  return {
    rows,
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    total: money(taxableAmount + gstAmount),
    effectiveGstPercent: taxableAmount > 0 ? (gstAmount / taxableAmount) * 100 : 0,
  }
}
