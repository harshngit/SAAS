import { getApp, getApps, initializeApp } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

// Public, build-time-baked values only (Firebase web config is not a secret - it identifies the
// project, not a credential). Never add a service-account/private key here or anywhere else in
// this app; that belongs exclusively to the backend.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId']

// Kept separate from firebaseConfig above (not part of the Firebase app-init schema, and must
// NOT be included in the service-worker registration query string) but is just as required -
// getToken() needs it, so treat it as part of "is this feature configured at all" too.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

// Whole push feature is opt-in per deployment - an environment that never set all six env vars
// (e.g. a fresh clone, or a deliberately push-less deployment) must behave exactly as if this
// feature doesn't exist: no errors, no UI, no network calls. Checked as a single all-or-nothing
// gate so a partially-configured deployment (e.g. VAPID key forgotten) never shows a working-
// looking "Enable" button that then silently fails.
export function isPushConfigured() {
  return REQUIRED_CONFIG_KEYS.every((key) => Boolean(firebaseConfig[key])) && Boolean(VAPID_KEY)
}

let appInstance = null

function getFirebaseApp() {
  if (!isPushConfigured()) return null
  if (!appInstance) {
    // Reuse an already-initialized app of the same name if one exists (StrictMode double-invoke,
    // or another part of the app initializing Firebase first) rather than throwing on a second
    // initializeApp() call.
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig)
  }
  return appInstance
}

let supportedPromise = null
let messagingInstance = null

// Lazy + memoized: only touches the browser's push/notification/indexedDB APIs (via
// firebase/messaging's own isSupported() check) the first time something actually asks for
// messaging, never at module load, so an unconfigured or unsupported environment pays no cost
// and throws nothing just by importing this module.
export async function getMessagingInstance() {
  if (!isPushConfigured()) return null

  if (!supportedPromise) {
    supportedPromise = isSupported().catch(() => false)
  }
  const supported = await supportedPromise
  if (!supported) return null

  if (!messagingInstance) {
    const app = getFirebaseApp()
    if (!app) return null
    messagingInstance = getMessaging(app)
  }
  return messagingInstance
}

// Sync-friendly capability check for UI gating (Profile page status) - does the one-time async
// isSupported() check and caches it, without forcing every caller to await getMessagingInstance.
export async function isPushSupportedInBrowser() {
  if (!isPushConfigured()) return false
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false
  }
  if (!supportedPromise) {
    supportedPromise = isSupported().catch(() => false)
  }
  return supportedPromise
}
