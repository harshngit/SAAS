// Shared Excel export - every "Export"/"Download" action in the app goes through this, so every module
// produces the same kind of workbook.
//
// WHY A CUSTOM WRITER: the `xlsx` (SheetJS community) package cannot write cell styles, frozen panes or
// wrapped text (those are Pro-only), and new npm packages are not allowed. This file therefore writes the
// OOXML parts itself and zips them with a tiny built-in zip writer. Nothing else in the app depends on it.
//
// WHAT EVERY WORKBOOK GETS
//   - one clean header row: bold white text on a single navy fill, thin borders, wrapped, vertically centred
//   - frozen header row + autofilter on every column
//   - sensible min/max column widths (never "raw content length"); long text wraps inside the cell
//   - real Excel types: dates (dd mmm yyyy), date-times (dd mmm yyyy, hh:mm AM/PM), ₹ amounts, numbers;
//     IDs / SKUs / phone numbers / order numbers stay text (no scientific notation, no lost leading zeros)
//   - friendly status labels (partially_paid -> Partially Paid), one blank standard (empty cell, never
//     null / undefined / N/A / - / —)
//   - one file-name pattern: <module>_<yyyy-mm-dd>.xlsx (or <module>_<from>_to_<to>.xlsx), and a readable
//     sheet name (Leads, Customers, ...)
//
// HOW CALLERS USE IT
//   exportRowsToExcel('leads', rows, 'Leads', { columns, dateRange })
//   `rows` is an array of arrays, the first row is the header. Callers should pass RAW values (Date objects or
//   ISO strings for dates, numbers for money/quantities, enum strings for statuses). Optional `columns[i]`
//   = { type, width, wrap } overrides what is inferred from the header + values. Existing callers that still
//   pass UI-formatted strings ("₹ 1,180.00", "27 Nov 2026") are parsed back into real cells.

const TYPES = ['text', 'longtext', 'date', 'datetime', 'currency', 'number', 'integer', 'status', 'phone', 'email', 'id']

// ---------------------------------------------------------------- header / value inference

const FORCE_TEXT_HEADER = /(^|\b)(id|sku|code|mobile|phone|contact no|(order|delivery|invoice|quotation|receipt|purchase|return|grn|challan) ?(no\.?|number|#)|reference|ref|gstin|pan|ifsc|account (no|number)|pin ?code|zip|employee id|lead id|vehicle (no|number)|registration|batch|barcode|hsn)(?![a-z0-9])/i
const PHONE_HEADER = /\b(mobile|phone|contact no|whatsapp)\b/i
const EMAIL_HEADER = /\bemail\b/i
const DATETIME_HEADER = /(date ?& ?time|date ?\/ ?time|timestamp|date time|datetime|logged at|sent at|generated at|created at|updated at)/i
const DATE_HEADER = /\b(date|created|updated|modified|due|valid( until)?|follow-?up|last (order|visit|activity|login)|converted on|expires|joined|since|deadline)\b/i
const CURRENCY_HEADER = /\b(amount|total|price|value|paid|balance|outstanding|payable|receivable|revenue|cost|salary|discount|subtotal|pipeline|collected|tax)\b/i
const STRONG_QUANTITY_HEADER = /\b(qty|quantity|count|units|items|variants)\b/i
const WEAK_QUANTITY_HEADER = /\b(products|orders|visits|hours|days|stock|low stock)\b/i
const STATUS_HEADER = /\b(status|stage|outcome|priority)\b/i
const LONG_TEXT_HEADER = /(note|description|address|remark|comment|message|reason|interested product|categories|subcategories|details|location|summary)/i

const BLANK_MARKERS = new Set(['', '-', '—', '–', 'n/a', 'na', 'null', 'undefined', 'nan', 'none'])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isBlankValue(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'number') return Number.isNaN(value)
  if (typeof value === 'string') return BLANK_MARKERS.has(value.trim().toLowerCase())
  return false
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// "27 Nov 2026", "05 Sep 2026 · 10:00 AM", "27 Nov 2026, 06:15 PM"  (the app's own display formats)
function parseDisplayDate(text) {
  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})(?:[ ,·]+(\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?)?$/.exec(text)
  if (!match) return null
  const month = MONTHS.indexOf(match[2].toLowerCase())
  if (month < 0) return null
  let hour = match[4] ? Number(match[4]) : 0
  if (match[7]) {
    const pm = match[7].toLowerCase() === 'pm'
    if (pm && hour < 12) hour += 12
    if (!pm && hour === 12) hour = 0
  }
  return { date: new Date(Number(match[3]), month, Number(match[1]), hour, match[5] ? Number(match[5]) : 0, match[6] ? Number(match[6]) : 0), hasTime: Boolean(match[4]) }
}

// ISO: "2026-11-27", "2026-11-26T18:43:48.311895Z" (instant -> shown in the user's local time, same as the screen)
function parseIsoDate(text) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number)
    return { date: new Date(year, month - 1, day), hasTime: false }
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) {
    const date = new Date(text.includes('T') || /[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text.replace(' ', 'T'))
    if (!Number.isNaN(date.getTime())) return { date, hasTime: true }
  }
  return null
}

function parseDateLike(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : { date: value, hasTime: value.getHours() + value.getMinutes() + value.getSeconds() > 0 }
  if (typeof value !== 'string') return null
  const text = value.trim()
  return parseIsoDate(text) || parseDisplayDate(text)
}

// "₹ 1,23,456.78", "₹1,180.00", "-₹ 20.00", "(₹ 20.00)"
function parseMoneyText(text) {
  const match = /^(-)?\s*₹\s*(-)?\s*([\d,]+(?:\.\d+)?)$/.exec(text.trim())
  if (!match) return null
  const number = Number(match[3].replace(/,/g, ''))
  return Number.isFinite(number) ? (match[1] || match[2] ? -number : number) : null
}

export function friendlyStatus(value) {
  const text = String(value).trim()
  if (!text) return ''
  // snake_case / lower-case enum -> Title Case. Text that already has capitals is left alone.
  if (text === text.toLowerCase() || /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(text)) {
    return text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return text
}

function resolveColumnKind(header, override) {
  if (override?.type && TYPES.includes(override.type)) return override.type
  const text = String(header ?? '')
  if (PHONE_HEADER.test(text)) return 'phone'
  if (EMAIL_HEADER.test(text)) return 'email'
  if (STATUS_HEADER.test(text) && !DATE_HEADER.test(text)) return 'status'
  if (DATETIME_HEADER.test(text)) return 'datetime'
  if (DATE_HEADER.test(text) && !CURRENCY_HEADER.test(text)) return 'date'
  if (STRONG_QUANTITY_HEADER.test(text)) return 'number'
  if (FORCE_TEXT_HEADER.test(text)) return 'id'
  if (CURRENCY_HEADER.test(text)) return 'currency'
  if (LONG_TEXT_HEADER.test(text)) return 'longtext'
  if (WEAK_QUANTITY_HEADER.test(text)) return 'number'
  return 'text'
}

// A cell that carries its own type, for sheets whose rows mix types in one column (a Metric / Value summary):
//   xlCell('currency', 1180)   xlCell('integer', 12)   xlCell('date', '2026-11-27')
export function xlCell(type, value) {
  return { __xl: true, type, value }
}

// -> { kind: 'blank'|'text'|'date'|'datetime'|'currency'|'number'|'integer', value }
function normalizeCell(raw, columnKind) {
  if (raw && typeof raw === 'object' && raw.__xl) return normalizeCell(raw.value, raw.type === 'integer' ? 'integer' : raw.type)
  if (isBlankValue(raw)) return { kind: 'blank' }
  // Internal ids are never exported: a bare UUID in a cell means the API had no readable value for it.
  if (typeof raw === 'string' && UUID_PATTERN.test(raw.trim())) return { kind: 'blank' }
  if (typeof raw === 'boolean') return { kind: 'text', value: raw ? 'Yes' : 'No' }

  // Text-only columns never become numbers/dates (phone numbers, SKUs, order numbers).
  if (columnKind === 'phone' || columnKind === 'id' || columnKind === 'email') return { kind: 'text', value: String(raw).trim() }
  if (columnKind === 'status') return { kind: 'text', value: friendlyStatus(raw) }

  const dateLike = parseDateLike(raw)
  if (dateLike && (columnKind === 'date' || columnKind === 'datetime' || raw instanceof Date || typeof raw === 'string')) {
    const wantsTime = columnKind === 'datetime' || (columnKind !== 'date' && dateLike.hasTime)
    return { kind: wantsTime ? 'datetime' : 'date', value: dateLike.date }
  }

  if (typeof raw === 'number') {
    if (columnKind === 'currency') return { kind: 'currency', value: raw }
    if (columnKind === 'integer') return { kind: 'integer', value: raw }
    return { kind: Number.isInteger(raw) ? 'integer' : 'number', value: raw }
  }

  if (typeof raw === 'string') {
    const money = parseMoneyText(raw)
    if (money !== null) return { kind: 'currency', value: money }
    if ((columnKind === 'currency' || columnKind === 'number' || columnKind === 'integer') && /^-?[\d,]+(\.\d+)?$/.test(raw.trim()) && !/^0\d/.test(raw.trim())) {
      const number = Number(raw.trim().replace(/,/g, ''))
      if (Number.isFinite(number)) return { kind: columnKind === 'currency' ? 'currency' : Number.isInteger(number) ? 'integer' : 'number', value: number }
    }
    return { kind: 'text', value: raw.replace(/ /g, ' ').trim() }
  }

  return { kind: 'text', value: String(raw) }
}

// ---------------------------------------------------------------- widths (min/max per kind, never raw length)

const WIDTH_BOUNDS = {
  id: [14, 26],
  phone: [14, 16],
  email: [22, 36],
  date: [14, 14],
  datetime: [24, 24],
  currency: [14, 18],
  number: [10, 14],
  integer: [10, 14],
  status: [14, 22],
  text: [14, 32],
  longtext: [26, 46],
}

function columnKindForLayout(kind, cells) {
  // A "date" header can hold only text labels; fall back to the real content for layout.
  if ((kind === 'date' || kind === 'datetime') && cells.length && !cells.some((cell) => cell.kind === 'date' || cell.kind === 'datetime')) return 'text'
  if (kind === 'currency' && cells.length && !cells.some((cell) => cell.kind === 'currency' || cell.kind === 'number' || cell.kind === 'integer')) return 'text'
  return kind
}

function computeWidth(header, kind, cells, override) {
  if (override?.width) return Math.max(6, Math.min(80, override.width))
  const [min, max] = WIDTH_BOUNDS[kind] || WIDTH_BOUNDS.text
  let longest = 0
  for (const cell of cells) {
    let length = 0
    if (cell.kind === 'text') length = Math.max(...String(cell.value).split('\n').map((line) => line.length), 0)
    else if (cell.kind === 'currency') length = 16
    else if (cell.kind === 'date') length = 14
    else if (cell.kind === 'datetime') length = 24
    else if (cell.kind === 'number' || cell.kind === 'integer') length = String(cell.value).length + 2
    if (length > longest) longest = length
  }
  const headerWord = Math.max(...String(header ?? '').split(/\s+/).map((word) => word.length), 0) + 3
  return Math.max(min, Math.min(max, Math.max(Math.ceil(longest * 1.1) + 2, headerWord)))
}

// ---------------------------------------------------------------- OOXML

const xmlEscape = (text) =>
  String(text)
    // XML 1.0 forbids most control characters
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function columnLetter(index) {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

// Excel serial date: whole days since 1899-12-30 + fraction of the day, using the LOCAL clock (what the user sees on screen).
function excelSerial(date, withTime) {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round(utcMidnight / 86400000) + 25569
  if (!withTime) return days
  const fraction = (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86400
  return days + fraction
}

// numFmt ids
const FMT = { date: 164, datetime: 165, currency: 166, number: 167, integer: 168 }

// cellXfs layout (index = style id). Data styles: 0 text, 1 text-wrap, 2 date, 3 datetime, 4 currency, 5 number, 6 integer. 7 = header.
const STYLE = { text: 0, textWrap: 1, date: 2, datetime: 3, currency: 4, number: 5, integer: 6, header: 7 }

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5">
<numFmt numFmtId="${FMT.date}" formatCode="dd\\ mmm\\ yyyy"/>
<numFmt numFmtId="${FMT.datetime}" formatCode="dd\\ mmm\\ yyyy,\\ hh:mm\\ AM/PM"/>
<numFmt numFmtId="${FMT.currency}" formatCode="&quot;₹&quot;\\ #,##0.00;[Red]\\-&quot;₹&quot;\\ #,##0.00"/>
<numFmt numFmtId="${FMT.number}" formatCode="#,##0.00"/>
<numFmt numFmtId="${FMT.integer}" formatCode="#,##0"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FF1E3A8A"/></left><right style="thin"><color rgb="FF1E3A8A"/></right><top style="thin"><color rgb="FF1E3A8A"/></top><bottom style="thin"><color rgb="FF1E3A8A"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="${FMT.date}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="${FMT.datetime}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="${FMT.currency}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
<xf numFmtId="${FMT.number}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
<xf numFmtId="${FMT.integer}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
}

const CHARS_PER_WIDTH_UNIT = 1.05 // average text is a little narrower than the "0" the width unit is based on
const LINE_HEIGHT = 15

// Estimated wrapped line count of a text in a column `width` wide.
function wrappedLines(text, width) {
  const perLine = Math.max(4, Math.floor(width * CHARS_PER_WIDTH_UNIT))
  return String(text)
    .split('\n')
    .reduce((total, paragraph) => {
      const words = paragraph.split(/\s+/)
      let lines = 1
      let used = 0
      for (const word of words) {
        let remaining = word.length
        if (used === 0) {
          // first word on the line
        } else if (used + 1 + remaining <= perLine) {
          used += 1 + remaining
          continue
        } else {
          lines += 1
          used = 0
        }
        while (remaining > perLine) {
          lines += 1
          remaining -= perLine
        }
        used = remaining
      }
      return total + lines
    }, 0)
}

function sheetXml({ headers, columns, cellRows }) {
  const columnCount = headers.length
  const lastColumn = columnLetter(Math.max(columnCount - 1, 0))
  const lastRow = cellRows.length + 1

  const cols = columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width.toFixed(2)}" customWidth="1"/>`)
    .join('')

  const headerCells = headers
    .map((header, index) => `<c r="${columnLetter(index)}1" s="${STYLE.header}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(header ?? '')}</t></is></c>`)
    .join('')
  const headerLines = Math.max(
    1,
    ...headers.map((header, index) => wrappedLines(String(header ?? ''), columns[index].width - 1)),
  )
  const rowsXml = [`<row r="1" ht="${Math.max(24, headerLines * LINE_HEIGHT + 8)}" customHeight="1">${headerCells}</row>`]

  cellRows.forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2
    let maxLines = 1
    const cellsXml = cells
      .map((cell, columnIndex) => {
        const ref = `${columnLetter(columnIndex)}${rowNumber}`
        const column = columns[columnIndex]
        if (cell.kind === 'blank') {
          // keep the border / alignment, but no value
          return `<c r="${ref}" s="${column.wrap ? STYLE.textWrap : STYLE.text}"/>`
        }
        if (cell.kind === 'text') {
          if (column.wrap) maxLines = Math.max(maxLines, wrappedLines(cell.value, column.width))
          return `<c r="${ref}" s="${column.wrap ? STYLE.textWrap : STYLE.text}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`
        }
        if (cell.kind === 'date') return `<c r="${ref}" s="${STYLE.date}"><v>${excelSerial(cell.value, false)}</v></c>`
        if (cell.kind === 'datetime') return `<c r="${ref}" s="${STYLE.datetime}"><v>${excelSerial(cell.value, true)}</v></c>`
        if (cell.kind === 'currency') return `<c r="${ref}" s="${STYLE.currency}"><v>${Number(cell.value)}</v></c>`
        if (cell.kind === 'integer') return `<c r="${ref}" s="${STYLE.integer}"><v>${Number(cell.value)}</v></c>`
        return `<c r="${ref}" s="${STYLE.number}"><v>${Number(cell.value)}</v></c>`
      })
      .join('')
    // Rows with wrapped text get an explicit, capped height so the sheet reads cleanly in every viewer.
    const height = maxLines > 1 ? ` ht="${Math.min(maxLines, 10) * LINE_HEIGHT + 2}" customHeight="1"` : ''
    rowsXml.push(`<row r="${rowNumber}"${height}>${cellsXml}</row>`)
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rowsXml.join('')}</sheetData>
<autoFilter ref="A1:${lastColumn}${lastRow}"/>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

function safeSheetName(name) {
  const cleaned = String(name || 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31)
  return cleaned || 'Sheet1'
}

function workbookParts(sheets) {
  const sheetOverrides = sheets
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')
  const sheetEntries = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')
  const filterNames = sheets
    .map((sheet, index) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${xmlEscape(`'${sheet.name.replace(/'/g, "''")}'`)}!$A$1:$${sheet.lastColumn}$${sheet.lastRow}</definedName>`)
    .join('')
  const sheetRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('')
  return {
    contentTypes: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    rootRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    workbook: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets>${sheetEntries}</sheets><definedNames>${filterNames}</definedNames></workbook>`,
    workbookRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  }
}

// ---------------------------------------------------------------- zip (deflate when the browser supports it, else stored)

let crcTable = null
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

async function zipFiles(files) {
  const encoder = new TextEncoder()
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const chunks = []
  const central = []
  let offset = 0

  const u16 = (value) => [value & 0xff, (value >>> 8) & 0xff]
  const u32 = (value) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const raw = encoder.encode(file.content)
    const compressed = await deflateRaw(raw)
    const useDeflate = compressed && compressed.length < raw.length
    const data = useDeflate ? compressed : raw
    const method = useDeflate ? 8 : 0
    const crc = crc32(raw)
    const localHeader = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0),
    ])
    chunks.push(localHeader, nameBytes, data)
    central.push({ nameBytes, method, crc, size: data.length, rawSize: raw.length, offset })
    offset += localHeader.length + nameBytes.length + data.length
  }

  const centralStart = offset
  for (const entry of central) {
    const header = Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(entry.method), ...u16(dosTime), ...u16(dosDate),
      ...u32(entry.crc), ...u32(entry.size), ...u32(entry.rawSize), ...u16(entry.nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(entry.offset),
    ])
    chunks.push(header, entry.nameBytes)
    offset += header.length + entry.nameBytes.length
  }
  const centralSize = offset - centralStart
  chunks.push(Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(centralSize), ...u32(centralStart), ...u16(0)]))
  return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ---------------------------------------------------------------- public API

const pad2 = (n) => String(n).padStart(2, '0')
export const localDateStamp = (date = new Date()) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

// "Audit Log" / "audit-log" / "Vehicle Load History" -> audit_log   (an embedded yyyy-mm-dd keeps its dashes)
function fileBase(name) {
  const dates = []
  const masked = String(name || 'export')
    .replace(/\.xlsx$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}/g, (match) => {
      dates.push(match)
      return `xdx${dates.length - 1}x`
    })
  return masked
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/xdx(\d+)x/g, (_, index) => dates[Number(index)])
}

// <module>_<yyyy-mm-dd>.xlsx   |   <module>_<from>_to_<to>.xlsx   (a name that already has a date is kept as is)
export function buildExportFilename(name, dateRange) {
  const base = fileBase(name)
  if (/\d{4}-\d{2}-\d{2}/.test(base)) return `${base}.xlsx`
  if (dateRange?.from && dateRange?.to) {
    return dateRange.from === dateRange.to ? `${base}_${dateRange.from}.xlsx` : `${base}_${dateRange.from}_to_${dateRange.to}.xlsx`
  }
  return `${base}_${localDateStamp()}.xlsx`
}

function defaultSheetName(name) {
  return fileBase(name)
    .replace(/_\d{4}-\d{2}-\d{2}.*$/, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// One sheet: rows[0] is the header. Returns what sheetXml needs plus the layout that was chosen.
function layoutSheet(rows, sheetName, options = {}) {
  const [headerRow = [], ...dataRows] = rows.filter((row, index) => index === 0 || (Array.isArray(row) && row.length > 0))
  const headers = headerRow.map((header) => (header === null || header === undefined ? '' : String(header)))
  const overrides = options.columns || []

  const columnKinds = headers.map((header, index) => resolveColumnKind(header, overrides[index]))
  const cellRows = dataRows.map((row) => headers.map((_, index) => normalizeCell(row[index], columnKinds[index])))

  const columns = headers.map((header, index) => {
    const cells = cellRows.map((row) => row[index]).filter((cell) => cell.kind !== 'blank')
    const layoutKind = columnKindForLayout(columnKinds[index], cells)
    const override = overrides[index]
    const wrap = override?.wrap ?? (layoutKind === 'longtext' || layoutKind === 'text' || layoutKind === 'status' || layoutKind === 'email' || layoutKind === 'id')
    return { kind: layoutKind, wrap: Boolean(wrap), width: computeWidth(header, layoutKind, cells, override) }
  })

  return {
    name: safeSheetName(sheetName),
    headers,
    columns,
    cellRows,
    rowCount: dataRows.length,
    lastColumn: columnLetter(Math.max(headers.length - 1, 0)),
    lastRow: dataRows.length + 1,
  }
}

// sheets: [{ name, rows, columns? }]  (rows[0] = header row)
export async function buildExcelWorkbookFromSheets(sheets) {
  const used = new Set()
  const laid = sheets.map((sheet, index) => {
    const layout = layoutSheet(sheet.rows, sheet.name || `Sheet${index + 1}`, { columns: sheet.columns })
    let name = layout.name
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${layout.name.slice(0, 28)} ${n}`
    used.add(name.toLowerCase())
    return { ...layout, name }
  })
  const parts = workbookParts(laid)
  const blob = await zipFiles([
    { name: '[Content_Types].xml', content: parts.contentTypes },
    { name: '_rels/.rels', content: parts.rootRels },
    { name: 'xl/workbook.xml', content: parts.workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: parts.workbookRels },
    { name: 'xl/styles.xml', content: stylesXml() },
    ...laid.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet) })),
  ])
  return { blob, sheets: laid }
}

// Single-sheet convenience (used by the tests): returns the first sheet's layout.
export async function buildExcelWorkbook(rows, sheetName, options = {}) {
  const { blob, sheets } = await buildExcelWorkbookFromSheets([{ name: sheetName, rows, columns: options.columns }])
  return { blob, sheetName: sheets[0].name, columns: sheets[0].columns, rowCount: sheets[0].rowCount, columnCount: sheets[0].headers.length }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.parentNode?.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export async function exportRowsToExcel(filename, rows, sheetName, options = {}) {
  const { blob } = await buildExcelWorkbookFromSheets([{ name: sheetName || defaultSheetName(filename), rows, columns: options.columns }])
  downloadBlob(blob, buildExportFilename(filename, options.dateRange))
}

// Several sheets in one workbook: sheets = [{ name, rows, columns? }]
export async function exportSheetsToExcel(filename, sheets, options = {}) {
  const { blob } = await buildExcelWorkbookFromSheets(sheets)
  downloadBlob(blob, buildExportFilename(filename, options.dateRange))
}
