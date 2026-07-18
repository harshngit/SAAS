import { Bell, LogOut, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { roleLabels } from '../../auth/roles'

export default function Topbar() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  if (!currentUser) return null

  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleLogout = () => {
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

        <div className="flex items-center gap-2.5 rounded-full border border-neutral-100 bg-white py-1.5 pl-1.5 pr-3 shadow-(--shadow-xs)">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-tight text-neutral-900">{currentUser.name}</p>
            <span className="text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className="flex items-center gap-1.5 rounded-full border border-neutral-100 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-500 shadow-(--shadow-xs) transition-colors hover:bg-neutral-50 hover:text-neutral-800"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  )
}
