'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { isSafeAuthRedirect } = require('../validate-web-runtime.cjs')

const baseURL = 'http://127.0.0.1:62996/?token=secret'

test('web-runtime smoke check accepts relative and absolute same-origin clean-root redirects', () => {
  assert.equal(isSafeAuthRedirect('/', baseURL), true)
  assert.equal(isSafeAuthRedirect('http://127.0.0.1:62996/', baseURL), true)
})

test('web-runtime smoke check rejects external, credentialed, non-root, and query redirects', () => {
  for (const location of [
    '//example.com/',
    'http://user@127.0.0.1:62996/',
    '/settings',
    '/?token=secret',
    '/#fragment',
  ]) {
    assert.equal(isSafeAuthRedirect(location, baseURL), false, location)
  }
})
