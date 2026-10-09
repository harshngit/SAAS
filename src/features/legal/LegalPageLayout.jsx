import { Link } from 'react-router-dom'
import { ArrowLeft, Droplet } from 'lucide-react'
import Card from '../../components/ui/Card'
import { LEGAL_PAGES } from './legalNav'

// Shared chrome for every Help/Legal page (Help & FAQ, Privacy, Terms, Refund Policy,
// Acceptable Use, Support, and the "/legal" index). These are PUBLIC routes - reachable from
// the pre-auth Login/Register footer as well as the authenticated profile dropdown - so this
// renders its own minimal header instead of the authenticated Sidebar/Topbar (Layout.jsx).
//
// The main content card uses the always-solid bg-(--modal-bg) token (same one Modal.jsx/
// Select.jsx use), not the plain theme-reactive Card component - Card auto-applies the
// .theme-glass blur whenever Image background mode is on, which is exactly the heavy-glass-on-
// long-text problem these pages must avoid.
//
// `embedded`: used only by the /admin/settings/* aliases (AppRoutes.jsx), which render these
// SAME content components inside the authenticated Sidebar/Topbar shell instead of this
// page's own standalone logo-header/Back-link/cross-nav-footer chrome - that chrome would
// otherwise double up with the admin layout and its footer nav would route the user back out
// to the public pages. Renders just the title/description/content, same ui/Card others admin
// pages use, no duplicated legal text - same component, same props, one extra flag.
export default function LegalPageLayout({ title, description, children, embedded = false }) {
  if (embedded) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        </div>
        <Card>
          <div className="space-y-6 text-sm leading-6 text-neutral-700">{children}</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-(--app-bg) px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
              <Droplet className="size-5" />
            </div>
            <span className="font-(--font-display) text-lg font-semibold tracking-tight text-fg">Beas Suite</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50/60"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-surface-border bg-(--modal-bg) p-6 shadow-(--shadow-card) sm:p-8">
          <h1 className="font-(--font-display) text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-2 text-sm text-fg-muted">{description}</p>}
          <div className="mt-6 space-y-6 text-sm leading-6 text-neutral-700">{children}</div>
        </div>

        <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-neutral-400">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.path} to={page.path} className="hover:text-primary-700 hover:underline">
              {page.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
