import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import PageWrapper from './PageWrapper'
import AdminTrialPopup from '../../features/plans/AdminTrialPopup'
import { getCurrentProfile } from '../../api/auth'

export default function Layout() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('saas-sidebar-expanded') === 'true'
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const location = useLocation()
  const isDashboardRoute = location.pathname.endsWith('/dashboard')

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('saas-sidebar-expanded', String(isSidebarExpanded))
    window.dispatchEvent(
      new CustomEvent('saas-sidebar-expanded-change', {
        detail: isSidebarExpanded,
      }),
    )
  }, [isSidebarExpanded])

  useEffect(() => {
    if (!isMobileSidebarOpen) return

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileSidebarOpen])

  useEffect(() => {
    if (location.pathname.endsWith('/dashboard')) {
      getCurrentProfile()
    }
  }, [location.pathname])

  return (
    <div className={`h-svh overflow-hidden ${isDashboardRoute ? 'bg-transparent' : 'bg-[#eef6eb]'}`}>
      <div className="flex h-full overflow-hidden">
        <Sidebar
          id="dashboard-sidebar"
          isExpanded={isSidebarExpanded}
          onToggleExpanded={() => setIsSidebarExpanded((isExpanded) => !isExpanded)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
        <div
          className={`flex min-w-0 flex-1 flex-col ${
            isDashboardRoute ? 'bg-transparent md:rounded-l-none md:shadow-none' : 'bg-white md:rounded-l-2xl md:shadow-(--shadow-card)'
          }`}
        >
          <header className="flex h-16 shrink-0 items-center gap-3 bg-transparent pr-7 lg:h-[4.75rem] ">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="rounded-xl p-2 text-neutral-600 transition-colors hover:bg-neutral-100 md:hidden"
            aria-label="Open sidebar"
            aria-controls="dashboard-sidebar"
            aria-expanded={isMobileSidebarOpen}
          >
            <Menu className="size-5" />
          </button>
          <Topbar />
          </header>
          <main className={`flex-1 overflow-y-auto ${isDashboardRoute ? 'rounded-b-none bg-transparent' : 'rounded-b-2xl bg-white'}`}>
            <PageWrapper>
              <Outlet />
            </PageWrapper>
          </main>
        </div>
      </div>
      <AdminTrialPopup />
    </div>
  )
}
