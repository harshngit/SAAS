// Builds a filter dropdown's options from the DISTINCT values already present in an
// already-loaded dataset - used for relationship filters (customer/supplier/partner/vehicle/
// category/submitted-by) on pages whose table loads its full result set client-side. Avoids a
// separate lookup API per filter (and the N+1 risk that implies) for pages that don't already
// have one.
export function uniqueOptions(rows, key, allLabel = 'All') {
  const seen = new Map()
  rows.forEach((row) => {
    const value = row[key]
    if (value && !seen.has(value)) seen.set(value, value)
  })
  return [{ value: 'all', label: allLabel }, ...Array.from(seen.values()).map((value) => ({ value, label: value }))]
}
