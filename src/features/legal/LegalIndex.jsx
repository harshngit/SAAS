import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import LegalPageLayout from './LegalPageLayout'
import { LEGAL_PAGES } from './legalNav'

// Only these 3 have an authenticated /admin/settings/* alias (AppRoutes.jsx) - when embedded,
// route to those instead so clicking through from the admin "View All Policies" page keeps the
// user inside the admin layout. Refund Policy / Acceptable Use / Support have no admin alias and
// still open their public page, same as today.
const ADMIN_ALIASES = {
  '/help': '/admin/settings/help',
  '/privacy': '/admin/settings/privacy',
  '/terms': '/admin/settings/terms',
}

export default function LegalIndex({ embedded = false }) {
  return (
    <LegalPageLayout title="Help & Legal" description="Everything about using Beas Suite, plus our policies." embedded={embedded}>
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-100">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.path}
            to={embedded ? (ADMIN_ALIASES[page.path] || page.path) : page.path}
            className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            {page.label}
            <ChevronRight className="size-4 shrink-0 text-neutral-300" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </LegalPageLayout>
  )
}
