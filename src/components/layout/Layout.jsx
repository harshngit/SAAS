import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import PageWrapper from './PageWrapper'
import AdminTrialPopup from '../../features/plans/AdminTrialPopup'

export default function Layout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="flex h-svh bg-neutral-50">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Hamburger Button */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-neutral-100 bg-neutral-50/80 px-4 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="sm:hidden rounded-lg p-2 hover:bg-neutral-100"
            aria-label="Open sidebar"
          >
            <Menu className="size-6 text-neutral-600" />
          </button>
          <Topbar />
        </header>
        <main className="flex-1 overflow-y-auto">
          <PageWrapper>
            <Outlet />
          </PageWrapper>
        </main>
      </div>
      <AdminTrialPopup />
    </div>
  )
}
