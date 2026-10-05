import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import PageWrapper from './PageWrapper'
import AdminTrialPopup from '../../features/plans/AdminTrialPopup'
import { getCurrentProfile } from '../../api/auth'
import { useTheme } from '../../theme/useTheme'
import { resolveGlassSurfaceStyle } from '../../theme/themeConfig'

export default function Layout() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('saas-sidebar-expanded') === 'true'
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const location = useLocation()
  const { theme } = useTheme()
  const wantsBackground = Boolean(theme?.customEnabled && theme.background?.url)
  // Preload the image before ever rendering it as a CSS background, and fall back to the plain
  // surface if it 404s/fails to load (Part 2.5) - never show a broken-image background. Keyed
  // only on the URL string, so switching pages (Layout stays mounted, only <Outlet/> swaps) never
  // re-triggers a fetch the browser hasn't already cached.
  const [loadedBackgroundUrl, setLoadedBackgroundUrl] = useState('')
  useEffect(() => {
    if (!wantsBackground) {
      setLoadedBackgroundUrl('')
      return undefined
    }
    let cancelled = false
    const image = new Image()
    image.onload = () => { if (!cancelled) setLoadedBackgroundUrl(theme.background.url) }
    image.onerror = () => { if (!cancelled) setLoadedBackgroundUrl('') }
    image.src = theme.background.url
    return () => { cancelled = true }
  }, [wantsBackground, theme?.background?.url])
  const hasBackground = wantsBackground && loadedBackgroundUrl === theme.background.url

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

  const glassSurfaceStyle = resolveGlassSurfaceStyle(theme, hasBackground)
  const isSuperAdminDashboard = location.pathname === '/superadmin/dashboard'
  const isSuperAdminAnalytics = location.pathname === '/superadmin/analytics'
  const isSuperAdminOrganizationDetail = /^\/superadmin\/organizations\/[^/]+$/.test(location.pathname)
  const shouldHideTopbar = isSuperAdminAnalytics || isSuperAdminOrganizationDetail

  return (
    <div className="relative h-svh overflow-hidden bg-(--app-bg)" style={glassSurfaceStyle || undefined}>
      {/* Background image layer: position: fixed so it never scrolls/re-paints with content,
          cover/center, behind everything (z-0). Overlay sits on top of the image (also z-0,
          painted after it) at theme.background.overlayOpacity - black in dark mode, white in
          light mode (Part 2.5). Both only render once the image has actually finished loading. */}
      {hasBackground && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${theme.background.url})` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0"
            style={{
              backgroundColor: theme.mode === 'dark' ? '#000000' : '#ffffff',
              opacity: theme.background.overlayOpacity ?? (theme.mode === 'dark' ? 0.45 : 0.2),
            }}
          />
        </>
      )}
      <div className="relative z-10 flex h-full overflow-hidden">
        <Sidebar
          id="dashboard-sidebar"
          isExpanded={isSidebarExpanded}
          onToggleExpanded={() => setIsSidebarExpanded((isExpanded) => !isExpanded)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          hasBackground={hasBackground}
        />
        <div
          className={`flex min-w-0 flex-1 flex-col bg-surface md:rounded-l-2xl md:shadow-(--shadow-card) ${hasBackground ? 'theme-glass' : ''}`}
        >
          {!shouldHideTopbar && (
            <header className={`flex shrink-0 items-center gap-3 border-b border-surface-border bg-surface pr-7 ${isSuperAdminDashboard ? 'h-16' : 'h-20 lg:h-[5.75rem]'} ${hasBackground ? 'theme-glass' : ''}`}>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="rounded-xl p-2 text-fg-muted transition-colors hover:bg-neutral-100 md:hidden"
                aria-label="Open sidebar"
                aria-controls="dashboard-sidebar"
                aria-expanded={isMobileSidebarOpen}
              >
                <Menu className="size-5" />
              </button>
              <Topbar />
            </header>
          )}
          <main className={`flex-1 overflow-y-auto rounded-b-2xl ${shouldHideTopbar ? 'bg-(--app-bg)' : 'bg-surface'}`}>
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
