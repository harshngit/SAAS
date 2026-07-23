import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, LogOut, Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { roleLabels, roleProfileSettingsPath } from '../../auth/roles'

export default function Topbar() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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

  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const profileSettingsPath = roleProfileSettingsPath[currentUser.role]

  const handleProfileSettings = () => {
    setIsMenuOpen(false)
    if (profileSettingsPath) navigate(profileSettingsPath)
  }

  const handleLogout = () => {
    setIsMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-1 items-center gap-4">
      <div className="relative hidden w-full max-w-sm sm:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Search orders, customers, products…"
          className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12 focus:border-primary-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-full border border-neutral-100 bg-white p-2.5 text-neutral-500 shadow-(--shadow-xs) transition-colors hover:bg-neutral-50"
        >
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2 rounded-full border border-neutral-100 bg-white py-1.5 pl-1.5 pr-3 shadow-(--shadow-xs) transition-colors hover:bg-neutral-50"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-xs font-semibold text-white">
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
              className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-100 bg-white p-1.5 shadow-(--shadow-popover)"
            >
              <div className="px-3 py-2.5 sm:hidden">
                <p className="text-sm font-medium leading-tight text-neutral-900">{currentUser.name}</p>
                <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleProfileSettings}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <Settings className="size-4" aria-hidden="true" />
                Profile Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
