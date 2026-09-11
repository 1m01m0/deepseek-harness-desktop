'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { compareVersions, expectedAssets, planRelease, inspectRelease } = require('../release-plan.cjs')
const desktop = '0.1.20', pinned = '0.1.5-rc.1'
const release = { tag_name: `v${desktop}`, assets: expectedAssets(desktop).map(name => ({ name, size: 1 })) }
const current = { desktop, pinned, versions: [pinned], release, feedVersion: desktop }

test('missing release is retried without increasing an already-pinned version', () => {
  assert.deepEqual(planRelease({ ...current, release: null }), { runtime: pinned, desktop, build: true, bump: false })
})
test('partial, draft, and stale-feed releases are retried', () => {
  for (const change of [{ release: { ...release, assets: release.assets.slice(1) } }, { release: { ...release, draft: true } }, { feedVersion: '0.1.13' }]) {
    const plan = planRelease({ ...current, ...change })
    assert.equal(plan.build, true)
    assert.equal(plan.desktop, desktop)
  }
})
test('completed release is not rebuilt on scheduled checks', () => {
  assert.equal(planRelease(current).build, false)
})
test('packaging-only changes get a new version when previous release is complete', () => {
  assert.deepEqual(planRelease({ ...current, packagingChanged: true }), { runtime: pinned, desktop: '0.1.21', build: true, bump: true })
})
test('code changes never replace installers already public in a partial release', () => {
  assert.equal(planRelease({ ...current, release: { ...release, assets: release.assets.slice(0, 1) }, packagingChanged: true }).desktop, '0.1.21')
})
test('a stale Windows manifest causes reconciliation even when all assets exist', async t => {
  const previousFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = previousFetch })
  globalThis.fetch = async url => {
    if (url.includes('api.github.com')) return Response.json({ ...release, assets: release.assets.map(asset => ({ ...asset, browser_download_url: 'https://example.test/latest.yml' })) })
    if (url.endsWith('appcast.xml')) return new Response('<sparkle:version>0.1.20</sparkle:version>')
    return new Response('version: 0.1.13\npath: DeepSeek-Harness-0.1.13-windows-x64-setup.exe\n')
  }
  const status = await inspectRelease('test/repo', desktop)
  assert.equal(status.windowsManifestValid, false)
  assert.equal(planRelease({ ...current, ...status }).build, true)
})
test('newest registry prerelease advances pin and installer version once', () => {
  const plan = planRelease({ ...current, versions: ['0.1.5-rc.2', '0.1.5-rc.10', '0.1.4', 'bad'] })
  assert.deepEqual(plan, { runtime: '0.1.5-rc.10', desktop: '0.1.21', build: true, bump: true })
  assert.ok(compareVersions('0.1.5', '0.1.5-rc.10') > 0)
  assert.equal(compareVersions('0.1.5+one', '0.1.5+two'), 0)
})
test('never downgrades a manually pinned newer runtime', () => {
  assert.equal(planRelease({ ...current, versions: ['0.1.4'] }).runtime, pinned)
})
test('macOS defaults enable hourly background download/install without overriding user preferences', () => {
  const plist = readFileSync(join(__dirname, '../mac-app/Info.plist'), 'utf8')
  assert.match(plist, /<key>SUAutomaticallyUpdate<\/key>\s*<true\/>/)
  assert.match(plist, /<key>SUScheduledCheckInterval<\/key>\s*<integer>3600<\/integer>/)
  const swift = readFileSync(join(__dirname, '../mac-app/main.swift'), 'utf8')
  assert.doesNotMatch(swift, /automaticallyDownloadsUpdates\s*=/)
})
