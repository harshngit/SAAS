// Client-side PDF export = a pixel-accurate screenshot of an on-screen DOM node, saved as a
// paginated A4 PDF. Used for the invoice-detail "Download PDF" and the Invoice Settings
// "Download Sample PDF" — so the file always matches whatever template / branding / field
// toggles the user is currently previewing.
//
// We drive html2canvas-pro + jsPDF directly instead of html2pdf.js: html2pdf.js bundles a
// pre-2021 html2canvas that cannot parse the modern CSS colour functions Tailwind v4 emits
// (oklch(), color-mix()), which turned coloured header bands and status boxes black in the
// export. html2canvas-pro is a drop-in html2canvas fork that added oklch / oklab / lab / lch
// / color-mix() support.
const PDF_MARGIN_MM = 6
const PDF_RENDER_SCALE = 2

export async function exportElementToPdf(element, filename, { widthRem = 32 } = {}) {
  if (!element) {
    throw new Error('Invoice preview is not ready yet.')
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: PDF_RENDER_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    logging: false,
    // Same clone tweaks html2pdf.js used via its onclone: undo the on-screen zoom
    // transform, pin the export width, drop the shadow — so the file layout isn't
    // distorted by whatever zoom level the preview happens to be at. `widthRem` lets a
    // narrow template (thermal till-roll) export at its real width instead of 32rem.
    onclone(_clonedDoc, clonedElement) {
      const root = clonedElement || _clonedDoc.querySelector('[data-invoice-export-root]')
      if (root) {
        root.style.transform = 'none'
        root.style.width = `${widthRem}rem`
        root.style.maxWidth = '100%'
        root.style.boxShadow = 'none'
      }
    },
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidthMm = pdf.internal.pageSize.getWidth()
  const pageHeightMm = pdf.internal.pageSize.getHeight()
  const contentWidthMm = pageWidthMm - PDF_MARGIN_MM * 2
  const contentHeightMm = pageHeightMm - PDF_MARGIN_MM * 2

  // Canvas pixels per mm once the image is scaled to fit the content width, and how many
  // of those pixels fit in one page's printable height.
  const pxPerMm = canvas.width / contentWidthMm
  const pageSlicePx = Math.max(1, Math.floor(contentHeightMm * pxPerMm))

  let renderedPx = 0
  let pageIndex = 0

  // Slice the tall screenshot into page-height chunks and place each at (margin, margin) on
  // its own A4 page — this keeps a real 6mm margin on every page and paginates content taller
  // than one page, roughly matching html2pdf.js's multi-page behaviour.
  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageSlicePx, canvas.height - renderedPx)

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeightPx
    const context = pageCanvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    context.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

    const sliceHeightMm = sliceHeightPx / pxPerMm
    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(
      pageCanvas.toDataURL('image/jpeg', 0.98),
      'JPEG',
      PDF_MARGIN_MM,
      PDF_MARGIN_MM,
      contentWidthMm,
      sliceHeightMm,
      undefined,
      'FAST',
    )

    renderedPx += sliceHeightPx
    pageIndex += 1
  }

  pdf.save(filename)
}
