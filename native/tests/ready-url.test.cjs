'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { parseReadyUrl } = require('../electron/ready-url.cjs')

test('keeps the complete process authentication token and supports legacy URLs', () => {
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:12345/?token=test-token\n'), 'http://127.0.0.1:12345/?token=test-token')
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:12345\n'), 'http://127.0.0.1:12345/')
})
test('does not mistake partial tokens, other logs, or foreign hosts for readiness', () => {
  for (const output of ['dsh web: http://127.0.0.1:12345/?token=partial', 'log http://127.0.0.1:12345\n', 'dsh web: http://127.0.0.1.example.com:12345/\n', 'dsh web: http://127.0.0.1:12345@evil.example/\n']) {
    assert.equal(parseReadyUrl(output), null)
  }
})
test('uses loopback, not the separately announced LAN URL', () => {
  assert.equal(parseReadyUrl('dsh web: http://127.0.0.1:12345/?token=local (LAN: http://192.168.1.2:12345/?token=lan)\n'), 'http://127.0.0.1:12345/?token=local')
})
