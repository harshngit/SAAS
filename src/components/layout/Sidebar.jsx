import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Crown, Droplet, Sparkles, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { roleMenus, roleLabels } from '../../auth/roles'

function CollapsedTooltip({ label }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-neutral-100 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-(--shadow-popover) transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100 md:block"
    >
      {label}
    </span>
  )
}

export default function Sidebar({
  id,
  isExpanded,
  onToggleExpanded,
  isMobileOpen,
  onCloseMobile,
}) {
  const currentUser = useAuthStore((state) => state.currentUser)

  if (!currentUser) return null

  const menuItems = roleMenus[currentUser.role] || []
  const labelVisibilityClass = isExpanded
    ? 'visible max-w-36 opacity-100 delay-150'
    : 'invisible max-w-0 opacity-0 delay-0'
  const desktopLabelVisibilityClass = isExpanded
    ? 'md:visible md:max-w-36 md:opacity-100 md:delay-150'
    : 'md:invisible md:max-w-0 md:opacity-0 md:delay-0'

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
        />
      )}

      <aside
        id={id}
        className={`fixed inset-y-3 left-3 z-50 flex w-72 flex-col overflow-visible rounded-[1.5rem] bg-[#eef6eb] shadow-(--shadow-card) transition-transform duration-300 md:static md:inset-auto md:h-full md:translate-x-0 md:rounded-none md:shadow-none md:transition-[width] md:duration-300 md:ease-in-out ${
          isExpanded ? 'md:w-60' : 'md:w-[4.75rem]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'}`}
      >
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={isExpanded}
          aria-controls={id}
          className="absolute right-[-0.65rem] top-1/2 z-20 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary-700 shadow-(--shadow-card) ring-1 ring-primary-100 transition-colors hover:text-primary-900 focus:outline-none focus:ring-4 focus:ring-primary-500/15 md:flex"
        >
          {isExpanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        <div className={`relative flex items-center px-4 pb-4 pt-5 ${isExpanded ? 'justify-between' : 'md:justify-center'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
              <Droplet className="size-5" aria-hidden="true" />
            </div>
            <div className={`hidden min-w-0 flex-col overflow-hidden transition-all duration-150 md:flex ${labelVisibilityClass}`}>
              <span className="truncate font-(--font-display) text-lg font-semibold tracking-tight text-neutral-900">
                SAAS CRM
              </span>
              <span className="truncate text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
            </div>
            <div className="flex min-w-0 flex-col md:hidden">
              <span className="truncate font-(--font-display) text-lg font-semibold tracking-tight text-neutral-900">
                SAAS CRM
              </span>
              <span className="truncate text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-xl p-2 text-neutral-600 transition-colors hover:bg-neutral-100 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="size-5 text-neutral-600" />
            </button>
          </div>
        </div>

        <div className={`${isExpanded ? 'mx-5' : 'mx-3'} hidden h-px bg-neutral-100 transition-all duration-300 md:block`} />
        <div className="mx-5 h-px bg-neutral-100 md:hidden" />

        <nav className={`sidebar-nav min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${isExpanded ? 'py-5 md:px-3' : 'py-3 md:px-2.5 md:pt-0'} px-3`}>
          <p
            className={`hidden overflow-hidden px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-neutral-400 transition-all duration-150 md:block ${
              isExpanded ? `${labelVisibilityClass} pb-2` : 'invisible h-0 max-w-0 pb-0 opacity-0'
            }`}
          >
            Main menu
          </p>
          <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-neutral-400 md:hidden">
            Main menu
          </p>
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              aria-label={!isExpanded ? item.label : undefined}
              title={!isExpanded ? item.label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center rounded-[0.9rem] py-2.5 text-sm font-medium transition-all duration-150 ${
                  isExpanded
                    ? 'gap-3 px-3.5 md:justify-start'
                    : 'gap-3 px-3.5 md:gap-0 md:px-0 md:justify-center'
                } ${
                  isActive
                    ? 'bg-[#bdeaa5] text-primary-700 shadow-[inset_0_0_0_1px_rgb(6_59_0/0.14)]'
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-linear-to-b from-primary-500 to-primary-700 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden="true"
                  />
                  <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <span className={`visible max-w-44 overflow-hidden whitespace-nowrap opacity-100 transition-all duration-150 ${desktopLabelVisibilityClass}`}>
                    {item.label}
                  </span>
                  {!isExpanded && <CollapsedTooltip label={item.label} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-neutral-100 p-3">
          <div className="hidden md:block">
            {isExpanded ? (
              <div className="overflow-hidden rounded-[0.85rem] bg-linear-to-br from-primary-500 to-primary-700 px-2.5 py-2.5 text-center text-white shadow-(--shadow-glow-primary)">
                <div className="mx-auto flex size-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/20">
                  <Sparkles className="size-3" aria-hidden="true" />
                </div>
                <p className="mt-1 text-[0.7rem] font-semibold">Upgrade Pro</p>
                <p className="mt-0.5 text-[0.62rem] leading-3 text-primary-100">
                  Higher productivity with better organization
                </p>
                <button
                  type="button"
                  className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[0.62rem] font-semibold text-primary-700 shadow-(--shadow-xs) transition-colors hover:bg-primary-50"
                >
                  <Crown className="size-3" aria-hidden="true" />
                  Upgrade
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Upgrade plan"
                title="Upgrade plan"
                className="flex size-9 w-full items-center justify-center rounded-[0.85rem] bg-primary-50 text-primary-700 ring-1 ring-primary-100 transition-colors hover:bg-primary-100"
              >
                <Crown className="size-4.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-[0.85rem] bg-linear-to-br from-primary-500 to-primary-700 px-2.5 py-2.5 text-center text-white shadow-(--shadow-glow-primary) md:hidden">
            <div className="mx-auto flex size-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/20">
              <Sparkles className="size-3" aria-hidden="true" />
            </div>
            <p className="mt-1 text-[0.7rem] font-semibold">Upgrade Pro</p>
            <p className="mt-0.5 text-[0.62rem] leading-3 text-primary-100">
              Higher productivity with better organization
            </p>
            <button
              type="button"
              className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[0.62rem] font-semibold text-primary-700 shadow-(--shadow-xs) transition-colors hover:bg-primary-50"
            >
              <Crown className="size-3" aria-hidden="true" />
              Upgrade
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
