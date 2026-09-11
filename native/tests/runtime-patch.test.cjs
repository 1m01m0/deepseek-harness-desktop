'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const source = readFileSync(join(__dirname, '../patch-dsh-runtime.cjs'), 'utf8').split('const changes = []')[0]

function patcher(files) {
  let writes = 0
  const sandbox = {
    process: { argv: ['node', 'patch', '/staged'] },
    require: name => name === 'fs' ? { readFileSync: file => files[file], writeFileSync: () => { writes++ } } : require(name),
  }
  vm.runInNewContext(source + '\nthis.patch = replaceOnce; this.files = pending;', sandbox)
  return { ...sandbox, writes: () => writes }
}

test('runtime patch tolerates indentation changes and remains idempotent', () => {
  const { patch, files, writes } = patcher({ bundle: 'function f() {\n\t\t\treturn oldValue;\n}' })
  const before = 'function f() {\n\treturn oldValue;\n}'
  const after = 'function f() {\n\treturn newValue;\n}'
  assert.equal(patch('bundle', before, after), true)
  assert.match(files.get('bundle'), /newValue/)
  assert.equal(patch('bundle', before, after), false)
  assert.equal(writes(), 0, 'updates are staged until all anchors validate')
})

test('unknown or duplicate anchors fail closed without writing partially patched files', () => {
  for (const contents of ['different code', 'oldValue;\noldValue;']) {
    const { patch, writes } = patcher({ first: 'oldValue;', second: contents })
    patch('first', 'oldValue;', 'newValue;')
    assert.throws(() => patch('second', 'oldValue;', 'newValue;'), /runtime not supported/)
    assert.equal(writes(), 0)
  }
})
