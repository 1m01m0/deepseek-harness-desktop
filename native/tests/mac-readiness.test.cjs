'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { mkdtempSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

test('native Swift readiness parser preserves authentication URLs', { skip: process.platform !== 'darwin' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-swift-test-'))
  try {
    const binary = join(dir, 'test')
    const compile = spawnSync('swiftc', [join(__dirname, '../mac-app/ServerURL.swift'), join(__dirname, 'ServerURLTests.swift'), '-o', binary], { encoding: 'utf8' })
    assert.equal(compile.status, 0, compile.stderr)
    const run = spawnSync(binary, [], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
