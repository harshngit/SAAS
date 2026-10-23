import { getCustomer } from '../../api/customers'
import { getOrder } from '../../api/orders'
import { getProduct } from '../../api/products'
import { productVariants } from '../../utils/productVariants'

// Read-only enrichment: InvoiceOut's CustomerBrief only contains id/name/business_name.
// These existing, permission-scoped GETs supply the same current profile data the PDF uses.
// Never save the enrichment back to an invoice or replace its stored money/date/item values.
export async function loadInvoicePreviewSources(invoice, { includeMrp = false } = {}) {
  const productIds = includeMrp ? [...new Set((invoice.items || []).filter((item) => item.mrp == null && item.productId).map((item) => item.productId))] : []
  const [customerResult, orderResult, ...productResults] = await Promise.all([
    invoice.customerId ? getCustomer(invoice.customerId) : null,
    invoice.orderId && !invoice.orderNumber ? getOrder(invoice.orderId) : null,
    ...productIds.map((id) => getProduct(id)),
  ])
  const warnings = []
  if (customerResult && !customerResult.success) warnings.push('Customer addresses/contact details could not be loaded for the preview.')
  if (orderResult && !orderResult.success) warnings.push('The linked order reference could not be loaded for the preview.')
  if (productResults.some((result) => !result.success)) warnings.push('Current product MRP could not be loaded for every item.')
  const customer = customerResult?.success ? customerResult.customer : null
  const order = orderResult?.success ? orderResult.order : null
  const customerGstin = invoice.customerGstin || customer?.gstNumber || ''
  const products = new Map(productResults.flatMap((result, index) => result.success ? [[productIds[index], result.product]] : []))
  return {
    warnings,
    invoice: {
      ...invoice,
      orderNumber: invoice.orderNumber || order?.orderNumber || '',
      customerPhone: invoice.customerPhone || customer?.phone || '',
      customerEmail: invoice.customerEmail || customer?.email || '',
      customerGstin: ['NA', 'N/A'].includes(customerGstin.trim().toUpperCase()) ? '' : customerGstin,
      billingAddress: invoice.billingAddress || customer?.billingAddress || '',
      shippingAddress: customer ? customer.shippingAddress || customer.deliveryAddress || '' : invoice.shippingAddress || '',
      items: (invoice.items || []).map((item) => {
        const product = products.get(item.productId)
        const variant = product && productVariants(product).find((entry) => entry.id === item.variantId)
        const mrp = item.mrp ?? (variant?.mrp !== '' ? variant?.mrp : null) ?? product?.pricing?.mrp ?? product?.mrp ?? null
        return { ...item, mrp, mrpSource: item.mrp != null ? 'invoice' : mrp != null ? 'current-product' : 'unavailable' }
      }),
    },
  }
}
