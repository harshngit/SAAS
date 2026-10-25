import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { parseSync } from 'rolldown/utils'

const source = await readFile(new URL('../src/features/orders/CreateSalesOrder.jsx', import.meta.url), 'utf8')
const parsed = parseSync('CreateSalesOrder.jsx', source)
assert.equal(parsed.errors.length, 0)
function walk(value, nodes = []) {
  if (!value || typeof value !== 'object') return nodes
  if (value.type) nodes.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, nodes))
    else if (child && typeof child === 'object') walk(child, nodes)
  }
  return nodes
}
const nodes = walk(parsed.program)
const evaluate = (node, context) => new Function(...Object.keys(context), `return (${source.slice(node.start, node.end)})`)(...Object.values(context))
const declaration = (name) => nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === name).init
const resolveCustomerAddress = evaluate(declaration('resolveCustomerAddress'), {})

test('saved customer address supports list and profile responses and skips blank values', () => {
  assert.equal(resolveCustomerAddress({ delivery_address: ' Saved address ' }), 'Saved address')
  assert.equal(resolveCustomerAddress({ address_information: { shipping_address: 'Shipping', billing_address: 'Billing' } }), 'Shipping')
  assert.equal(resolveCustomerAddress({ deliveryAddress: '  ', shippingAddress: 'Shipping', billingAddress: 'Billing' }), 'Shipping')
  assert.equal(resolveCustomerAddress({ billing_address: 'Billing' }), 'Billing')
  assert.equal(resolveCustomerAddress(null), '')
})

test('restore saved customer address replaces a manual override and clears its error', () => {
  const button = nodes.find((node) => node.type === 'JSXAttribute' && node.name.name === 'onClick'
    && source.slice(node.start, node.end).includes('setDeliveryAddress(savedCustomerAddress)'))
  let deliveryAddress = 'Manual address', errors = { deliveryAddress: 'Required', items: 'Keep item error' }
  evaluate(button.value.expression, {
    savedCustomerAddress: 'Saved customer address',
    setDeliveryAddress: (value) => { deliveryAddress = value },
    setErrors: (fn) => { errors = fn(errors) },
  })()
  assert.equal(deliveryAddress, 'Saved customer address')
  assert.equal(errors.deliveryAddress, '')
  assert.equal(errors.items, 'Keep item error')
})

test('customer selection fills the real address immediately and same-customer selection preserves edits', () => {
  const changeNode = nodes.find((node) => node.type === 'JSXAttribute' && node.name.name === 'onChange'
    && source.slice(node.start, node.end).includes('setSelectedCustomerId'))
  const customerRecords = [{ id: 'a', delivery_address: 'Address A' }, { id: 'b', shippingAddress: 'Address B' }, { id: 'empty' }]
  let selectedCustomerId = 'a', deliveryAddress = 'Custom delivery address', errors = { deliveryAddress: 'Required' }
  const select = (id) => evaluate(changeNode.value.expression, {
    selectedCustomerId, customerRecords, resolveCustomerAddress,
    setSelectedCustomerId: (value) => { selectedCustomerId = value },
    setDeliveryAddress: (value) => { deliveryAddress = value },
    setErrors: (fn) => { errors = fn(errors) },
  })({ target: { value: id } })
  select('a')
  assert.equal(deliveryAddress, 'Custom delivery address')
  select('b')
  assert.equal(deliveryAddress, 'Address B')
  assert.equal(errors.deliveryAddress, '')
  select('empty')
  assert.equal(deliveryAddress, '')
  select('a')
  assert.equal(deliveryAddress, 'Address A')
  select('')
  assert.equal(deliveryAddress, '')
})

test('home delivery validates the editable address; takeaway does not require it', () => {
  const validate = (deliveryAddress, deliveryType = 'delivery_boy') => {
    let errors
    const valid = evaluate(declaration('validateForm'), {
      selectedCustomer: { id: 'a', delivery_address: 'Saved customer address' },
      deliveryDate: '2026-10-19', orderItems: [{ quantity: 1, unitPrice: 75 }],
      availableProducts: [], validateVariantItems: () => '', paymentMethod: 'upi',
      restrictToVehicleStock: false, deliveryType, deliveryAddress,
      visibleErrors: (errors) => errors,
      setErrors: (value) => { errors = value },
    })()
    return { valid, errors }
  }
  assert.equal(validate('Address A').valid, true)
  assert.equal(validate('Custom address').valid, true)
  assert.match(validate('').errors.deliveryAddress, /required/)
  assert.match(validate('   ').errors.deliveryAddress, /required/)
  assert.equal(validate('', 'pickup').valid, true)
})

test('create request uses the actual trimmed address and omits it for takeaway', () => {
  const request = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'createOrder').arguments[0]
  const address = request.properties.find((property) => property.key.name === 'deliveryAddress').value
  assert.equal(evaluate(address, { isHomeDelivery: true, deliveryAddress: '  Custom address  ' }), 'Custom address')
  assert.equal(evaluate(address, { isHomeDelivery: false, deliveryAddress: 'Custom address' }), undefined)
})
