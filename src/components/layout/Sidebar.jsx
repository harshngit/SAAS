import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Crown,
  Droplet,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Sparkles,
  UserCog,
  Warehouse,
  X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { roleMenus, roleLabels, ROLES } from '../../auth/roles'
import { usePermission } from '../../auth/usePermission'
import { listSuperAdminOrganizations } from '../../api/superadmin'
import { getMyAttendance } from '../../api/attendance'
import { formatTimeLabel, normalizeAttendanceRecord } from '../../features/attendance/attendanceUtils'

const NAV_BADGE_COUNTS = {
  '/superadmin/upgrade-requests': 'pendingUpgrades',
}

const sectionIcons = {
  Overview: LayoutDashboard,
  'Sales Operation': Package,
  Operations: Warehouse,
  Finance: Receipt,
  Administration: UserCog,
  System: Settings,
  'Main menu': BarChart3,
}

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
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentOrganization = useAuthStore((state) => state.currentOrganization)
  const currentRole = currentUser?.role
  const { can } = usePermission()
  // Items without a `module` tag (personal pages, or concepts the backend doesn't model yet,
  // like Visits/Follow-ups) are always shown - only permission-mapped items get gated.
  const menuGroups = (currentRole ? roleMenus[currentRole] || [] : [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.module || can(item.module, item.action || 'view')),
    }))
    .filter((group) => group.items.length > 0)
  const [openSections, setOpenSections] = useState({})
  const [navBadgeCounts, setNavBadgeCounts] = useState({})
  const [todaysAttendance, setTodaysAttendance] = useState(null)
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false)

  useEffect(() => {
    if (currentRole !== ROLES.DELIVERY_PARTNER) {
      setTodaysAttendance(null)
      return
    }

    let isMounted = true
    const todayIso = new Date().toISOString().slice(0, 10)

    async function loadTodaysAttendance() {
      setIsLoadingAttendance(true)
      const result = await getMyAttendance({ date_from: todayIso, date_to: todayIso })
      if (!isMounted) return
      setIsLoadingAttendance(false)

      if (!result.success || result.records.length === 0) {
        setTodaysAttendance(null)
        return
      }

      setTodaysAttendance(normalizeAttendanceRecord(result.records[0]))
    }

    loadTodaysAttendance()

    return () => {
      isMounted = false
    }
    // Re-check on route change so checking in from the Attendance page updates this immediately.
  }, [currentRole, location.pathname])

  useEffect(() => {
    if (currentRole !== ROLES.SUPER_ADMIN) {
      setNavBadgeCounts({})
      return
    }

    let isMounted = true

    async function loadPendingUpgradeCount() {
      const result = await listSuperAdminOrganizations({ upgrade_status: 'pending' })
      if (!isMounted || !result.success) return

      setNavBadgeCounts((current) => ({ ...current, pendingUpgrades: result.organizations?.length || 0 }))
    }

    loadPendingUpgradeCount()

    return () => {
      isMounted = false
    }
    // Re-check whenever the route changes so an approve/reject elsewhere clears the badge promptly.
  }, [currentRole, location.pathname])

  useEffect(() => {
    const nextMenuGroups = currentRole ? roleMenus[currentRole] || [] : []
    setOpenSections(
      Object.fromEntries(
        // Open the first section by default for every role (covers single-section roles like
        // Sales Officer/Delivery Partner/Accountant/Super Admin, whose only group isn't named
        // 'Overview') plus 'Sales Operation' specifically, to keep Admin's existing two-open
        // default unchanged.
        nextMenuGroups.map((group, index) => [
          group.section,
          index === 0 || group.section === 'Sales Operation',
        ]),
      ),
    )
  }, [currentRole])

  if (!currentUser) return null

  const labelVisibilityClass = isExpanded
    ? 'visible max-w-48 opacity-100 delay-150'
    : 'invisible max-w-0 opacity-0 delay-0'
  const desktopLabelVisibilityClass = isExpanded
    ? 'md:visible md:max-w-48 md:opacity-100 md:delay-150'
    : 'md:invisible md:max-w-0 md:opacity-0 md:delay-0'
  const sectionLabelVisibilityClass = isExpanded
    ? 'visible max-w-48 whitespace-nowrap opacity-100 delay-150'
    : 'invisible max-w-0 opacity-0 delay-0'
  const useCollapsedSectionNav = !isExpanded && menuGroups.length > 1
  const currentPlanName =
    currentOrganization?.plan?.name ||
    (typeof currentOrganization?.plan === 'string' ? currentOrganization.plan : '') ||
    currentOrganization?.plan_name ||
    currentOrganization?.planName ||
    ''
  const showUpgradeCard = currentRole === ROLES.ADMIN && currentPlanName.toLowerCase() === 'free'
  const showDeliveryCheckInCard = currentRole === ROLES.DELIVERY_PARTNER
  const keepMenuAlwaysOpen = currentRole === ROLES.DELIVERY_PARTNER

  const toggleSection = (section) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const handleCollapsedSectionClick = (section) => {
    setOpenSections((current) => ({ ...current, [section]: true }))
    onToggleExpanded()
    onCloseMobile()
  }

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
        className={`fixed inset-y-3 left-3 z-50 flex w-[16rem] flex-col overflow-visible rounded-2xl bg-[#eef6eb] shadow-(--shadow-card) transition-transform duration-300 md:static md:inset-auto md:h-full md:translate-x-0 md:rounded-none md:shadow-none md:transition-[width] md:duration-300 md:ease-in-out ${
          isExpanded ? 'md:w-[16rem]' : 'md:w-[4.75rem]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'}`}
      >
        
        <button
  type="button"
  onClick={onToggleExpanded}
  aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
  aria-expanded={isExpanded}
  aria-controls={id}
  className="group absolute right-[-0.65rem] top-1/2 z-20 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary-700 shadow-(--shadow-card) ring-2 ring-neutral-200 transition-colors hover:text-primary-900 focus:outline-none focus:ring-2 focus:ring-neutral-200 md:flex"
>
  {isExpanded ? (
    <ChevronLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
  ) : (
    <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
  )}
</button>

        <div className={`relative flex items-center px-4 pb-4 pt-5 ${isExpanded ? 'justify-between' : 'md:justify-center'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0f5116] text-white shadow-[0_10px_24px_-16px_rgb(15_81_22/0.55)]">
              <Droplet className="size-5" aria-hidden="true" />
            </div>
            <div className={`hidden min-w-0 flex-col overflow-hidden transition-all duration-150 md:flex ${labelVisibilityClass}`}>
              <span className="truncate font-(--font-display) text-[1.05rem] font-semibold tracking-tight text-neutral-900">
                SAAS CRM
              </span>
              <span className="truncate text-xs font-medium text-primary-600">{roleLabels[currentUser.role]}</span>
            </div>
            <div className="flex min-w-0 flex-col md:hidden">
              <span className="truncate font-(--font-display) text-[1.05rem] font-semibold tracking-tight text-neutral-900">
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

        <nav className={`sidebar-nav min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${isExpanded ? 'py-5 md:px-3' : 'py-3 md:px-2.5 md:pt-0'} px-3`}>
          {menuGroups.map((group, groupIndex) => {
            const SectionIcon = sectionIcons[group.section] || group.items[0]?.icon
            const sectionPath = group.items[0]?.path || '#'
            const isSectionActive = group.items.some(
              (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
            )

            return (
              <div key={group.section} className={groupIndex > 0 ? `mt-5 ${!isExpanded ? 'md:mt-2' : ''}` : ''}>
                {useCollapsedSectionNav && SectionIcon && (
                  <NavLink
                    to={sectionPath}
                    onClick={() => handleCollapsedSectionClick(group.section)}
                    aria-label={group.section}
                    title={group.section}
                    className={`group relative hidden items-center justify-center rounded-2xl py-2.5 text-sm font-medium transition-all duration-150 md:flex ${
                      isSectionActive
                        ? 'bg-[#bdeaa5] text-primary-700 shadow-[inset_0_0_0_1px_rgb(6_59_0/0.14)]'
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-linear-to-b from-primary-500 to-primary-700 transition-opacity ${
                        isSectionActive ? 'opacity-100' : 'opacity-0'
                      }`}
                      aria-hidden="true"
                    />
                    <SectionIcon className="size-4.5 shrink-0" aria-hidden="true" />
                    <CollapsedTooltip label={group.section} />
                  </NavLink>
                )}

                <div className={useCollapsedSectionNav ? 'md:hidden' : ''}>
                  {group.section !== 'Overview' && (
                    <>
                      {groupIndex > 0 && (
                        <div
                          className={`mx-2 mb-2 hidden h-px bg-neutral-100 md:block ${isExpanded ? 'md:hidden' : ''}`}
                          aria-hidden="true"
                        />
                      )}
                      {keepMenuAlwaysOpen ? (
                        <>
                          <div
                            className={`hidden items-center justify-between overflow-hidden rounded-lg px-3 pb-2 text-left text-[0.68rem] font-semibold uppercase tracking-wide text-neutral-900 md:flex ${
                              isExpanded ? sectionLabelVisibilityClass : 'invisible h-0 max-w-0 pb-0 opacity-0'
                            }`}
                          >
                            <span className="truncate">MAIN MENU</span>
                            <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                          </div>
                          <div className="flex w-full items-center justify-between rounded-lg px-3 pb-2 text-left text-[0.68rem] font-semibold uppercase tracking-wide text-neutral-900 md:hidden">
                            <span>MAIN MENU</span>
                            <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleSection(group.section)}
                            aria-expanded={openSections[group.section] !== false}
                            className={`hidden w-full items-center justify-between overflow-hidden rounded-lg px-3 pb-2 text-left text-[0.68rem] font-semibold uppercase tracking-wide text-neutral-900 transition-all duration-150 md:flex ${
                              isExpanded ? sectionLabelVisibilityClass : 'invisible h-0 max-w-0 pb-0 opacity-0'
                            }`}
                          >
                            <span className="truncate">{group.section}</span>
                            <ChevronDown
                              className={`size-3.5 shrink-0 transition-transform ${openSections[group.section] === false ? '-rotate-90' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSection(group.section)}
                            aria-expanded={openSections[group.section] !== false}
                            className="flex w-full items-center justify-between rounded-lg px-3 pb-2 text-left text-[0.68rem] font-semibold uppercase tracking-wide text-neutral-900 transition-colors md:hidden"
                          >
                            <span>{group.section}</span>
                            <ChevronDown
                              className={`size-3.5 shrink-0 transition-transform ${openSections[group.section] === false ? '-rotate-90' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <div className={`space-y-0.5 ${keepMenuAlwaysOpen ? '' : `${openSections[group.section] === false && isExpanded ? 'md:hidden' : ''} ${openSections[group.section] === false ? 'hidden md:block' : ''}`}`}>
                    {group.items.map((item) => {
                      const badgeCount = navBadgeCounts[NAV_BADGE_COUNTS[item.path]] || 0

                      return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onCloseMobile}
                        aria-label={!isExpanded ? item.label : undefined}
                        title={!isExpanded ? item.label : undefined}
                          className={({ isActive }) =>
                          `group relative flex items-center rounded-l-lg rounded-r-2xl py-2 text-sm font-medium transition-all duration-150 ${
                            isExpanded
                              ? 'gap-3 px-3.5 md:justify-start'
                              : 'gap-3 px-3.5 md:gap-0 md:rounded-2xl md:px-0 md:justify-center'
                          } ${
                            isActive
                              ? 'bg-[#c4eba9] text-neutral-900 shadow-[inset_0_0_0_1px_rgb(6_59_0/0.12)]'
                              : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-800 transition-opacity ${
                                isActive ? 'opacity-100' : 'opacity-0'
                              } ${isExpanded ? '' : 'md:hidden'}`}
                              aria-hidden="true"
                            />
                            <span className="relative shrink-0">
                              <item.icon className="size-4.5" aria-hidden="true" />
                              {!isExpanded && badgeCount > 0 && (
                                <span
                                  className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500 ring-2 ring-[#eef6eb]"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            <span className={`visible flex max-w-48 items-center gap-2 overflow-hidden opacity-100 transition-all duration-150 ${desktopLabelVisibilityClass}`}>
                              <span className="truncate whitespace-nowrap">{item.label}</span>
                              {badgeCount > 0 && (
                                <span className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-semibold leading-none text-white">
                                  {badgeCount}
                                </span>
                              )}
                            </span>
                            {!isExpanded && (
                              <CollapsedTooltip label={badgeCount > 0 ? `${item.label} (${badgeCount})` : item.label} />
                            )}
                          </>
                        )}
                      </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {showDeliveryCheckInCard && !isLoadingAttendance && (
          <div className="px-3 pb-3">
            {isExpanded ? (
              <div className="max-w-[11rem] rounded-2xl bg-white px-4 py-4 shadow-[0_12px_26px_-20px_rgb(15_23_42/0.22)]">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-white ${
                      todaysAttendance?.checkIn ? 'bg-primary-700' : 'bg-neutral-300'
                    }`}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-neutral-900">
                      {todaysAttendance?.checkIn ? "You're checked in" : 'Not checked in yet'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {todaysAttendance?.checkIn ? `Since ${formatTimeLabel(todaysAttendance.checkIn)}` : 'No check-in recorded today'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/delivery/attendance')
                    onCloseMobile()
                  }}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
                >
                  View Attendance <ArrowRight className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/delivery/attendance')}
                aria-label={todaysAttendance?.checkIn ? `Checked in since ${formatTimeLabel(todaysAttendance.checkIn)}` : 'Not checked in yet'}
                title={todaysAttendance?.checkIn ? `Checked in since ${formatTimeLabel(todaysAttendance.checkIn)}` : 'Not checked in yet'}
                className={`hidden size-9 w-full items-center justify-center rounded-2xl ring-1 transition-colors md:flex ${
                  todaysAttendance?.checkIn
                    ? 'bg-primary-50 text-primary-700 ring-primary-100 hover:bg-primary-100'
                    : 'bg-neutral-100 text-neutral-500 ring-neutral-200 hover:bg-neutral-200'
                }`}
              >
                <CheckCircle2 className="size-4.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {showUpgradeCard && (
        <div className="border-t border-neutral-100 p-3">
          <div className="hidden md:block">
            {isExpanded ? (
              <div className="overflow-hidden rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 px-2.5 py-2.5 text-center text-white shadow-(--shadow-glow-primary)">
                <div className="mx-auto flex size-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/20">
                  <Sparkles className="size-3" aria-hidden="true" />
                </div>
                <p className="mt-1 text-[0.7rem] font-semibold">Upgrade Plan</p>
                <p className="mt-0.5 text-[0.62rem] leading-3 text-primary-100">
                  Higher productivity with better organization
                </p>
                <NavLink
                  to="/admin/plans"
                  onClick={onCloseMobile}
                  className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[0.62rem] font-semibold text-primary-700 shadow-(--shadow-xs) transition-colors hover:bg-primary-50"
                >
                  <Crown className="size-3" aria-hidden="true" />
                  Upgrade
                </NavLink>
              </div>
            ) : (
              <NavLink
                to="/admin/plans"
                onClick={onCloseMobile}
                aria-label="Upgrade plan"
                title="Upgrade plan"
                className="flex size-9 w-full items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100 transition-colors hover:bg-primary-100"
              >
                <Crown className="size-4.5" aria-hidden="true" />
              </NavLink>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 px-2.5 py-2.5 text-center text-white shadow-(--shadow-glow-primary) md:hidden">
            <div className="mx-auto flex size-6 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/20">
              <Sparkles className="size-3" aria-hidden="true" />
            </div>
            <p className="mt-1 text-[0.7rem] font-semibold">Upgrade Plan</p>
            <p className="mt-0.5 text-[0.62rem] leading-3 text-primary-100">
              Higher productivity with better organization
            </p>
            <NavLink
              to="/admin/plans"
              onClick={onCloseMobile}
              className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[0.62rem] font-semibold text-primary-700 shadow-(--shadow-xs) transition-colors hover:bg-primary-50"
            >
              <Crown className="size-3" aria-hidden="true" />
              Upgrade
            </NavLink>
          </div>
        </div>
        )}
      </aside>
    </>
  )
}
