// Cross-platform build for the Electron shell: download a Node binary, install
// the published @deepseek-ai/dsh runtime, validate it boots, then run
// electron-builder for the target platform.
//
//   node build.js                      # builds for the current platform
//   DSH_TARGET_PLATFORM=win32 node build.js
//
// Env: NODE_MAJOR (default 24), DSH_VERSION (default native/mac-app/DSH_VERSION),
//      DSH_TARGET_PLATFORM (win32|darwin|linux), DSH_TARGET_ARCH (x64|arm64).
'use strict'

const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DIR = __dirname
const STAGING = path.join(DIR, '.staging')
const VERSION_FILE = path.join(DIR, '..', 'mac-app', 'DSH_VERSION')

const NODE_MAJOR = process.env.NODE_MAJOR || '24'
const DSH_VERSION = process.env.DSH_VERSION
  || fs.readFileSync(VERSION_FILE, 'utf8').trim()

const platform = process.env.DSH_TARGET_PLATFORM || process.platform
const arch = process.env.DSH_TARGET_ARCH || (os.arch() === 'arm64' ? 'arm64' : 'x64')

const nodePlatform = platform === 'win32' ? 'win' : platform
const ext = platform === 'win32' ? 'zip' : 'tar.gz'
const targetFlag = { win32: '--win', darwin: '--mac', linux: '--linux' }[platform]

// On Windows, npm/npx are .cmd shims; spawn needs the explicit extension.
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

if (!targetFlag) {
  console.error(`unsupported platform: ${platform}`)
  process.exit(1)
}

function run(cmd, args, opts = {}) {
  console.log(`+ ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    // .cmd/.bat shims (npm, npx) are not PE executables; Windows needs a shell.
    shell: process.platform === 'win32',
    ...opts,
  })
  if (r.status !== 0) {
    console.error(`command failed: ${cmd}`)
    process.exit(r.status ?? 1)
  }
}

async function download(url, dest) {
  console.log(`downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
  console.log(`  -> ${dest} (${(buf.length / 1e6).toFixed(1)} MB)`)
}

async function validate(nodeBin, dshBin) {
  console.log('validating dsh web boot...')
  const env = {
    ...process.env,
    DSH_HOME: path.join(STAGING, 'val-home'),
    DSH_TELEMETRY_DISABLED: '1',
  }
  const proc = spawn(nodeBin, [dshBin, 'web', '--port', '0'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let out = ''
  let settled = false
  const port = await new Promise((resolve, reject) => {
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    const timer = setTimeout(() => finish(reject, new Error('readiness timeout')), 90000)
    const check = () => {
      const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)/)
      if (m) finish(resolve, m[1])
    }
    proc.stdout.on('data', (d) => { out += d; check() })
    proc.stderr.on('data', (d) => { out += d; check() })
    proc.on('exit', (c) => finish(reject, new Error(`server exited ${c}: ${out.slice(-500)}`)))
  })

  const res = await fetch(`http://127.0.0.1:${port}/`)
  console.log(`  ok: port=${port} http=${res.status}`)
  proc.kill('SIGTERM')
  if (res.status !== 200) throw new Error(`unexpected HTTP ${res.status}`)
}

async function main() {
  fs.rmSync(STAGING, { recursive: true, force: true })
  fs.mkdirSync(STAGING, { recursive: true })

  // Artifact version: tag (v0.1.2 -> 0.1.2) wins, then dsh_version (auto
  // releases), else package.json stays as-is. Synced into package.json so
  // electron-builder's ${version} resolves.
  const refName = process.env.GITHUB_REF_NAME
  const appVersion = (refName && refName.startsWith('v'))
    ? refName.slice(1)
    : (process.env.DSH_VERSION || null)
  if (appVersion) {
    const pkgPath = path.join(DIR, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.version = appVersion
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    console.log(`app version -> ${appVersion}`)
  }

  console.log(`target: ${platform}-${arch}, dsh ${DSH_VERSION}, node ${NODE_MAJOR}.x`)

  // 1. resolve node version + download + extract
  const idx = await (await fetch('https://nodejs.org/dist/index.json')).json()
  const nodeVersion = idx.find((v) => v.version.startsWith(`v${NODE_MAJOR}.`)).version
  console.log(`node ${nodeVersion} (${nodePlatform}-${arch})`)

  const archive = path.join(STAGING, `node.${ext}`)
  await download(
    `https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-${nodePlatform}-${arch}.${ext}`,
    archive,
  )

  const nodeSrc = path.join(STAGING, 'node-src')
  fs.mkdirSync(nodeSrc, { recursive: true })
  run('tar', ['-xf', archive, '-C', nodeSrc])

  const nodeDistDir = path.join(nodeSrc, `node-${nodeVersion}-${nodePlatform}-${arch}`)
  const nodeSrcBin = platform === 'win32'
    ? path.join(nodeDistDir, 'node.exe')
    : path.join(nodeDistDir, 'bin', 'node')
  const nodeDest = platform === 'win32'
    ? path.join(STAGING, 'runtime', 'node', 'node.exe')
    : path.join(STAGING, 'runtime', 'node', 'bin', 'node')
  fs.mkdirSync(path.dirname(nodeDest), { recursive: true })
  fs.copyFileSync(nodeSrcBin, nodeDest)

  // 2. npm install the dsh runtime
  const dshDir = path.join(STAGING, 'dsh')
  run(npmCmd, ['install', '--prefix', dshDir, '--no-audit', '--no-fund', `@deepseek-ai/dsh@${DSH_VERSION}`])
  const dshBin = path.join(dshDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  if (!fs.existsSync(dshBin)) throw new Error('dsh bin missing after install')

  // 3. validate the runtime boots
  await validate(nodeSrcBin, dshBin)

  // 4. package; publish artifacts + update feeds (latest.yml / latest-mac.yml)
  //    to the GitHub Release only when running in CI (needs GH_TOKEN env).
  const publishFlag = process.env.CI === 'true' ? 'always' : 'never'
  run(npxCmd, ['electron-builder', targetFlag, '--publish', publishFlag], { cwd: DIR })

  console.log(`done: see ${path.join(DIR, 'dist')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
