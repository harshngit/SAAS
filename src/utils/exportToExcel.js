// Shared Excel export helper - every "Export"/"Download" action across the app goes through this
// instead of hand-building a CSV string, so every listing page produces a real .xlsx workbook the
// same way. `xlsx` is dynamically imported so it only loads when someone actually exports, not as
// part of every page's initial bundle.
//
// `rows` is a plain array of arrays: the first row is the header, the rest are data rows - the
// same shape every existing CSV export already built, so callers only need to swap the final
// CSV-string + Blob + link-click block for a call to this function.
export async function exportRowsToExcel(filename, rows, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
