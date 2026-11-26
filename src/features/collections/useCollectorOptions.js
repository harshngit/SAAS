import { useEffect, useMemo, useState } from 'react'
import { listDeliveryPartners } from '../../api/deliveries'
import { COLLECTION_DEMO_ENABLED } from './deliveryCollectionDemoData'

// Options for the "Delivery Partner / Collected By" FILTER only. Names shown in the table and drawer come straight
// from the collection API (collected_by_name, delivery_partner_name, ...) - nothing is looked up for display.
// The delivery partner list is one request for the dropdown; anyone else who collected money (an admin or accountant)
// is added from the names already on the loaded rows.
export default function useCollectorOptions(rows) {
  const [partners, setPartners] = useState([])

  useEffect(() => {
    if (COLLECTION_DEMO_ENABLED) return undefined
    let cancelled = false
    listDeliveryPartners().then((result) => {
      if (!cancelled && result.success) setPartners(result.partners)
    })
    return () => { cancelled = true }
  }, [])

  return useMemo(() => {
    const options = new Map(partners.map((partner) => [partner.id, partner.name || 'Delivery partner']))
    rows.forEach((row) => {
      const id = row.deliveryPartnerId || row.recordedById
      const name = row.recordedByName || row.deliveryPartnerName
      if (id && name && !options.has(id)) options.set(id, name)
    })
    return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [partners, rows])
}
