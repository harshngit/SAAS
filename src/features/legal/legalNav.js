// Single source of truth for the Help & Legal page set - used by LegalPageLayout's own nav,
// the "/legal" index page, and Topbar.jsx's profile dropdown, so all three always list the same
// pages in the same order.
export const LEGAL_PAGES = [
  { path: '/help', label: 'Help & FAQ' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms of Service' },
  { path: '/refund-policy', label: 'Subscription, Cancellation & Refund Policy' },
  { path: '/acceptable-use', label: 'Acceptable Use Policy' },
  { path: '/support', label: 'Contact & Support' },
]
