'use strict'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { EventEmitter } = require('node:events')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const test = require('node:test')
const source = readFileSync(join(__dirname, '../electron/main.js'), 'utf8')
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

async function boot({ portable = false, choice = 0, platform = 'win32', check } = {}) {
  const calls = { spawns: [], urls: [], external: [], dialogs: [], timers: [], checks: [], errors: [] }
  let now = 10000000
  const updater = new EventEmitter()
  updater.checkForUpdatesAndNotify = updater.checkForUpdates = async () => {
    calls.checks.push(now)
    if (check) return check(updater)
    updater.emit('update-not-available', { version: '0.1.20' })
    return { updateInfo: { version: '0.1.20' } }
  }
  updater.quitAndInstall = () => { calls.installs = (calls.installs || 0) + 1 }
  const app = new EventEmitter()
  app.whenReady = () => Promise.resolve()
  app.getPath = name => `/audit/${name}`
  app.getVersion = () => '0.1.20'
  app.quit = () => {}
  const menuItem = { label: '检查更新…', enabled: true }
  const electron = {
    app, powerMonitor: new EventEmitter(),
    BrowserWindow: class {
      constructor() {
        this.webContents = new EventEmitter()
        this.webContents.setWindowOpenHandler = handler => { this.popupHandler = handler }
        calls.window = this
      }
      isDestroyed() { return false }
      loadURL(url) { calls.urls.push(url); return Promise.resolve() }
    },
    shell: { openExternal: url => { calls.external.push(url); return Promise.resolve() } },
    Menu: {
      buildFromTemplate: () => ({ getMenuItemById: () => menuItem }),
      setApplicationMenu: () => {},
    },
    dialog: {
      showMessageBoxSync: (_win, options) => { calls.dialogs.push(options); return choice },
      showMessageBox: async (_win, options) => { calls.dialogs.push(options); return { response: choice } },
    },
  }
  const sandbox = {
    require(name) {
      if (name === 'electron') return electron
      if (name === 'electron-updater') return { autoUpdater: updater }
      if (name === 'path') return require('node:path')
      if (name === './ready-url.cjs') return require('../electron/ready-url.cjs')
      if (name === 'fs') return { mkdirSync() {}, existsSync: () => true }
      if (name === 'child_process') return { spawn(...args) {
        const proc = new EventEmitter()
        proc.exitCode = null
        proc.signalCode = null
        proc.stdout = new EventEmitter()
        proc.stderr = new EventEmitter()
        proc.kill = signal => { calls.spawns.at(-1).signal = signal; return true }
        calls.spawns.push({ args, proc })
        return proc
      } }
      throw new Error(`unexpected module: ${name}`)
    },
    process: { platform, env: portable ? { PORTABLE_EXECUTABLE_DIR: '/portable' } : {}, resourcesPath: '/resources' },
    console: { error: (...args) => calls.errors.push(args) },
    setTimeout: (fn, ms) => { const timer = { fn, ms, repeat: false, unref() {} }; calls.timers.push(timer); return timer },
    setInterval: (fn, ms) => { const timer = { fn, ms, repeat: true, unref() {} }; calls.timers.push(timer); return timer },
    clearTimeout: timer => { if (timer) timer.cleared = true },
    clearInterval: timer => { if (timer) timer.cleared = true },
    Date: { now: () => now }, URL, encodeURIComponent,
  }
  vm.runInNewContext(source + '\nthis.audit = { checkForUpdates, isLocal };', sandbox)
  await flush()
  return { calls, updater, app, audit: sandbox.audit, menuItem, advance: ms => { now += ms } }
}

test('portable download opens releases; cancel does not', async () => {
  for (const choice of [0, 1]) {
    const { calls, audit } = await boot({ portable: true, choice })
    audit.checkForUpdates()
    assert.equal(calls.external.length, choice === 0 ? 1 : 0)
    if (choice === 0) assert.match(calls.external[0], /github.com\/1m01m0\/deepseek-harness-desktop\/releases/)
    assert.equal(calls.checks.length, 0)
  }
})

test('timeout retry waits for old exit, ignores stale output, then starts exactly once', async () => {
  const { calls } = await boot()
  const old = calls.spawns[0].proc
  calls.timers.find(t => t.ms === 60000).fn()
  assert.match(decodeURIComponent(calls.urls.at(-1)), /启动超时/)
  for (let i = 0; i < 2; i++) calls.window.webContents.emit('will-navigate', { preventDefault() {} }, 'dsh://retry')
  assert.equal(calls.spawns[0].signal, 'SIGTERM')
  assert.equal(calls.spawns.length, 1)
  old.stdout.emit('data', Buffer.from('dsh web: http://127.0.0.1:4444\n'))
  assert.ok(!calls.urls.includes('http://127.0.0.1:4444/'))
  old.exitCode = 0
  old.emit('exit', 0)
  await flush()
  assert.equal(calls.spawns.length, 2)
  old.stderr.emit('data', Buffer.from('dsh web: http://127.0.0.1:5555\n'))
  calls.spawns[1].proc.stdout.emit('data', Buffer.from('dsh web: http://127.0.0.1:6666\n'))
  assert.equal(calls.urls.at(-1), 'http://127.0.0.1:6666/')
})

test('spawn error renders a recoverable error and retry starts a new process', async () => {
  const { calls } = await boot()
  calls.spawns[0].proc.emit('error', new Error('spawn EACCES'))
  assert.match(decodeURIComponent(calls.urls.at(-1)), /EACCES/)
  calls.window.webContents.emit('will-navigate', { preventDefault() {} }, 'dsh://retry')
  await flush()
  assert.equal(calls.spawns.length, 2)
})

test('Windows rechecks periodically and throttles repeated focus events', async () => {
  const { calls, advance, app } = await boot()
  assert.equal(calls.checks.length, 1)
  const interval = calls.timers.find(t => t.repeat)
  assert.ok(interval)
  advance(interval.ms)
  interval.fn()
  await flush()
  assert.equal(calls.checks.length, 2)
  app.emit('browser-window-focus')
  await flush()
  assert.equal(calls.checks.length, 2)
  advance(interval.ms)
  app.emit('browser-window-focus')
  await flush()
  assert.equal(calls.checks.length, 3)
})

test('background failures stay quiet and a later periodic check retries', async () => {
  const { calls, advance } = await boot({ check: async () => { throw new Error('offline') } })
  assert.equal(calls.dialogs.length, 0)
  const interval = calls.timers.find(t => t.repeat)
  advance(interval.ms)
  interval.fn()
  await flush()
  assert.equal(calls.checks.length, 2)
})

test('manual check shows progress, avoids duplicate calls, and reports latest', async () => {
  let complete
  const { calls, audit, menuItem } = await boot({ check: updater => new Promise(resolve => {
    complete = () => { updater.emit('update-not-available', { version: '0.1.20' }); resolve({}) }
  }) })
  audit.checkForUpdates()
  audit.checkForUpdates()
  await flush()
  assert.equal(calls.checks.length, 1)
  assert.match(menuItem.label, /正在检查/)
  complete()
  await flush()
  assert.equal(calls.dialogs.length, 1)
  assert.match(calls.dialogs[0].message, /最新版本/)
  assert.equal(menuItem.enabled, true)
})

test('manual errors are visible once, even when updater both emits and rejects', async () => {
  const { calls, audit } = await boot({ check: async updater => {
    const error = new Error('offline')
    updater.emit('error', error)
    throw error
  } })
  audit.checkForUpdates()
  await flush()
  assert.equal(calls.dialogs.length, 1)
  assert.match(calls.dialogs[0].message, /offline/)
})

test('downloaded updates can be installed by a later manual check', async () => {
  const { calls, audit, updater } = await boot()
  updater.emit('update-downloaded', { version: '0.1.21' })
  await flush()
  audit.checkForUpdates()
  await flush()
  assert.equal(calls.checks.length, 1)
  assert.equal(calls.installs, 2)
})

test('local navigation accepts exact hosts, not hostname prefixes or credentials', async () => {
  const { audit } = await boot()
  for (const url of ['https://localhost.example.com/', 'http://127.0.0.1.example.com/', 'http://localhost@evil.example/', 'not a URL']) {
    assert.equal(audit.isLocal(url), false, url)
  }
  assert.equal(audit.isLocal('http://127.0.0.1:34567/'), true)
  assert.equal(audit.isLocal('http://localhost:34567/'), true)
})

test('desktop keeps no-open and automatic download/install-on-quit', async () => {
  const { calls, updater } = await boot()
  assert.ok(calls.spawns[0].args[1].includes('--no-open'))
  calls.spawns[0].proc.stdout.emit('data', Buffer.from('dsh web: http://127.0.0.1:34567\n'))
  assert.equal(calls.urls.at(-1), 'http://127.0.0.1:34567/')
  assert.equal(calls.external.length, 0)
  assert.equal(updater.autoDownload, true)
  assert.equal(updater.autoInstallOnAppQuit, true)
})

test('desktop waits for the full authenticated readiness URL before navigating', async () => {
  const { calls } = await boot()
  const splash = calls.urls.at(-1)
  calls.spawns[0].proc.stdout.emit('data', Buffer.from('dsh web: http://127.0.0.1:34567/?token=split'))
  assert.equal(calls.urls.at(-1), splash)
  calls.spawns[0].proc.stdout.emit('data', Buffer.from('-token\n'))
  assert.equal(calls.urls.at(-1), 'http://127.0.0.1:34567/?token=split-token')
  assert.equal(calls.external.length, 0)
})

test('retry escalates a stuck old process before accepting its replacement', async () => {
  const { calls } = await boot()
  const old = calls.spawns[0].proc
  calls.window.webContents.emit('will-navigate', { preventDefault() {} }, 'dsh://retry')
  calls.timers.find(timer => timer.ms === 5000).fn()
  assert.equal(calls.spawns[0].signal, 'SIGKILL')
  assert.equal(calls.spawns.length, 1)
  old.emit('exit', null)
  await flush()
  assert.equal(calls.spawns.length, 2)
})

test('checking while an update downloads reports progress without another download', async () => {
  const { calls, audit, updater } = await boot()
  updater.emit('update-available', { version: '0.1.21' })
  audit.checkForUpdates()
  await flush()
  assert.equal(calls.checks.length, 1)
  assert.match(calls.dialogs.at(-1).message, /后台下载/)
})
