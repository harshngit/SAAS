import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCheck, ChevronDown, FileText, HelpCircle, LogOut, Search, ShieldCheck, UserCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ROLES, roleLabels, roleMenus } from '../../auth/roles'
import { logout } from '../../api/auth'
import { listNotifications, markAllNotificationsRead, markNotificationRead, getUnreadNotificationCount } from '../../api/notifications'

const NOTIFICATIONS_PANEL_WIDTH = 320
const MENU_PANEL_WIDTH = 240

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

// Computes a portaled panel's fixed position from its trigger button's rect, right-aligned to
// the trigger, and keeps it in sync on scroll/resize while open - same pattern as
// ActionMenu.jsx/Select.jsx/DatePicker.jsx.
function usePortalPosition(isOpen, triggerRef, panelWidth) {
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 8, left: rect.right - panelWidth })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, triggerRef, panelWidth])

  return position
}

export default function Topbar() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuTriggerRef = useRef(null)
  const menuPanelRef = useRef(null)

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const notificationsTriggerRef = useRef(null)
  const notificationsPanelRef = useRef(null)

  // Both panels are portaled to document.body (below) rather than rendered as plain descendants
  // of this header - the header carries .theme-glass (backdrop-filter: blur) in Image background
  // mode (Layout.jsx), and a Chromium compositing quirk corrupts/blurs text in descendants of a
  // backdrop-filter ancestor. Portaling out of that ancestor entirely is the real fix, not a
  // color/opacity tweak.
  const menuPosition = usePortalPosition(isMenuOpen, menuTriggerRef, MENU_PANEL_WIDTH)
  const notificationsPosition = usePortalPosition(isNotificationsOpen, notificationsTriggerRef, NOTIFICATIONS_PANEL_WIDTH)

  useEffect(() => {
    if (!isMenuOpen) return undefined

    const handleClickOutside = (event) => {
      if (
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(event.target) &&
        menuPanelRef.current &&
        !menuPanelRef.current.contains(event.target)
      ) {
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
    if (!isNotificationsOpen) return undefined

    const handleClickOutside = (event) => {
      if (
        notificationsTriggerRef.current &&
        !notificationsTriggerRef.current.contains(event.target) &&
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(event.target)
      ) {
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
  const pageSubtitle = pageTitle === 'Leads' ? 'Unified feed from WhatsApp, website form & calls' : ''

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

  const handleHelp = () => {
    setIsMenuOpen(false)
    navigate('/help')
  }

  const handlePrivacyPolicy = () => {
    setIsMenuOpen(false)
    navigate('/privacy')
  }

  const handleTerms = () => {
    setIsMenuOpen(false)
    navigate('/terms')
  }

  const handleViewAllPolicies = () => {
    setIsMenuOpen(false)
    navigate('/legal')
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
      <div className="ml-4 min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{pageTitle}</h1>
        {pageSubtitle && <p className="mt-0.5 hidden truncate text-sm text-fg-muted sm:block">{pageSubtitle}</p>}
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-5">
        {logoutError && <p className="hidden text-sm text-red-600 md:block">{logoutError}</p>}
        <div className="relative hidden min-w-0 w-[min(34rem,42vw)] md:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            placeholder="Search customers, jobs, quotes..."
            className="w-full rounded-xl border border-surface-border bg-(--input-bg) py-2.5 pl-11 pr-4 text-sm text-fg shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/10"
          />
        </div>
        <div className="relative">
          <button
            ref={notificationsTriggerRef}
            type="button"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={isNotificationsOpen}
            onClick={toggleNotifications}
            className="relative rounded-full bg-surface p-2.5 text-fg-muted shadow-(--shadow-xs) ring-1 ring-neutral-100 transition-colors hover:text-fg"
          >
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {isNotificationsOpen &&
            notificationsPosition &&
            createPortal(
              <div
                ref={notificationsPanelRef}
                role="menu"
                style={{ position: 'fixed', top: notificationsPosition.top, left: notificationsPosition.left, width: NOTIFICATIONS_PANEL_WIDTH }}
                className="z-50 overflow-hidden rounded-2xl border border-surface-border bg-(--modal-bg) shadow-(--shadow-popover)"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                  <p className="text-sm font-semibold text-fg">Notifications</p>
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
                        <p className="text-sm font-medium text-fg">{notification.title}</p>
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
              </div>,
              document.body,
            )}
        </div>

        <div className="relative">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-2 rounded-full bg-transparent py-1 pl-1 pr-1.5 transition-colors hover:bg-(--input-bg)"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-xs font-semibold text-white ring-2 ring-white">
              {initials}
            </div>
            <div className="hidden pr-3 text-left sm:block">
              <p className="text-sm font-medium leading-tight text-fg">{currentUser.name}</p>
              <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
            </div>
            <ChevronDown
              className={`size-4 shrink-0 text-neutral-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {isMenuOpen &&
            menuPosition &&
            createPortal(
              <div
                ref={menuPanelRef}
                role="menu"
                style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, width: MENU_PANEL_WIDTH }}
                className="z-50 overflow-hidden rounded-2xl border border-surface-border bg-(--modal-bg) p-1.5 shadow-(--shadow-popover)"
              >
                <div className="px-3 py-2.5 sm:hidden">
                  <p className="text-sm font-medium leading-tight text-fg">{currentUser.name}</p>
                  <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleProfileSettings}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  <UserCircle className="size-4" aria-hidden="true" />
                  My Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleHelp}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  <HelpCircle className="size-4" aria-hidden="true" />
                  Help & FAQ
                </button>

                <div className="my-1.5 border-t border-neutral-100" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={handlePrivacyPolicy}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Privacy Policy
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleTerms}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  Terms of Service
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleViewAllPolicies}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  View all policies
                </button>

                <div className="my-1.5 border-t border-neutral-100" />

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
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  )
}
