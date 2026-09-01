import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ChevronDown, HelpCircle, LogOut, Search, Settings } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ROLES, roleLabels, roleMenus } from '../../auth/roles'
import { logout } from '../../api/auth'
import { listNotifications, markAllNotificationsRead, markNotificationRead, getUnreadNotificationCount } from '../../api/notifications'

function formatNotificationTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

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

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const notificationsRef = useRef(null)

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

  useEffect(() => {
    if (!currentUser) return undefined

    let isMounted = true

    const pollUnreadCount = async () => {
      const result = await getUnreadNotificationCount()
      if (isMounted && result.success) setUnreadCount(result.unread)
    }

    pollUnreadCount()
    const interval = setInterval(pollUnreadCount, 60000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [currentUser])

  useEffect(() => {
    if (!isNotificationsOpen) return

    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isNotificationsOpen])

  const toggleNotifications = async () => {
    const nextOpen = !isNotificationsOpen
    setIsNotificationsOpen(nextOpen)

    if (nextOpen) {
      setIsLoadingNotifications(true)
      const result = await listNotifications()
      if (result.success) setNotifications(result.notifications)
      setIsLoadingNotifications(false)
    }
  }

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      const result = await markNotificationRead(notification.id)
      if (result.success) {
        setNotifications((current) => current.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
        setUnreadCount((count) => Math.max(0, count - 1))
      }
    }

    setIsNotificationsOpen(false)
    if (notification.link) navigate(notification.link)
  }

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead()
    if (result.success) {
      setNotifications((current) => current.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    }
  }

  if (!currentUser) return null

  const menuItems = (roleMenus[currentUser.role] || []).flatMap((group) => group.items)
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
      {pageTitle == 'Dashboard' && (
        <div className="relative hidden w-full max-w-[650px] sm:block lg:mx-auto">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search deliveries, customers, orders..."
            className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-11 pr-4 text-sm text-neutral-700 shadow-[0_10px_22px_-18px_rgb(15_23_42/0.18)] transition-all placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-5">
        {logoutError && <p className="hidden text-sm text-red-600 md:block">{logoutError}</p>}
        <button
          type="button"
          aria-label="Help"
          className="hidden rounded-full bg-white p-2.5 text-neutral-500 shadow-(--shadow-xs) ring-1 ring-neutral-100 transition-colors hover:text-neutral-900 sm:inline-flex"
        >
          <HelpCircle className="size-4.5" />
        </button>
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={isNotificationsOpen}
            onClick={toggleNotifications}
            className="relative rounded-full bg-white p-2.5 text-neutral-500 shadow-(--shadow-xs) ring-1 ring-neutral-100 transition-colors hover:text-neutral-900"
          >
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {isNotificationsOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-(--shadow-popover)"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <p className="text-sm font-semibold text-neutral-900">Notifications</p>
                {unreadCount > 0 && (
                  <button type="button" onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
                    <CheckCheck className="size-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {isLoadingNotifications ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-400">Loading...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-400">No notifications yet.</p>
                ) : (
                  notifications.slice(0, 10).map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex w-full flex-col gap-0.5 border-b border-neutral-50 px-4 py-3 text-left transition-colors hover:bg-neutral-50 ${!notification.isRead ? 'bg-primary-50/40' : ''}`}
                    >
                      <p className="text-sm font-medium text-neutral-900">{notification.title}</p>
                      <p className="line-clamp-2 text-xs text-neutral-500">{notification.body}</p>
                      <p className="mt-0.5 text-[0.65rem] text-neutral-400">{formatNotificationTime(notification.createdAt)}</p>
                    </button>
                  ))
                )}
              </div>
              {currentUser.role === ROLES.ADMIN && (
                <button
                  type="button"
                  onClick={() => { setIsNotificationsOpen(false); navigate('/admin/notifications') }}
                  className="block w-full border-t border-neutral-100 px-4 py-2.5 text-center text-xs font-medium text-primary-700 hover:bg-neutral-50"
                >
                  View all notifications
                </button>
              )}
            </div>
          )}
        </div>

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
            <div className="hidden pr-3 text-left sm:block">
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
                className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <Settings className="size-4" aria-hidden="true" />
                Profile Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
