import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import LegalPageLayout from './LegalPageLayout'
import { LEGAL_PAGES } from './legalNav'

export default function LegalIndex() {
  return (
    <LegalPageLayout title="Help & Legal" description="Everything about using Beas Suite, plus our policies.">
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-100">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.path}
            to={page.path}
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
