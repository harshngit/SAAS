import { useCallback, useEffect, useRef, useState } from 'react'
import { LocateFixed, MapPin, Search } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import { addressPartsFromGeocode, describeGeocodeError, loadGoogleMaps, onGoogleMapsAuthFailure } from '../../utils/googleMaps'

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }

const round = (value) => Math.round(value * 1e6) / 1e6

/**
 * A map popup. The pin stays in the middle of the map; the person drags the map
 * (or searches / clicks / uses current location) until the pin sits on the right spot,
 * then presses "Use this location".
 *
 * onSelect receives: { lat, lng, formattedAddress, city, state, country, pinZipCode }
 */
export default function MapPickerModal({ isOpen, onClose, onSelect, initialPosition }) {
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const geocoderRef = useRef(null)
  const geocodeTimerRef = useRef(null)

  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('')
  const [position, setPosition] = useState(null)
  const [addressInfo, setAddressInfo] = useState(null)
  const [lookingUpAddress, setLookingUpAddress] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)

  const lookUpAddress = useCallback((lat, lng) => {
    clearTimeout(geocodeTimerRef.current)
    geocodeTimerRef.current = setTimeout(() => {
      if (!geocoderRef.current) return
      setLookingUpAddress(true)
      geocoderRef.current
        .geocode({ location: { lat, lng } })
        .then(({ results }) => setAddressInfo(results?.[0] ? addressPartsFromGeocode(results[0]) : null))
        .catch(() => setAddressInfo(null))
        .finally(() => setLookingUpAddress(false))
    }, 600)
  }, [])

  // If Google rejects the key (even after loading), replace the grey map with a clear error.
  useEffect(() => {
    if (!isOpen) return undefined
    return onGoogleMapsAuthFailure((message) => {
      setErrorMessage(message)
      setStatus('error')
    })
  }, [isOpen])

  // Build the map every time the popup opens.
  useEffect(() => {
    if (!isOpen) return undefined
    let cancelled = false
    let listeners = []

    setStatus('loading')
    setErrorMessage('')
    setSearchMessage('')
    setAddressInfo(null)

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapElementRef.current) return
        const hasStart = initialPosition && Number.isFinite(initialPosition.lat) && Number.isFinite(initialPosition.lng)
        const start = hasStart ? initialPosition : INDIA_CENTER

        const map = new maps.Map(mapElementRef.current, {
          center: start,
          zoom: hasStart ? 17 : 5,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })
        mapRef.current = map
        geocoderRef.current = new maps.Geocoder()

        listeners = [
          // Whenever the map stops moving, the centre is the chosen location.
          map.addListener('idle', () => {
            const center = map.getCenter()
            if (!center) return
            const lat = round(center.lat())
            const lng = round(center.lng())
            setPosition({ lat, lng })
            if (map.getZoom() >= 12) lookUpAddress(lat, lng)
            else setAddressInfo(null)
          }),
          // Clicking somewhere moves that spot under the pin.
          map.addListener('click', (event) => {
            if (event.latLng) map.panTo(event.latLng)
            if (map.getZoom() < 15) map.setZoom(17)
          }),
        ]
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setErrorMessage(error.message)
        setStatus('error')
      })

    return () => {
      cancelled = true
      clearTimeout(geocodeTimerRef.current)
      listeners.forEach((listener) => listener.remove())
      mapRef.current = null
    }
  }, [isOpen, initialPosition, lookUpAddress])

  const handleSearch = () => {
    const query = searchText.trim()
    if (!query || !geocoderRef.current || !mapRef.current) return
    setSearching(true)
    setSearchMessage('')
    geocoderRef.current
      .geocode({ address: query, region: 'IN' })
      .then(({ results }) => {
        const best = results?.[0]
        if (!best) {
          setSearchMessage('No place found. Try adding the area or city name.')
          return
        }
        mapRef.current.setCenter(best.geometry.location)
        mapRef.current.setZoom(17)
      })
      .catch((error) => {
        console.error('Google geocode failed:', error)
        setSearchMessage(describeGeocodeError(error))
      })
      .finally(() => setSearching(false))
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchMessage('This browser cannot share your location.')
      return
    }
    setLocating(true)
    setSearchMessage('')
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false)
        mapRef.current?.setCenter({ lat: result.coords.latitude, lng: result.coords.longitude })
        mapRef.current?.setZoom(18)
      },
      () => {
        setLocating(false)
        setSearchMessage('Location access was blocked. Allow location in your browser, or search instead.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleConfirm = () => {
    if (!position) return
    onSelect({ ...position, ...(addressInfo || {}) })
    onClose()
  }

  const zoomedInEnough = mapRef.current ? mapRef.current.getZoom() >= 12 : false

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pick location on map"
      size="4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={status !== 'ready' || !position || !zoomedInEnough}>
            Use this location
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 focus-within:border-primary-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-500/12">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSearch()
                }
              }}
              placeholder="Search a shop, area, street or PIN code"
              disabled={status !== 'ready'}
              className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 py-2.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={status !== 'ready' || searching}
              className="inline-flex items-center gap-2 rounded-r-xl border-l border-neutral-200 px-3.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            >
              <Search className="size-4" aria-hidden="true" />
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          <Button variant="outline" onClick={handleUseCurrentLocation} loading={locating} disabled={status !== 'ready'}>
            {!locating && <LocateFixed className="size-4" aria-hidden="true" />}
            My current location
          </Button>
        </div>

        {searchMessage && <p className="text-xs text-red-600">{searchMessage}</p>}

        <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
          <div ref={mapElementRef} className="absolute inset-0" />

          {status === 'ready' && (
            // The pin is drawn on top of the map, fixed in the centre. Its tip marks the spot.
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <MapPin className="size-10 fill-red-500 text-red-700 drop-shadow-md" aria-hidden="true" />
            </div>
          )}

          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">Loading map…</div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-50 p-6 text-center text-sm text-red-600">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm">
          {status === 'ready' && !zoomedInEnough ? (
            <p className="text-neutral-500">Zoom in and move the map so the red pin sits exactly on the customer's place.</p>
          ) : (
            <>
              <p className="font-medium text-neutral-900">
                {lookingUpAddress ? 'Finding address…' : addressInfo?.formattedAddress || 'Move the map to place the pin'}
              </p>
              {position && (
                <p className="mt-0.5 text-xs text-neutral-500">
                  {position.lat}, {position.lng}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
