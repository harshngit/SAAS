import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { parseSync } from 'rolldown/utils'
import { z } from 'zod'
import { phoneConflictFields } from '../src/utils/phoneConflict.js'

let server, api, auth, store, users, events
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ apiClient: api } = await server.ssrLoadModule('/src/api/client.js'))
  auth = await server.ssrLoadModule('/src/api/auth.js')
  users = await server.ssrLoadModule('/src/api/users.js')
  ;({ useAuthStore: store } = await server.ssrLoadModule('/src/store/authStore.js'))
})
beforeEach(() => {
  events = []
  store.setState({ setAuthTokens: () => events.push('tokens'), setAuthenticatedSession: () => events.push('profile'), logout: () => events.push('logout') })
})
after(async () => server?.close())

test('send OTP sends E.164 phone and handles supplied/default cooldown', async () => {
  api.post = async (url, body) => {
    assert.equal(url, '/auth/phone/send-otp')
    assert.deepEqual(body, { phone: '+919876543210' })
    return { data: { detail: 'Code sent', resend_after: 45 } }
  }
  assert.deepEqual(await auth.sendPhoneOtp({ phone: '+919876543210' }), { success: true, detail: 'Code sent', resendAfter: 45 })
  api.post = async () => ({ data: { detail: 'Code sent' } })
  assert.equal((await auth.sendPhoneOtp({ phone: '+919876543210' })).resendAfter, 30)
})

test('OTP verification establishes tokens before fetching the role profile', async () => {
  api.post = async (url, body) => {
    assert.equal(url, '/auth/phone/verify-otp')
    assert.deepEqual(body, { phone: '+919876543210', code: '012345' })
    return { data: { access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'bearer' } }
  }
  api.get = async (url) => { assert.equal(url, '/auth/me'); events.push('me'); return { data: { user: { role: 'sales' } } } }
  const result = await auth.loginWithPhoneOtp({ phone: '+919876543210', code: '012345' })
  assert.equal(result.user.role, 'sales')
  assert.deepEqual(events, ['tokens', 'me', 'profile'])
})

test('email login retains its existing request and session flow', async () => {
  api.post = async (url, body) => {
    assert.equal(url, '/auth/login')
    assert.deepEqual(body, { email: 'user@example.com', password: 'test-password' })
    return { data: { access_token: 'test-access', refresh_token: 'test-refresh' } }
  }
  api.get = async () => ({ data: { user: { role: 'admin' } } })
  assert.equal((await auth.login({ email: ' USER@example.com ', password: 'test-password' })).success, true)
  assert.deepEqual(events, ['tokens', 'profile'])
})

test('send/verify failures preserve backend details and never establish a session', async () => {
  for (const status of [400, 429, 502, 503]) {
    api.post = async () => { throw { response: { status, data: { detail: 'Please try again later' } } } }
    assert.deepEqual(await auth.sendPhoneOtp({ phone: '+919876543210' }), { success: false, status, error: 'Please try again later' })
  }
  api.post = async () => { throw { response: { status: 400, data: { detail: 'Invalid OTP' } } } }
  assert.deepEqual(await auth.loginWithPhoneOtp({ phone: '+919876543210', code: '000000' }), { success: false, status: 400, error: 'Invalid OTP' })
  assert.deepEqual(events, [])
})

test('phone 401/429 responses bypass refresh/logout in the real interceptor', async () => {
  const reject = api.interceptors.response.handlers.find((item) => item?.rejected).rejected
  for (const url of ['/auth/phone/send-otp', '/auth/phone/verify-otp']) {
    for (const status of [400, 401, 429, 503]) {
      const error = { config: { url }, response: { status } }
      await assert.rejects(reject(error), (actual) => actual === error)
      assert.equal(error.config._retry, undefined)
    }
  }
  assert.deepEqual(events, [])
})

test('registration and staff writes expose phone conflicts without mislabeling email conflicts', async () => {
  assert.deepEqual(phoneConflictFields(409, 'Email already used'), {})
  assert.deepEqual(phoneConflictFields(400, 'Phone invalid'), {})
  const conflict = { response: { status: 409, data: { detail: 'Phone already used' } } }
  api.post = api.patch = async () => { throw conflict }
  const registration = await auth.registerOrganization({ organizationName: 'Test', adminName: 'Test', email: 'user@example.com', phone: '+919876543210', password: 'test-password' })
  assert.equal(registration.fieldErrors.phone, 'This mobile number is already assigned to another staff account')
  assert.equal((await users.updateUser('user-1', { phone: '+919876543210' })).fieldErrors.phone, 'This mobile number is already assigned to another staff account')
})

function walk(value, nodes = []) {
  if (!value || typeof value !== 'object') return nodes
  if (value.type) nodes.push(value)
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => walk(item, nodes))
    else if (child && typeof child === 'object') walk(child, nodes)
  }
  return nodes
}
const code = await readFile('src/features/auth/PhoneOtpLogin.jsx', 'utf8')
const parsed = parseSync('PhoneOtpLogin.jsx', code)
assert.equal(parsed.errors.length, 0)
const nodes = walk(parsed.program)
function evaluate(node, values) {
  return new Function(...Object.keys(values), `return (${code.slice(node.start, node.end)})`)(...Object.values(values))
}
function value(name, bindings) {
  return evaluate(nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === name).init, bindings)
}
const phoneSchema = value('phoneSchema', { z }), otpSchema = value('otpSchema', { z })
test('India phone and OTP validation accepts leading-zero OTP and rejects incomplete inputs', () => {
  assert.equal(phoneSchema.safeParse('9876543210').success, true)
  for (const number of ['1234567890', '98765', '+919876543210', '98765432100']) assert.equal(phoneSchema.safeParse(number).success, false)
  assert.equal(otpSchema.safeParse('012345').success, true)
  assert.equal(otpSchema.safeParse('12345').success, false)
})

test('send handler prefixes +91, starts the server cooldown, and blocks duplicate sends', async () => {
  let sent, deadline, seconds, error, finish
  const busy = { current: false }
  const send = value('sendOtp', { busy, disabled: false, sentPhone: '', phone: '9876543210', resendAt: 0, phoneSchema,
    mounted: { current: true }, setSending() {}, setError(message) { error = message }, setInfo() {}, setCode() {},
    setSentPhone(number) { sent = number }, setSecondsLeft(number) { seconds = number }, setResendAt(number) { deadline = number },
    sendPhoneOtp: () => new Promise((resolve) => { finish = resolve }),
  })
  const pending = send()
  await send()
  assert.equal(busy.current, true)
  finish({ success: true, resendAfter: 45 })
  await pending
  assert.equal(sent, '+919876543210')
  assert.equal(seconds, 45)
  assert.ok(deadline > Date.now() + 44000)
  assert.equal(error, '')
  assert.equal(busy.current, false)
})

test('six digit entry strips non-digits and auto-submits once; wrong-code errors remain inline', async () => {
  const calls = []
  const attribute = nodes.find((node) => node.type === 'JSXAttribute' && node.name.name === 'onChange' && code.slice(node.start, node.end).includes('verifyOtp(next)'))
  const change = evaluate(attribute.value.expression, { setCode() {}, setError() {}, verifyOtp(code) { calls.push(code) } })
  change({ target: { value: '123' } })
  change({ target: { value: '01 2345' } })
  assert.deepEqual(calls, ['012345'])
  let error, signedIn = false
  const verify = value('verifyOtp', { busy: { current: false }, disabled: false, sentPhone: '+919876543210', code: '012345', otpSchema,
    mounted: { current: true }, setVerifying() {}, setError(message) { error = message }, handleOtpError(result) { error = result.error }, onSuccess() { signedIn = true },
    loginWithPhoneOtp: async () => ({ success: false, error: 'Wrong OTP' }),
  })
  await verify()
  assert.equal(error, 'Wrong OTP')
  assert.equal(signedIn, false)
})

test('resend countdown follows elapsed time and cleans up its timer', () => {
  const effect = nodes.find((node) => node.type === 'CallExpression' && node.callee.name === 'useEffect' && code.slice(node.start, node.end).includes('setInterval(update'))
  let now = 100000, tick, cleared = false
  const values = []
  const cleanup = evaluate(effect.arguments[0], {
    resendAt: 130000, Date: { now: () => now }, setSecondsLeft(number) { values.push(number) },
    setInterval(callback, interval) { assert.equal(interval, 1000); tick = callback; return 'timer' },
    clearInterval(id) { assert.equal(id, 'timer'); cleared = true },
  })()
  now += 2300
  tick()
  now += 60000
  tick()
  assert.deepEqual(values, [30, 28, 0])
  cleanup()
  assert.equal(cleared, true)
})

test('email and phone share the same saved-location/role dashboard redirect', async () => {
  const source = await readFile('src/features/auth/Login.jsx', 'utf8')
  const ast = parseSync('Login.jsx', source)
  const node = walk(ast.program).find((item) => item.type === 'VariableDeclarator' && item.id.name === 'finishLogin').init
  for (const [from, role, expected] of [['/admin/products', 'sales', '/admin/products'], ['', 'sales', '/sales/dashboard'], ['', 'unknown', '/admin/dashboard']]) {
    let destination, loading
    const finish = new Function('location', 'roleHomePath', 'navigate', 'setIsRedirecting', `return (${source.slice(node.start, node.end)})`)(
      { state: { from: { pathname: from } } }, { sales: '/sales/dashboard' }, (path) => { destination = path }, (value) => { loading = value },
    )
    finish({ user: { role } })
    assert.equal(destination, expected)
    assert.equal(loading, true)
  }
})

test('forgot-password sends only email and never exposes a reset token', async () => {
  api.post = async (url, body) => {
    assert.equal(url, '/auth/forgot-password')
    assert.deepEqual(body, { email: 'staff@example.com' })
    return { data: { detail: 'Check your inbox', reset_token: 'must-not-be-exposed' } }
  }
  assert.deepEqual(await auth.forgotPassword({ email: ' Staff@example.com ' }), { success: true, detail: 'Check your inbox' })
  api.post = async () => { throw { response: { status: 429, data: { detail: 'Too many reset requests' } } } }
  assert.deepEqual(await auth.forgotPassword({ email: 'staff@example.com' }), { success: false, error: 'Too many reset requests' })
})

test('reset-password sends token and both password fields without creating a session', async () => {
  api.post = async (url, body) => {
    assert.equal(url, '/auth/reset-password')
    assert.deepEqual(body, { token: 'test-link-token', new_password: 'new-password', confirm_password: 'new-password' })
    return { data: { detail: 'Password changed' } }
  }
  assert.equal((await auth.resetPassword({ token: 'test-link-token', newPassword: 'new-password', confirmPassword: 'new-password' })).success, true)
  assert.deepEqual(events, [])
  api.post = async () => { throw { response: { status: 400, data: { detail: 'Invalid, expired or used reset link' } } } }
  assert.deepEqual(await auth.resetPassword({ token: 'used', newPassword: 'new-password', confirmPassword: 'new-password' }), { success: false, status: 400, error: 'Invalid, expired or used reset link', fieldErrors: {} })
})

test('reset page validates matching passwords and redirects only on successful reset', async () => {
  const source = await readFile('src/features/auth/ResetPassword.jsx', 'utf8')
  const ast = parseSync('ResetPassword.jsx', source)
  const all = walk(ast.program)
  const run = (name, values) => {
    const node = all.find((item) => item.type === 'VariableDeclarator' && item.id.name === name).init
    return new Function(...Object.keys(values), `return (${source.slice(node.start, node.end)})`)(...Object.values(values))
  }
  const schema = run('schema', { z })
  assert.equal(schema.safeParse({ newPassword: 'short', confirmPassword: 'short' }).success, false)
  assert.equal(schema.safeParse({ newPassword: 'new-password', confirmPassword: 'different-password' }).success, false)
  assert.equal(schema.safeParse({ newPassword: 'new-password', confirmPassword: 'new-password' }).success, true)
  let error, redirected, calls = 0, cleared = false
  const values = { token: 'link-token', setServerError(value) { error = value },
    useAuthStore: { getState: () => ({ logout() { cleared = true } }) }, navigate(...args) { redirected = args },
    resetPassword: async () => { calls++; return { success: false, error: 'This link was already used' } },
  }
  await run('onSubmit', values)({ newPassword: 'new-password', confirmPassword: 'new-password' })
  assert.equal(error, 'This link was already used')
  assert.equal(redirected, undefined)
  assert.equal(cleared, false)
  await run('onSubmit', { ...values, token: '' })({ newPassword: 'new-password', confirmPassword: 'new-password' })
  assert.equal(calls, 1)
  await run('onSubmit', { ...values, resetPassword: async () => ({ success: true }) })({ newPassword: 'new-password', confirmPassword: 'new-password' })
  assert.equal(cleared, true)
  assert.deepEqual(redirected, ['/login', { replace: true, state: { message: 'Password has been reset. Please log in.' } }])
})

test('reset-password is a public route directly under Routes', async () => {
  const source = await readFile('src/routes/AppRoutes.jsx', 'utf8')
  const ast = parseSync('AppRoutes.jsx', source)
  const routes = walk(ast.program).find((item) => item.type === 'JSXElement' && item.openingElement.name.name === 'Routes')
  assert.ok(routes.children.some((item) => item.type === 'JSXElement' && item.openingElement.name.name === 'Route'
    && item.openingElement.attributes.some((attribute) => attribute.name?.name === 'path' && attribute.value?.value === '/reset-password')))
})


test('Mobile failure statuses preserve field errors, suggest email, hide on 503, and throttle Resend on 429', () => {
  let error, hidden = false, deadline, seconds
  const handle = value('handleOtpError', { resendAt: 0, setError(message) { error = message }, onUnavailable() { hidden = true },
    setSecondsLeft(number) { seconds = number }, setResendAt(number) { deadline = number } })
  handle({ status: 400, error: 'Invalid or expired OTP' })
  assert.equal(error, 'Invalid or expired OTP')
  handle({ status: 422, error: 'Enter a valid number' })
  assert.equal(error, 'Enter a valid number')
  handle({ status: 502, error: 'Provider failed' })
  assert.equal(error, 'Mobile login is temporarily unavailable. Please use email login.')
  handle({ status: 429, error: 'Too many attempts. Please try again later.' })
  assert.equal(error, 'Too many attempts. Please try again later.')
  assert.equal(seconds, 30)
  assert.ok(deadline > Date.now())
  handle({ status: 503, error: 'Not configured' })
  assert.equal(hidden, true)
})

test('503 returns to Email and remembers Mobile is disabled for this session', async () => {
  const source = await readFile('src/features/auth/Login.jsx', 'utf8')
  const ast = parseSync('Login.jsx', source)
  const attr = walk(ast.program).find((node) => node.type === 'JSXAttribute' && node.name.name === 'onUnavailable')
  let method, available
  const saved = []
  const unavailable = new Function('sessionStorage', 'setMobileAvailable', 'setLoginMethod', 'setServerError', `return (${source.slice(attr.value.expression.start, attr.value.expression.end)})`)(
    { setItem(...args) { saved.push(args) } }, (value) => { available = value }, (value) => { method = value }, () => {},
  )
  unavailable()
  assert.equal(method, 'email')
  assert.equal(available, false)
  assert.deepEqual(saved, [['beas-mobile-login-disabled', 'true']])
})

test('reset-password maps 422 locations to the two password fields', async () => {
  api.post = async () => { throw { response: { status: 422, data: { detail: [
    { loc: ['body', 'new_password'], msg: 'Too short' },
    { loc: ['body', 'confirm_password'], msg: 'Must match' },
  ] } } } }
  const result = await auth.resetPassword({ token: 'link', newPassword: 'short', confirmPassword: 'other' })
  assert.equal(result.status, 422)
  assert.deepEqual(result.fieldErrors, { newPassword: 'Too short', confirmPassword: 'Must match' })
})
