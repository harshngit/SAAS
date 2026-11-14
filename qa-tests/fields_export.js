// Offline: reads fields-catalog.json (already fetched) and writes simple name-only exports. No network, no login.
const fs = require('fs')
const L = require('./lib')
const j = JSON.parse(fs.readFileSync(L.DIR + '/fields-catalog.json', 'utf8'))
const av = j.available_fields
const title = (m) => m.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
const out = {}
let md = '# All Fields - every module\n\n'
let total = 0
md += '| Module | Fields |\n|---|---|\n'
for (const [m, v] of Object.entries(av)) md += `| ${title(m)} | ${v.fields.length} |\n`
md += '\n'
for (const [m, v] of Object.entries(av)) {
  total += v.fields.length
  out[m] = v.fields.map((f) => ({ name: f.label || f.key, key: f.key, type: f.classification }))
  md += `## ${title(m)} (${v.fields.length})\n\n`
  v.fields.forEach((f, i) => { md += `${i + 1}. ${f.label || f.key}${f.classification === 'optional' ? '' : ` *(${f.classification})*`}\n` })
  md += '\n'
}
md += `**Total: ${total} fields**\n`
fs.writeFileSync(L.DIR + '/all-fields.md', md)
fs.writeFileSync(L.DIR + '/all-fields.json', JSON.stringify({ total, modules: out }, null, 2))
console.log('written', total)
