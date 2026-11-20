// GET /customers, /products, /suppliers, /quotations, /leads, /expenses ... return at most 100 rows per request.
// A caller that gives neither `page` nor `page_size` (a list page that filters and pages in the browser) wants the
// WHOLE list, so this keeps asking for the next page until `total` rows have arrived - otherwise row 101 onwards would
// silently never appear and the page's own count ("Showing 1-10 of N") would be wrong.
// A caller that does pass page / page_size (server-side paging, summaries) gets exactly that one page, as before.
export async function getPagedData(client, url, config, wantsAll) {
  const first = await client.get(url, config)
  if (!wantsAll) return first.data

  const firstData = first.data
  const firstRows = Array.isArray(firstData) ? firstData : Array.isArray(firstData?.items) ? firstData.items : []
  const total = Array.isArray(firstData) ? firstRows.length : (firstData?.total ?? firstRows.length)
  if (Array.isArray(firstData) || firstRows.length >= total || firstRows.length === 0) return firstData

  let rows = firstRows
  for (let page = 2; page <= 60 && rows.length < total; page += 1) {
    const next = await client.get(url, { ...config, params: { ...(config.params || {}), page } })
    const nextRows = Array.isArray(next.data) ? next.data : Array.isArray(next.data?.items) ? next.data.items : []
    if (nextRows.length === 0) break
    rows = rows.concat(nextRows)
  }
  return { ...firstData, items: rows, total }
}
