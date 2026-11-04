import { Component } from 'react'
import { RotateCw } from 'lucide-react'

// A route-level error boundary around the Outlet's Suspense boundary (Layout.jsx). Catches two
// things that would otherwise blank/crash the whole authenticated shell:
//   1. A stale lazy-chunk fetch failing because this tab has an old build's asset hashes and a
//      newer one has since been deployed ("Failed to fetch dynamically imported module", etc.) -
//      the one real risk React.lazy() route-splitting (AppRoutes.jsx) introduced.
//   2. Any other render error in the current page - so one broken page can never take down
//      Sidebar/Topbar/navigation with it; the error boundary itself sits inside Layout, so those
//      stay interactive and the user can navigate away even without reloading.
// React error boundaries must be class components - there is no hook equivalent.
const CHUNK_ERROR_PATTERN = /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to fetch/i

export default class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('[ChunkErrorBoundary]', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const isChunkError = CHUNK_ERROR_PATTERN.test(error?.message || '')

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-neutral-900">
            {isChunkError ? 'A new version is available' : 'Something went wrong loading this page'}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {isChunkError
              ? 'This tab is running an older build. Reload to get the latest version.'
              : 'Please reload the page. If this keeps happening, contact support.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Reload
          </button>
        </div>
      </div>
    )
  }
}
