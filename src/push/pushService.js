import { deleteToken, getToken, onMessage } from 'firebase/messaging'
import { firebaseConfig, getMessagingInstance, isPushConfigured, isPushSupportedInBrowser } from './firebase'
import { deletePushDevice, registerPushDevice } from '../api/pushDevices'
import { useAuthStore } from '../store/authStore'
import { showGlobalToast } from '../components/ui/toastContext'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
const SW_PATH = '/firebase-messaging-sw.js'

function storageKey(userId) {
  return `crm.push.${userId}`
}

function readStoredDevice(userId) {
  if (!userId) return null
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredDevice(userId, value) {
  if (!userId) return
  try {
    if (value) window.localStorage.setItem(storageKey(userId), JSON.stringify(value))
    else window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Best-effort only - a blocked/full localStorage shouldn't break push itself, just the
    // "don't re-register an unchanged token" optimization on the next sync.
  }
}

// Explicit per-user "I clicked Disable" flag, separate from the device record above. Without
// this, a granted browser permission + boot-time syncPushToken() would silently re-register a
// new device the very next reload/login, making "Disable" not actually stick.
function optOutKey(userId) {
  return `crm.push.${userId}.optout`
}

function readOptOut(userId) {
  if (!userId) return false
  try {
    return window.localStorage.getItem(optOutKey(userId)) === '1'
  } catch {
    return false
  }
}

function writeOptOut(userId, value) {
  if (!userId) return
  try {
    if (value) window.localStorage.setItem(optOutKey(userId), '1')
    else window.localStorage.removeItem(optOutKey(userId))
  } catch {
    // best-effort only
  }
}

// Best-effort "Chrome on Windows" style label from the UA string - order matters, since e.g.
// Edge's and Opera's UAs also contain "Chrome/", and Chrome's also contains "Safari/".
function detectBrowserName(ua) {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Browser'
}

function detectOsName(ua) {
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'an unknown OS'
}

function deviceLabel() {
  if (typeof navigator === 'undefined') return 'Web'
  const ua = navigator.userAgent || ''
  return `${detectBrowserName(ua)} on ${detectOsName(ua)}`
}

// Registered with the Firebase config in the query string, since a service worker script can't
// read import.meta.env (see public/firebase-messaging-sw.js). Memoized - every caller in a given
// page load shares the same registration instead of re-registering per call.
let swRegistrationPromise = null

function getServiceWorkerRegistration() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null)

  if (!swRegistrationPromise) {
    const query = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    }).toString()

    swRegistrationPromise = navigator.serviceWorker.register(`${SW_PATH}?${query}`).catch((error) => {
      swRegistrationPromise = null
      console.error('[push] service worker registration failed:', error)
      return null
    })
  }

  return swRegistrationPromise
}

// Synchronous-enough check for whether the push UI should render at all (config present). Full
// browser-capability detection (isPushSupportedInBrowser) is async - see getPushStatus below for
// the UI's actual status label.
export function isPushAvailable() {
  return isPushConfigured()
}

// One of 'unsupported' | 'denied' | 'granted' | 'default' - maps directly to the Profile page's
// "Not supported" / "Blocked" / "On" / "Off" status labels. 'granted' requires all three: browser
// permission actually granted, a device genuinely registered for THIS user, and no opt-out flag -
// not just the raw Notification.permission, so Disable visibly flips the UI back to "Off" (with
// the Enable button again) rather than permission alone deciding the label.
export async function getPushStatus() {
  if (!isPushConfigured()) return 'unsupported'
  const supported = await isPushSupportedInBrowser()
  if (!supported) return 'unsupported'
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'default'

  const currentUser = useAuthStore.getState().currentUser
  if (!currentUser?.id) return 'default'
  if (readOptOut(currentUser.id)) return 'default'
  const stored = readStoredDevice(currentUser.id)
  if (!stored?.deviceId) return 'default'

  return 'granted'
}

let foregroundListenerAttached = false

// Shows an in-app toast for a push that arrives while a tab is focused (the browser never shows
// its own OS notification for a foreground message by default, so without this the user would
// see nothing at all while actively using the app).
async function ensureForegroundListener() {
  if (foregroundListenerAttached) return
  const messaging = await getMessagingInstance()
  if (!messaging) return

  foregroundListenerAttached = true
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'New notification'
    const body = payload.notification?.body || payload.data?.body || ''
    showGlobalToast({ title, message: body })
  })
}

// Gets (or re-uses) a device token and registers it with the backend, handling the one-shot 409
// "token belongs to another organization" recovery. Never throws - every failure path returns
// null so callers can treat push as simply "not enabled right now" rather than crash the caller.
async function requestTokenAndRegister(userId, { retrying = false } = {}) {
  try {
    const messaging = await getMessagingInstance()
    if (!messaging || !VAPID_KEY) return null

    const registration = await getServiceWorkerRegistration()
    if (!registration) return null

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token) return null

    const result = await registerPushDevice({ token, platform: 'web', label: deviceLabel() })

    if (result.success) {
      writeStoredDevice(userId, { deviceId: result.id, token, tokenSuffix: result.tokenSuffix })
      ensureForegroundListener()
      return { deviceId: result.id, token }
    }

    // 409 = this token is already registered to a different organization (e.g. a second demo
    // account signing in on the same browser). Clear it and get a genuinely fresh one - but only
    // ONCE, so a backend that keeps rejecting can never spin this into an infinite loop.
    if (result.status === 409 && !retrying) {
      await deleteToken(messaging).catch(() => {})
      return requestTokenAndRegister(userId, { retrying: true })
    }

    if (result.status === 422) {
      console.warn('[push] device registration rejected (422):', result.error)
    } else if (!retrying) {
      console.error('[push] device registration failed:', result.error)
    }
    return null
  } catch (error) {
    console.error('[push] requestTokenAndRegister failed:', error)
    return null
  }
}

// Call ONLY from a direct user click (Notification.requestPermission must be inside a user
// gesture in most browsers). Never re-prompts once the user has denied - that's a dead end the
// user can only undo from their own browser's site settings.
export async function enablePush() {
  if (!isPushConfigured()) return { success: false, reason: 'unsupported' }

  const supported = await isPushSupportedInBrowser()
  if (!supported) return { success: false, reason: 'unsupported' }

  const currentUser = useAuthStore.getState().currentUser
  if (!currentUser?.id) return { success: false, reason: 'signed_out' }

  if (Notification.permission === 'denied') {
    return { success: false, reason: 'denied' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { success: false, reason: permission === 'denied' ? 'denied' : 'dismissed' }
  }

  const registered = await requestTokenAndRegister(currentUser.id)
  if (!registered) return { success: false, reason: 'register_failed' }

  writeOptOut(currentUser.id, false)
  return { success: true }
}

// Fire-and-forget - call on app boot (if already signed in with permission already granted) and
// right after a successful login/Google callback. Intentionally silent: this is a background
// refresh, not a user-initiated action, so it must never surface an error toast or throw into its
// caller.
export async function syncPushToken() {
  try {
    if (!isPushConfigured()) return
    const supported = await isPushSupportedInBrowser()
    if (!supported) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const currentUser = useAuthStore.getState().currentUser
    if (!currentUser?.id) return
    if (readOptOut(currentUser.id)) return // user explicitly clicked Disable - never silently re-enable

    const messaging = await getMessagingInstance()
    if (!messaging || !VAPID_KEY) return

    const registration = await getServiceWorkerRegistration()
    if (!registration) return

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token) return

    ensureForegroundListener()

    const stored = readStoredDevice(currentUser.id)
    const previousDeviceId = stored?.deviceId

    // Re-register even when the token is unchanged - the backend treats this as a last_seen
    // refresh (still 200), which is the whole point of calling this on every boot/login.
    const result = await registerPushDevice({ token, platform: 'web', label: deviceLabel() })

    if (result.success) {
      writeStoredDevice(currentUser.id, { deviceId: result.id, token, tokenSuffix: result.tokenSuffix })
      // The token changed under us (rotation) and the backend gave it a different device id than
      // the one we had stored - best-effort clean up the stale registration.
      if (previousDeviceId && previousDeviceId !== result.id) {
        deletePushDevice(previousDeviceId).catch(() => {})
      }
      return
    }

    if (result.status === 409) {
      await deleteToken(messaging).catch(() => {})
      await requestTokenAndRegister(currentUser.id, { retrying: true })
      return
    }

    if (result.status === 422) {
      console.warn('[push] syncPushToken registration rejected (422):', result.error)
      return
    }

    console.error('[push] syncPushToken registration failed:', result.error)
  } catch (error) {
    console.error('[push] syncPushToken failed:', error)
  }
}

// Clears everything push-related for the current user: backend device registration, the local
// FCM token itself, and the localStorage pointer. Used both as the Profile page's explicit
// "Disable" action and (as disablePushForLogout) from the logout flow - in both cases this must
// never throw, since logout has to complete regardless of what happens here. Deliberately never
// touches the opt-out flag itself - that's the caller's job (disablePush sets it,
// disablePushForLogout must NOT).
async function disablePushInternal() {
  const currentUser = useAuthStore.getState().currentUser
  if (!currentUser?.id) return

  const stored = readStoredDevice(currentUser.id)

  if (stored?.deviceId) {
    await deletePushDevice(stored.deviceId).catch(() => {})
  }

  // deleteToken(messaging) with no serviceWorkerRegistration operates on whatever registration
  // the SDK happens to default to, which may not be OUR /firebase-messaging-sw.js?config
  // registration at all - that can delete the wrong token (or silently no-op) and leave ours
  // live. Binding a getToken() call to our own registration first ensures `messaging` actually
  // targets our token before deleting it. Only attempted when permission is granted - with no
  // permission there's nothing real to delete anyway.
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const messaging = await getMessagingInstance()
      if (messaging && VAPID_KEY) {
        const registration = await getServiceWorkerRegistration()
        if (registration) {
          await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => {})
        }
        await deleteToken(messaging).catch(() => {})
      }
    }
  } catch {
    // best-effort
  }

  writeStoredDevice(currentUser.id, null)
}

// The Profile page's explicit "Disable" button - sets the opt-out flag so a granted browser
// permission can never silently re-register a device on the next boot/login (see syncPushToken).
export async function disablePush() {
  try {
    const currentUser = useAuthStore.getState().currentUser
    await disablePushInternal()
    if (currentUser?.id) writeOptOut(currentUser.id, true)
    return { success: true }
  } catch (error) {
    console.error('[push] disablePush failed:', error)
    return { success: false }
  }
}

// Called from api/auth.js's logout() BEFORE the server logout call, while the access token is
// still valid - wrapped so a failure here can never block the user from actually logging out.
// Deliberately does NOT set the opt-out flag: logging out isn't "I don't want notifications," so
// signing back in (or another user signing in on this browser) should get a clean slate, not be
// silently treated as opted out.
export async function disablePushForLogout() {
  try {
    await disablePushInternal()
  } catch (error) {
    console.error('[push] disablePushForLogout failed (non-blocking):', error)
  }
}
