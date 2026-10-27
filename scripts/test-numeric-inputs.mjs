// Exercises the actual component's handlers/render props with a deterministic hook/event driver.
// No browser or live API calls; the driver explicitly models focus/click/change/blur ordering.
import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { transformWithOxc, createServer } from 'vite'
import { parseSync } from 'rolldown/utils'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let makeRenderer
const walk = (node, nodes = []) => {
  if (!node || typeof node !== 'object') return nodes
  if (node.type) nodes.push(node)
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, nodes))
    else if (child && typeof child === 'object') walk(child, nodes)
  }
  return nodes
}
before(async () => {
  const source = await readFile('src/components/ui/NumericInput.jsx', 'utf8')
  const nodes = walk(parseSync('NumericInput.jsx', source).program)
  const helper = nodes.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'selectZero')
  const render = nodes.find((node) => node.type === 'FunctionExpression' && node.id?.name === 'NumericInput')
  assert.ok(helper && render)
  const compiled = await transformWithOxc(`export function factory(useState) {
    ${source.slice(helper.start, helper.end)}
    return (${source.slice(render.start, render.end)})
  }`, 'NumericInputHarness.jsx', { jsx: { runtime: 'automatic' } })
  const code = compiled.code.replace(/from "([^"]+)"/g, (_, name) => `from "${import.meta.resolve(name)}"`)
  ;({ factory: makeRenderer } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`))
})

function inputDriver(initial, extra = {}) {
  const state = [], changes = [], blurs = []
  let index = 0, value = initial, element
  const native = { value: '', readOnly: Boolean(extra.readOnly), disabled: Boolean(extra.disabled), selections: 0,
    select() { this.selections++; this.start = 0; this.end = this.value.length } }
  const render = makeRenderer((initialState) => {
    const slot = index++
    if (!(slot in state)) state[slot] = initialState
    return [state[slot], (next) => { state[slot] = typeof next === 'function' ? next(state[slot]) : next }]
  })
  const ref = { current: null }
  const refresh = () => {
    index = 0
    element = render({ value, onChange: (event) => {
      changes.push(event.currentTarget.value)
      value = extra.coerce ? extra.coerce(event.currentTarget.value) : event.currentTarget.value
    }, onBlur: (event) => { blurs.push(event.currentTarget.value); extra.onBlur?.(event) }, ...extra }, ref)
    if (element.props.value !== undefined) native.value = String(element.props.value ?? '')
    native.start = native.end = native.value.length
  }
  const event = () => ({ currentTarget: native, target: native, defaultPrevented: false })
  const dispatch = (name) => { element.props[name](event()); refresh() }
  const enter = (raw) => { native.value = raw; dispatch('onChange') }
  refresh()
  return { native, changes, blurs, ref, dispatch, enter,
    get value() { return value }, get props() { return element.props },
    update(next) { value = next; refresh() },
    type(text) { const start = native.start ?? 0, end = native.end ?? start; enter(native.value.slice(0, start) + text + native.value.slice(end)) },
  }
}

for (const zero of [0, '0', '0.00', '-0']) {
  for (const initialCaret of [0, 1]) {
    test(`zero ${JSON.stringify(zero)}, caret ${initialCaret}: typing 8 replaces zero instead of producing 80`, () => {
      const input = inputDriver(zero, { coerce: (raw) => Number(raw) || 0 })
      input.native.start = input.native.end = initialCaret
      input.dispatch('onFocus')
      input.dispatch('onClick')
      assert.equal(input.native.value, '')
      assert.equal(input.changes.length, 0, 'focusing must not mutate the form model')
      input.type('8')
      assert.equal(input.value, 8)
      assert.equal(input.native.value, '8')
    })
  }
}

test('backspace stays empty while editing even when the parent immediately converts blank to zero', () => {
  const input = inputDriver(18, { coerce: (raw) => Number(raw) || 0 })
  input.dispatch('onFocus')
  input.enter('')
  assert.equal(input.value, 0)
  assert.equal(input.native.value, '')
  input.type('8')
  assert.equal(input.value, 8)
})
test('blur restores a legitimate zero and passes the unmodified blank to existing normalization', () => {
  const input = inputDriver(0, { coerce: (raw) => Number(raw) || 0 })
  input.dispatch('onFocus')
  input.dispatch('onBlur')
  assert.deepEqual(input.blurs, [''])
  assert.equal(input.value, 0)
  assert.equal(input.native.value, '0')
})
test('a deliberate zero remains a valid value', () => {
  const input = inputDriver(0)
  input.dispatch('onFocus')
  input.enter('0')
  input.dispatch('onBlur')
  assert.equal(input.native.value, '0')
})
test('nonzero numbers keep normal cursor editing', () => {
  const input = inputDriver(18)
  input.dispatch('onFocus')
  input.dispatch('onClick')
  assert.equal(input.native.value, '18')
  assert.equal(input.native.selections, 0)
  input.type('0')
  assert.equal(input.value, '180')
})
for (const raw of ['0.8', '-8', '12.50', '999999']) {
  test(`preserves the caller's raw ${raw} without clamping or rounding`, () => {
    const input = inputDriver(0)
    input.dispatch('onFocus')
    input.enter(raw)
    assert.equal(input.value, raw)
    assert.equal(input.native.value, raw)
  })
}
for (const attribute of ['disabled', 'readOnly']) {
  test(`${attribute} zero is never cleared or selected`, () => {
    const input = inputDriver(0, { [attribute]: true })
    input.dispatch('onFocus')
    input.dispatch('onClick')
    assert.equal(input.native.value, '0')
    assert.equal(input.native.selections, 0)
  })
}
test('validation/accessibility/ref props and custom event handlers are retained', () => {
  let focused = 0, clicked = 0
  const input = inputDriver(0, { required: true, min: -5, max: 20, step: 'any', 'aria-label': 'Amount',
    onFocus() { focused++ }, onClick() { clicked++ } })
  for (const [key, expected] of Object.entries({ required: true, min: -5, max: 20, step: 'any', 'aria-label': 'Amount' })) assert.equal(input.props[key], expected)
  assert.equal(input.props.ref, input.ref)
  input.dispatch('onFocus'); input.dispatch('onClick')
  assert.equal(focused, 1); assert.equal(clicked, 1)
})
test('external stepper updates show their new value while a field is empty', () => {
  const input = inputDriver(0)
  input.dispatch('onFocus')
  input.update(8)
  assert.equal(input.native.value, '8')
})
test('numeric-text quantity controls retain the native text default; explicit number fields retain their type', () => {
  assert.equal(inputDriver(0, { inputMode: 'numeric' }).props.type, 'text')
  assert.equal(inputDriver(0, { type: 'number' }).props.type, 'number')
})
test('shared Input covers numeric fields while password and telephone controls keep their types', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    const { default: Input } = await server.ssrLoadModule('/src/components/ui/Input.jsx')
    for (const type of ['number', 'password', 'tel', 'text']) {
      const html = renderToStaticMarkup(React.createElement(Input, { type, label: 'Value', value: type === 'number' ? 0 : 'test', onChange() {} }))
      assert.ok(html.includes(`type="${type}"`))
    }
  } finally { await server.close() }
})
test('all native numeric editors in the project use the shared behavior', async () => {
  let nativeNumerics = 0, sharedNumerics = 0
  const scan = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) { await scan(path); continue }
      if (!entry.name.endsWith('.jsx') || entry.name === 'NumericInput.jsx') continue
      const code = await readFile(path, 'utf8')
      for (const node of walk(parseSync(path, code).program)) {
        if (node.type !== 'JSXOpeningElement') continue
        if (node.name.name === 'NumericInput') sharedNumerics++
        if (node.name.name !== 'input') continue
        if (node.attributes.some((attr) => attr.name?.name === 'type' && attr.value?.value === 'number'
          || attr.name?.name === 'inputMode' && ['numeric', 'decimal'].includes(attr.value?.value))) nativeNumerics++
      }
    }
  }
  await scan('src')
  assert.equal(nativeNumerics, 0)
  assert.ok(sharedNumerics > 0)
})
