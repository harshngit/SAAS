// Extra helpers for the retest (custom DatePicker, month names, stock lookup). Lives only in this run folder.
const L = require('./lib')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// trigger button of the custom DatePicker that belongs to the <label> whose text starts with labelText
function dateTrigger(root, labelText) {
  const t = labelText.replace(/"/g, '')
  return root.locator(`xpath=(//label[starts-with(normalize-space(.), "${t}")]/following::button[@data-datepicker-trigger="true"][1])`).first()
}

// how many visible NATIVE date inputs are on screen (must be 0 on migrated forms)
async function nativeDateCount(page) {
  return page.evaluate(() => [...document.querySelectorAll('input[type="date"]')].filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)).length)
}

// Opens the custom calendar for labelText and reports whether it is the app's calendar (not the browser one).
async function openCalendar(page, labelText) {
  const trigger = dateTrigger(page, labelText)
  await trigger.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {})
  const before = (await trigger.innerText({ timeout: 5000 })).trim()
  await trigger.click({ timeout: 5000 })
  const popover = page.locator('.app-calendar-popover')
  await popover.first().waitFor({ state: 'visible', timeout: 5000 })
  return { trigger, before, popover }
}

// Picks `day` of the month currently shown in the calendar (in-month cell only). Returns { before, after, iso }
async function pickDay(page, labelText, day) {
  const { trigger, before } = await openCalendar(page, labelText)
  const cell = page.locator('.app-calendar-popover .app-calendar-day').filter({ hasText: new RegExp(`^${day}$`) }).and(page.locator(':not(.text-neutral-300)')).first()
  await cell.click({ timeout: 5000 })
  await page.waitForTimeout(400)
  const after = (await trigger.innerText()).trim()
  const m = after.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  return { before, after, iso: m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
}

// all the ways the app may print a yyyy-mm-dd date; true if any is present in text
function hasDate(text, iso) {
  if (!iso) return false
  const [y, m, d] = iso.split('-')
  const day = String(Number(d))
  const forms = [iso, `${d}-${m}-${y}`, `${d}/${m}/${y}`, `${day} ${MONTHS[Number(m) - 1]} ${y}`, `${d} ${MONTHS[Number(m) - 1]} ${y}`, `${MONTHS[Number(m) - 1]} ${day}, ${y}`, `${MONTHS[Number(m) - 1]} ${d}, ${y}`]
  return forms.some((f) => text.includes(f))
}

async function stockRow(page, productName) {
  await page.goto(L.BASE + '/admin/inventory', { waitUntil: 'domcontentloaded' }); await L.settle(page, 12000)
  await page.locator('input[placeholder*="earch" i]:visible').last().fill(productName)
  await page.waitForTimeout(1800); await L.settle(page, 8000)
  return (await page.locator('tr', { hasText: productName }).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
}

module.exports = { dateTrigger, nativeDateCount, openCalendar, pickDay, hasDate, stockRow, MONTHS }
