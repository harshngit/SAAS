// Minimal shared slot so in-app navigation chrome (the Sidebar) can reuse whichever page's
// useUnsavedChangesGuard is currently active, without migrating off BrowserRouter to a data
// router (react-router's useBlocker needs one). Only one route renders at a time, so "the
// current page's guard, if any" is always well-defined - "last registered wins".
//
// This does NOT and cannot cover the browser's own physical Back/Forward buttons - those are
// not click events React can intercept; only the native beforeunload prompt (already wired in
// useUnsavedChangesGuard) covers tab close/refresh/back-forward-outside-the-app.
let activeGuard = null

export function registerNavigationGuard(guardLeave) {
  activeGuard = guardLeave
}

// Pass the same guardLeave reference that registered, so an unmount/dirty-clear from a page
// that's no longer current can't clobber a newer page's guard.
export function clearNavigationGuard(guardLeave) {
  if (activeGuard === guardLeave) activeGuard = null
}

export function getNavigationGuard() {
  return activeGuard
}
