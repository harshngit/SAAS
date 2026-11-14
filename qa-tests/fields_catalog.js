// READ-ONLY: logs in as ADMIN (creds from .env.qa.local, never printed) and GETs /organizations/settings/fields,
// then writes the full field catalog to fields-catalog.json + fields-catalog.md (no secrets inside).
const fs = require('fs')
const L = require('./lib')
;(async () => {
  const c = L.creds('ADMIN')
  const lr = await fetch(L.API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: c.email, password: c.password }) })
  const lj = await lr.json().catch(() => ({}))
  const token = lj.access_token || lj.data?.access_token || lj.tokens?.access_token
  if (!token) { console.log('login failed', lr.status); return }
  const r = await fetch(L.API + '/organizations/settings/fields', { headers: { authorization: 'Bearer ' + token } })
  const j = await r.json()
  fs.writeFileSync(L.DIR + '/fields-catalog.json', JSON.stringify(j, null, 2))
  const av = j.available_fields || {}
  let md = '# Object Field catalog (live backend, GET /organizations/settings/fields)\n\n'
  let total = 0
  for (const [mod, v] of Object.entries(av)) {
    const list = Array.isArray(v.fields) ? v.fields : []
    total += list.length
    md += `## ${mod} (${list.length} fields)\n\n| # | Key | Label | Classification | Depends on / condition |\n|---|---|---|---|---|\n`
    list.forEach((f, i) => { md += `| ${i + 1} | ${f.key} | ${f.label || ''} | ${f.classification} | ${f.depends_on || f.condition || ''} |\n` })
    md += '\n'
  }
  md += `**Total: ${total} fields across ${Object.keys(av).length} modules**\n`
  fs.writeFileSync(L.DIR + '/fields-catalog.md', md)
  console.log('status', r.status, 'modules', Object.keys(av).join(','), 'total', total)
  for (const [mod, v] of Object.entries(av)) console.log(mod, (v.fields || []).length)
})().catch((e) => console.error('ERR', String(e.message).split('\n')[0]))
