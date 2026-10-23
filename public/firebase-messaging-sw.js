// Background push handler. This file is served as a plain static file at the site ROOT
// (required for a service worker to control the whole origin) - Vite copies everything under
// public/ to the build output root unchanged, and the existing .htaccess SPA-fallback rule
// already only rewrites requests for paths that don't exist as a real file on disk, so this file
// is served as-is in both dev and production without any extra hosting config.
//
// A service worker cannot read import.meta.env, so the page registers this script with the
// Firebase web config passed as a query string (see src/push/pushService.js) and it's read back
// here from the registration URL.
//
// IMPORTANT: this version must match the "firebase" version pinned in package.json exactly -
// mismatched compat-script/SDK versions are a common source of silent push failures.
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js')

const params = new URL(location.href).searchParams
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
}

// Only initialize if the page actually handed us a real config - keeps this file inert (never
// throws, never registers a background handler) if it's ever requested without one.
if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    // The underlying Firebase Messaging SW SDK already auto-displays a notification itself
    // whenever the payload carries a `notification` block - calling showNotification here too
    // would show a SECOND copy. Only show one ourselves for data-only messages, which the SDK
    // never auto-displays.
    if (payload.notification) return

    const title = payload.data?.title || 'New notification'
    const body = payload.data?.body || ''

    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      data: payload.data || {},
    })
  })
}

// Clicking a background notification focuses an already-open tab if one exists, otherwise opens
// a new one - same "click_action" / "url" data field either the backend or a future foreground
// handler can set.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.click_action || event.notification.data?.url || '/'
  // client.url is always absolute - a relative targetUrl (e.g. "/orders/123") would never equal
  // it, so every click opened a new tab instead of focusing one already on that page. Resolve
  // both sides to the same absolute form before comparing.
  const target = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === target && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
      return undefined
    }),
  )
})
