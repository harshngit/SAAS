import { NavLink } from 'react-router-dom'
import { Droplet, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { roleMenus, roleLabels } from '../../auth/roles'

export default function Sidebar({ isMobileOpen, onCloseMobile }) {
  const currentUser = useAuthStore((state) => state.currentUser)

  if (!currentUser) return null

  const menuItems = roleMenus[currentUser.role] || []

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm sm:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-neutral-100 bg-white transition-transform duration-300 sm:static sm:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
              <Droplet className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col">
              <span className="font-(--font-display) text-lg font-semibold tracking-tight text-neutral-900">
                SAAS CRM
              </span>
              <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="sm:hidden rounded-lg p-2 hover:bg-neutral-100"
            aria-label="Close sidebar"
          >
            <X className="size-5 text-neutral-600" />
          </button>
        </div>

        <div className="mx-6 h-px bg-neutral-100" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-linear-to-b from-primary-500 to-primary-700 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden="true"
                  />
                  <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-100 to-primary-200 text-sm font-semibold text-primary-700">
              {currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-neutral-900 truncate">{currentUser.name}</span>
              <span className="text-xs text-neutral-500 truncate">{currentUser.email}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
