import { useEffect, useState } from 'react'
import { getWarehouse } from '../api/warehouses'

// Some purchase/GRN responses include only the warehouse ID. Resolve that exact
// record for display; never select a different warehouse or change the payload.
export function useWarehouseName(warehouseId, suppliedName = '') {
  const [resolved, setResolved] = useState({ id: '', name: '' })

  useEffect(() => {
    if (!warehouseId || suppliedName) return undefined
    let active = true
    getWarehouse(warehouseId).then((result) => {
      if (active) setResolved({ id: warehouseId, name: result.success ? result.warehouse?.name || '' : '' })
    })
    return () => { active = false }
  }, [warehouseId, suppliedName])

  return suppliedName || (resolved.id === warehouseId ? resolved.name : '')
}
