import { getFileUrl } from '../../api/files'

// Single source of truth for resolving an invoice's branding assets (logo, signature, stamp,
// payment QR) between an invoice-specific override and the organization's Company Settings
// default. Mirrors the precedence the backend resolves server-side for a real invoice PDF:
// invoice-specific branding.*_file_id first, then Organization.*_url. Every consumer (Invoice
// Settings Live Preview, Print Preview, Invoice Detail, Invoice Print View) calls this one
// function so the precedence can never drift between screens.
//
// All four assets now go through the same real backend field (branding.logo_file_id /
// signature_file_id / stamp_file_id / payment_qr_file_id) - no more session-only state for
// stamp/QR. On the current backend snapshot only logo_file_id/signature_file_id are live
// (confirmed by reading app/schemas/workflow_settings.py's InvoiceBranding); stamp_file_id/
// payment_qr_file_id are being added there per the backend team, and `settings.branding.
// stampFileId`/`paymentQrFileId` already read/write that shape end to end (api/invoices.js) so
// this starts persisting for real the moment the backend ships it - no further frontend change.
export function resolveInvoiceBranding(companyBranding, invoiceBrandingOverride) {
  const company = companyBranding || {}
  const invoiceOverride = invoiceBrandingOverride || {}

  function resolve(overrideRef, companyUrl) {
    const overrideUrl = overrideRef ? getFileUrl(overrideRef) : ''
    if (overrideUrl) return { url: overrideUrl, source: 'invoice' }
    if (companyUrl) return { url: companyUrl, source: 'company' }
    return { url: '', source: 'none' }
  }

  return {
    logo: resolve(invoiceOverride.logoFileId, company.logoUrl),
    signature: resolve(invoiceOverride.signatureFileId, company.signatureUrl),
    stamp: resolve(invoiceOverride.stampFileId, company.stampSealUrl),
    qr: resolve(invoiceOverride.paymentQrFileId, company.qrCodeUrl),
  }
}
