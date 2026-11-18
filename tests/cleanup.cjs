// Cleanup: delete ONLY junk records created by this suite (T8 matrix, probes, duplicate-SKU/variant-duplicate/double-submit extras).
// Safety: id must be in state.created (created by this run) and the name must start with QA-PW- (after trim). Core test products are kept.
const H = require('./pw-helpers.cjs')
;(async () => {
  const h = await H.open(); const { page } = h
  const s = H.state()
  const junk = (s.created || []).filter((c) => /^(num:|probe|dupsku|dbl-extra|var-dup)/.test(c.key || '') && !c.deleted)
  const out = []
  for (const c of junk) {
    if (!/^QA-PW-/.test(String(c.name).trim())) { out.push([c.name, 'SKIPPED not QA-PW']); continue }
    const r = await H.api(page, '/products/' + c.id, { method: 'DELETE' })
    out.push([c.key + ' ' + String(c.name).trim().slice(0, 40), r.status])
    if (r.status < 300 || r.status === 404) c.deleted = true
  }
  H.setState({ created: s.created, cleanup: { attempted: junk.length, deleted: out.filter((o) => o[1] < 300 || o[1] === 404).length, log: out.filter((o) => !(o[1] < 300)).slice(0, 20) } })
  console.log('junk', junk.length, 'deleted', out.filter((o) => o[1] < 300 || o[1] === 404).length, 'not deleted', JSON.stringify(out.filter((o) => !(o[1] < 300 || o[1] === 404))))
  await H.close(h)
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1) })
