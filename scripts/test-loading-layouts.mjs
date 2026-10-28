import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'

let server, Loading, skeletons, presentation
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ default: Loading } = await server.ssrLoadModule('/src/components/ui/LoadingSpinner.jsx'))
  skeletons = await server.ssrLoadModule('/src/components/ui/Skeleton.jsx')
  presentation = await server.ssrLoadModule('/src/components/ui/ListPresentation.jsx')
})
after(async () => { await server?.close() })
const render = (props) => renderToStaticMarkup(React.createElement(Loading, { label: 'Loading test content', ...props }))
const walk = (value, nodes = []) => {
  if (!value || typeof value !== 'object') return nodes
  if (value.type) nodes.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, nodes))
    else if (child && typeof child === 'object') walk(child, nodes)
  }
  return nodes
}
const attr = (node, name) => node.attributes.find((item) => item.name?.name === name)?.value

test('Leads loading matches all nine real table columns, checkboxes and eight visible rows', async () => {
  const source = await readFile(new URL('../src/features/leads/LeadList.jsx', import.meta.url), 'utf8')
  const nodes = walk(parseSync('LeadList.jsx', source).program)
  const opening = nodes.find((node) => node.type === 'JSXOpeningElement' && node.name.name === 'LoadingSpinner')
  const value = attr(opening, 'columns').expression
  const columns = new Function(`return (${source.slice(value.start, value.end)})`)()
  assert.deepEqual(columns, ['', 'Lead', 'Contact', 'Source', 'Assigned To', 'Status', 'Next Follow-up', 'Created', 'Actions'])
  const html = render({ variant: 'table', columns, rows: 8, avatarColumn: 1, checkboxColumn: 0 })
  assert.equal((html.match(/<th\b/g) || []).length, 9)
  assert.equal((html.match(/<td\b/g) || []).length, 72)
  assert.doesNotMatch(html, /md:grid-cols-2 xl:grid-cols-3/)
  assert.match(html, /role="status"/)
  assert.match(html, /aria-busy="true"/)
})

test('admin dashboard reserves the filter bar, tall sales card, six KPIs and chart regions', () => {
  const html = render({ variant: 'dashboard', layout: 'admin' })
  assert.match(html, /xl:grid-cols-\[320px_minmax\(0,1fr\)\]/)
  assert.equal((html.match(/flex h-56 flex-col/g) || []).length, 6)
  assert.match(html, /h-80/)
  assert.match(html, /border-20/)
  assert.match(html, /height:85%/)
})

test('each configured page family renders non-interactive accessible placeholders', () => {
  for (const props of [
    { variant: 'dashboard', layout: 'accounts' }, { variant: 'dashboard', layout: 'sales' },
    { variant: 'dashboard', layout: 'delivery' }, { variant: 'dashboard', layout: 'analytics' },
    { variant: 'detail', layout: 'invoice' }, { variant: 'detail', layout: 'order' },
    { variant: 'detail', layout: 'product' }, { variant: 'detail', layout: 'profile' },
    { variant: 'form', sidebar: true }, { variant: 'settings', preview: true },
    { variant: 'activity' }, { variant: 'cards' }, { variant: 'stats' },
    { variant: 'report' }, { variant: 'fields' }, { variant: 'map' }, { variant: 'vehicle-stock' },
    { variant: 'list' }, { variant: 'payment' },
  ]) {
    const html = render(props)
    assert.match(html, /Loading test content/)
    assert.match(html, /aria-hidden="true"/)
    assert.doesNotMatch(html, /<button|<input|<select|<a\s/)
  }
})

test('summary cards preserve labels and hide temporary values until loaded', () => {
  const { ListSummary, ListStatCard } = presentation
  const card = React.createElement(ListStatCard, { label: 'Total Leads', value: '999999', delta: { label: 'Temporary count', positive: true } })
  const loading = renderToStaticMarkup(React.createElement(ListSummary, { loading: true }, card))
  assert.match(loading, /Total Leads/)
  assert.doesNotMatch(loading, /999999|Temporary count/)
  const ready = renderToStaticMarkup(React.createElement(ListSummary, { loading: false }, card))
  assert.match(ready, /999999/)
  assert.match(ready, /Temporary count/)
})

test('existing DataTable row skeleton stays valid table markup and uses real column alignment', () => {
  const html = renderToStaticMarkup(React.createElement('table', null, React.createElement('tbody', null,
    React.createElement(skeletons.TableSkeleton, { columns: [{ key: 'name' }, { key: 'amount', align: 'right' }], rows: 3 }))))
  assert.equal((html.match(/<tr\b/g) || []).length, 3)
  assert.equal((html.match(/<td\b/g) || []).length, 6)
  assert.match(html, /ml-auto w-16/)
  assert.match(html, /motion-reduce:animate-none/)
})

test('every existing LoadingSpinner call explicitly chooses its layout', async () => {
  let count = 0
  const root = new URL('../src/', import.meta.url)
  async function audit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) { await audit(path); continue }
      if (!entry.name.endsWith('.jsx')) continue
      const source = await readFile(path, 'utf8')
      if (!source.includes('<LoadingSpinner')) continue
      const parsed = parseSync(entry.name, source)
      assert.equal(parsed.errors.length, 0)
      for (const opening of walk(parsed.program).filter((node) => node.type === 'JSXOpeningElement' && node.name.name === 'LoadingSpinner')) {
        assert.ok(attr(opening, 'variant'), `${path.pathname}: missing explicit layout`)
        count += 1
      }
    }
  }
  await audit(root)
  assert.equal(count, 119)
})
