'use strict'

const fs = require('node:fs')

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z.-]+)?$/.exec(value)
  if (!match) throw new Error(`invalid version: ${value}`)
  return { core: match.slice(1, 4).map(Number), pre: match[4]?.split('.') }
}

function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right)
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i]
  if (!a.pre || !b.pre) return a.pre === b.pre ? 0 : a.pre ? -1 : 1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i]
    if (x === y) continue
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) return Number(x) - Number(y)
    if (xn !== yn) return xn ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

function expectedAssets(version) {
  const base = `DeepSeek-Harness-${version}`
  return [
    `${base}-macos-arm64.zip`, `${base}-windows-x64-setup.exe`,
    `${base}-windows-x64-setup.exe.blockmap`, `${base}-windows-x64-portable.exe`,
    `${base}-linux-x64.AppImage`, 'latest.yml',
  ]
}

function hasAssets(release, version) {
  if (!release || release.draft || release.tag_name !== `v${version}`) return false
  return expectedAssets(version).every(name => release.assets?.some(asset => asset.name === name && asset.size > 0))
}

function planRelease({ versions, pinned, desktop, release, feedVersion, packagingChanged = false }) {
  parseVersion(pinned)
  if (!/^\d+\.\d+\.\d+$/.test(desktop)) throw new Error('desktop version must be stable SemVer')
  let runtime = pinned
  for (const version of versions) {
    try { if (compareVersions(version, runtime) > 0) runtime = version } catch { /* ignore invalid registry versions */ }
  }
  const published = hasAssets(release, desktop) && feedVersion === desktop
  // Even a partial public release may already be installed on one platform.
  // A code change must not overwrite that installer under the same version.
  const bump = runtime !== pinned || (packagingChanged && !release?.draft && release?.assets?.length > 0)
  const nextDesktop = bump ? desktop.replace(/\d+$/, patch => String(Number(patch) + 1)) : desktop
  return { runtime, desktop: nextDesktop, build: bump || !published, bump }
}

const FEED = 'https://emohomepage.ccwu.cc/deepseek-harness-desktop/appcast.xml'
async function request(url, { github = false, allowMissing = false } = {}) {
  const response = await fetch(url, {
    headers: github && process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {},
    signal: AbortSignal.timeout(30000),
  })
  if (allowMissing && response.status === 404) return null
  if (!response.ok) throw new Error(`HTTP ${response.status} reading ${url}`)
  return response
}

async function inspectRelease(repo, version) {
  const response = await request(`https://api.github.com/repos/${repo}/releases/tags/v${version}`, { github: true, allowMissing: true })
  const release = response ? await response.json() : null
  let feedVersion
  let windowsManifestValid = false
  if (hasAssets(release, version)) {
    const feedResponse = await request(FEED, { allowMissing: true })
    const feed = feedResponse ? await feedResponse.text() : ''
    const asset = release.assets.find(asset => asset.name === 'latest.yml')
    const manifestResponse = await request(asset.browser_download_url, { allowMissing: true })
    const manifest = manifestResponse ? await manifestResponse.text() : ''
    windowsManifestValid = manifest.replace(/\r\n/g, '\n').includes(`version: ${version}\n`)
      && manifest.includes(`DeepSeek-Harness-${version}-windows-x64-setup.exe`)
    if (windowsManifestValid) feedVersion = feed.match(/<sparkle:version>([^<]+)<\/sparkle:version>/)?.[1]
  }
  return { release, feedVersion, windowsManifestValid }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || '1m01m0/deepseek-harness-desktop'
  if (process.argv[2] === '--verify') {
    const version = process.argv[3]
    parseVersion(version)
    const { release, feedVersion } = await inspectRelease(repo, version)
    if (!hasAssets(release, version) || feedVersion !== version) throw new Error(`release ${version} is incomplete (installers or macOS feed missing/stale)`)
    console.log(`Verified release ${version}: all platform assets and both update feeds`)
    return
  }
  const pinned = fs.readFileSync('native/mac-app/DSH_VERSION', 'utf8').trim()
  const desktop = fs.readFileSync('native/mac-app/DESKTOP_VERSION', 'utf8').trim()
  const metadata = await (await request('https://registry.npmjs.org/@deepseek-ai/dsh')).json()
  const status = await inspectRelease(repo, desktop)
  const plan = planRelease({ versions: Object.keys(metadata.versions), pinned, desktop, ...status, packagingChanged: process.env.PACKAGING_CHANGED === 'true' })
  console.log(JSON.stringify(plan))
  if (process.env.GITHUB_OUTPUT) {
    for (const [key, value] of Object.entries(plan)) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  }
}

module.exports = { compareVersions, expectedAssets, hasAssets, planRelease, inspectRelease }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
