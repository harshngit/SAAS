import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Groups third-party deps that change far less often than our own code into their own vendor
// chunks, instead of all of it sitting in one entry bundle - page code (AppRoutes.jsx's
// React.lazy() routes) already splits per-route on top of this. Heavy one-off libs (firebase,
// xlsx, jspdf/html2canvas) are NOT listed here - they're dynamically import()'d only where used
// (push/firebase.js, push/pushService.js, utils/exportToExcel.js, utils/pdfExport.js), so Vite
// already gives each its own async chunk without needing a manualChunks rule.
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
  if (/node_modules\/react-router(-dom)?\//.test(id)) return 'vendor-router'
  if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-charts'
  if (id.includes('node_modules/zustand') || id.includes('node_modules/date-fns')) return 'vendor-utils'
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: { output: { manualChunks } },
  },
})
