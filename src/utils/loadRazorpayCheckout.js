// Loads the Razorpay Checkout script once, on demand (only when the user actually clicks Pay -
// never on every page load), and shares it across the whole app. Mirrors googleMaps.js's pattern.
let loadPromise = null

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay)
      else {
        loadPromise = null
        reject(new Error('Razorpay Checkout failed to initialize. Please try again.'))
      }
    }
    script.onerror = () => {
      loadPromise = null
      script.remove()
      reject(new Error('Could not load Razorpay Checkout. Check your internet connection and try again.'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
