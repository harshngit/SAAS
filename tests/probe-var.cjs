const H = require('./pw-helpers.cjs'); const { L } = H
;(async () => {
  const h = await H.open(); const { page } = h
  await H.openCreate(page)
  await H.fillForm(page, { name: 'QA-PW-probe-var', sku: 'QA-PW-probe-var', categoryRe: /^Beverages$/, hasVariants: true, uom: false })
  console.log('after fillForm ok')
  await H.tab(page, 'Variants & Attributes')
  console.log('attr input count', await page.locator('input[placeholder="e.g. Color, Size"]').count())
  await page.locator('input[placeholder="e.g. Color, Size"]').fill('Size', { timeout: 5000 }).then(() => console.log('attr fill ok')).catch((e) => console.log('attr fill FAIL', e.message.split('\n')[0]))
  await page.getByRole('button', { name: /new variant/i }).click(); await page.waitForTimeout(600)
  console.log('variant name inputs', await page.locator('input[placeholder="e.g. Red / Large"]').count())
  await page.locator('input[placeholder="e.g. Red / Large"]').first().fill('Small', { timeout: 5000 }).then(() => console.log('name fill ok')).catch((e) => console.log('name fill FAIL', e.message.split('\n')[0]))
  await page.locator('input[aria-label="Variant 1 sellingPrice"]').fill('70', { timeout: 5000 }).then(() => console.log('sell fill ok')).catch((e) => console.log('sell fill FAIL', e.message.split('\n')[0]))
  console.log(JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('main input')).filter((e) => e.offsetParent).map((e) => [e.type, e.placeholder, e.getAttribute('aria-label'), e.disabled]))))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
