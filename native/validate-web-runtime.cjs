'use strict'

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { parseReadyUrl } = require('./electron/ready-url.cjs')

async function validateWebRuntime(nodeBin, dshBin) {
  const taskData = fs.mkdtempSync(join(tmpdir(), 'dsh-web-check-'))
  const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TMP', 'TEMP', 'LANG'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
  env.DSH_HOME = taskData
  env.DSH_TELEMETRY_DISABLED = '1'
  const proc = spawn(nodeBin, [dshBin, 'web', '--port', '0', '--no-open'], { cwd: taskData, env, stdio: ['ignore', 'pipe', 'pipe'] })
  const closed = new Promise(resolve => proc.once('close', resolve))
  let timer
  let output = ''
  try {
    const url = await new Promise((resolve, reject) => {
      const diagnostic = () => output.slice(-2000).replace(/token=[^\s&)]+/g, 'token=[REDACTED_SECRET]')
      timer = setTimeout(() => reject(new Error('readiness timeout: ' + diagnostic())), 90000)
      proc.once('error', reject)
      proc.once('exit', code => reject(new Error(`web runtime exited ${code}: ${diagnostic()}`)))
      const onData = data => {
        output = (output + data).slice(-65536)
        const url = parseReadyUrl(output)
        if (url) resolve(url)
      }
      proc.stdout.on('data', onData)
      proc.stderr.on('data', onData)
    })
    clearTimeout(timer)
    let response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (response.status === 303) {
      // Match the browser's token -> cookie -> clean-root exchange. Never
      // send its cookie to a different origin, and never print the token.
      if (response.headers.get('location') !== '/') throw new Error('unexpected authentication redirect')
      const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
      if (!cookie) throw new Error('authentication redirect did not issue a cookie')
      response = await fetch(new URL('/', url), { headers: { Cookie: cookie }, redirect: 'manual', signal: AbortSignal.timeout(15000) })
    }
    if (response.status !== 200) throw new Error(`unexpected web HTTP ${response.status}`)
    if (!/<html|<!doctype/i.test(await response.text())) throw new Error('web runtime did not return HTML')
    console.log('PASS: bundled web runtime serves HTML (authenticated when required), HTTP 200')
  } finally {
    clearTimeout(timer)
    if (proc.pid && proc.exitCode === null && proc.signalCode === null) proc.kill('SIGTERM')
    const killTimer = setTimeout(() => { if (proc.pid) proc.kill('SIGKILL') }, 5000)
    await closed
    clearTimeout(killTimer)
    fs.rmSync(taskData, { recursive: true, force: true })
  }
}

module.exports = { validateWebRuntime }
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('usage: validate-web-runtime.cjs <node binary> <dsh entry>')
  validateWebRuntime(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1 })
}
