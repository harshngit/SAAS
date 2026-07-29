import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, HelpCircle, LogOut, Search, Settings } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { roleLabels, roleMenus } from '../../auth/roles'
import { logout } from '../../api/auth'

function formatPathTitle(pathname) {
  const segment = pathname.split('/').filter(Boolean).at(-1) || 'dashboard'
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function Topbar() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isMenuOpen])

  if (!currentUser) return null

  const menuItems = roleMenus[currentUser.role] || []
  const activeMenuItem = menuItems
    .filter((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]
  const pageTitle = activeMenuItem?.label || formatPathTitle(location.pathname)

  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleProfileSettings = () => {
    setIsMenuOpen(false)
    navigate('/profile')
  }

  const handleLogout = async () => {
    setIsMenuOpen(false)
    setLogoutError('')
    setIsLoggingOut(true)
    const result = await logout()
    if (!result.success) {
      setLogoutError(result.error)
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <h1 className="mt-3 hidden min-w-[13rem] font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900 lg:block">
        {pageTitle}
      </h1>

      {pageTitle == "Dashboard" && <div className="relative hidden w-full max-w-md sm:block lg:mx-auto">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Search placeholder"
          className="w-full rounded-full border border-transparent bg-neutral-100 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
        />
      </div>}

      <div className="ml-auto flex items-center gap-3">
        {logoutError && <p className="hidden text-sm text-red-600 md:block">{logoutError}</p>}
        <button
          type="button"
          aria-label="Help"
          className="hidden rounded-full bg-white p-2.5 text-neutral-500 shadow-(--shadow-xs) ring-1 ring-neutral-100 transition-colors hover:text-neutral-900 sm:inline-flex"
        >
          <HelpCircle className="size-4.5" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-full bg-white p-2.5 text-neutral-500 shadow-(--shadow-xs) ring-1 ring-neutral-100 transition-colors hover:text-neutral-900"
        >
          <Bell className="size-4.5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2 rounded-full bg-transparent py-1 pl-1 pr-1.5 transition-colors hover:bg-white"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-xs font-semibold text-white ring-2 ring-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-neutral-900">{currentUser.name}</p>
              <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
            </div>
            <ChevronDown
              className={`size-4 shrink-0 text-neutral-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-[1rem] border border-neutral-100 bg-white p-1.5 shadow-(--shadow-popover)"
            >
              <div className="px-3 py-2.5 sm:hidden">
                <p className="text-sm font-medium leading-tight text-neutral-900">{currentUser.name}</p>
                <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleProfileSettings}
                className="flex w-full items-center gap-2.5 rounded-[0.8rem] px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <Settings className="size-4" aria-hidden="true" />
                Profile Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2.5 rounded-[0.8rem] px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
