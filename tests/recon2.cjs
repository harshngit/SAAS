// Read-only recon part 2: variant rows, media/documents upload controls, product detail layout of an existing QA product. Creates nothing.
const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page } = h
  await H.openCreate(page)
  await page.locator('label', { hasText: /multiple variants/i }).locator('input[type=checkbox]').first().check({ force: true })
  await H.tab(page, 'Variants & Attributes')
  console.log('attr inputs:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('input,textarea,select')).filter((e) => e.offsetParent).map((e) => [e.tagName, e.type, e.placeholder, e.getAttribute('aria-label')]))))
  await page.getByRole('button', { name: /new variant/i }).click(); await page.waitForTimeout(800)
  await page.getByRole('button', { name: /new variant/i }).click(); await page.waitForTimeout(800)
  await H.shot(page, '_recon-variant-rows', true)
  console.log('after 2x New Variant inputs:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('main input,main textarea,main select')).filter((e) => e.offsetParent).map((e) => [e.tagName, e.type, e.placeholder, e.getAttribute('aria-label'), e.value]))))
  console.log('table head:', (await page.locator('thead').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' || '))
  await H.tab(page, 'Product Images & Media')
  console.log('media file inputs:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('input[type=file]')).map((e) => [e.accept, e.multiple]))))
  console.log('media text:', (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ').split('Product Images & Media | Images')[1]?.slice(0, 600))
  await H.tab(page, 'Documents')
  console.log('docs file inputs:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('input[type=file]')).map((e) => [e.accept, e.multiple]))))
  // existing QA product detail (read-only)
  const found = await H.findProducts(page, 'QA-TEST GST Incl 118')
  console.log('existing qa product:', found.length, found[0] && found[0].id)
  if (found[0]) { await H.openDetail(page, found[0].id); await H.shot(page, '_recon-detail', true); console.log('detail text:', (await H.detailText(page)).slice(0, 1800)) }
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1) })
