// Loads the Google Maps JavaScript API once and shares it across the whole app.
// The API key comes from the .env file (VITE_GOOGLE_MAPS_API_KEY).

let loadPromise = null
let authFailed = false
const authFailureListeners = new Set()

const AUTH_FAILURE_MESSAGE =
  'Google Maps rejected the API key. Check: (1) website restrictions end with /* (e.g. http://localhost:5173/*), ' +
  '(2) Maps JavaScript API and Geocoding API are enabled, (3) billing is active. Changes can take 5 minutes.'

// Google calls window.gm_authFailure when the key is not allowed. This can happen even
// AFTER the script has loaded, so screens subscribe here to show a clear error.
window.gm_authFailure = () => {
  authFailed = true
  authFailureListeners.forEach((listener) => listener(AUTH_FAILURE_MESSAGE))
}

export function onGoogleMapsAuthFailure(listener) {
  if (authFailed) listener(AUTH_FAILURE_MESSAGE)
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

// Readable message for a failed geocoder call.
export function describeGeocodeError(error) {
  const code = error?.code || error?.message || ''
  if (String(code).includes('REQUEST_DENIED')) {
    return 'Address lookup was denied. Enable "Geocoding API" for this key in Google Cloud.'
  }
  if (String(code).includes('OVER_QUERY_LIMIT')) return 'Too many lookups right now. Wait a moment and try again.'
  if (String(code).includes('ZERO_RESULTS')) return 'No place found. Try adding the area or city name.'
  return 'No place found. Try adding the area or city name.'
}

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

export function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps)
  if (loadPromise) return loadPromise

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Google Maps API key is missing. Add VITE_GOOGLE_MAPS_API_KEY to the .env file.'))
  }

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__crmGoogleMapsReady'

    window[callbackName] = () => {
      delete window[callbackName]
      resolve(window.google.maps)
    }

    const script = document.createElement('script')
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&v=weekly&region=IN&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      loadPromise = null
      script.remove()
      reject(new Error('Could not load Google Maps. Check your internet connection.'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

// Turns a Google geocoder result into the simple address pieces our forms use.
export function addressPartsFromGeocode(result) {
  const parts = {}
  for (const component of result?.address_components || []) {
    const types = component.types || []
    if (types.includes('locality')) parts.city = component.long_name
    else if (!parts.city && types.includes('administrative_area_level_3')) parts.city = component.long_name
    else if (!parts.city && types.includes('administrative_area_level_2')) parts.city = component.long_name
    if (types.includes('administrative_area_level_1')) parts.state = component.long_name
    if (types.includes('country')) parts.country = component.long_name
    if (types.includes('postal_code')) parts.pinZipCode = component.long_name
  }
  parts.formattedAddress = result?.formatted_address || ''
  return parts
}
