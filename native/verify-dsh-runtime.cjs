'use strict'

// Exercise the staged npm packages through the real Loader before signing or
// packaging them. All settings are test-only; the provider is a loopback stub.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')
const { pathToFileURL } = require('node:url')
const { createServer } = require('node:http')
const vm = require('node:vm')

async function verifyRuntime(modulesRoot) {
  const packageFile = (name, file = 'lib/index.js') => join(modulesRoot, '@deepseek-ai', name, file)
  const { boot } = await import(pathToFileURL(packageFile('dsh-app-boot')).href)
  const dataDir = fs.mkdtempSync(join(tmpdir(), 'dsh-runtime-check-'))
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ data: [{ id: 'gateway-vision', input_modalities: ['text', 'image'], max_output_tokens: 4096 }] }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${server.address().port}`
  const config = join(dataDir, 'cordis.yml')
  fs.writeFileSync(config, JSON.stringify([
    { id: 'llm', name: packageFile('dsh-llm') },
    { id: 'llm-pi-ai', name: packageFile('dsh-llm-pi-ai'), config: { providers: {
      'desktop-test': { api: 'openai-completions', baseURL, models: [
        { id: 'gemini-3.7-flash-high' },
        { id: 'gemini-text-only', input: ['text'] },
        { id: 'plain-text' },
      ] },
    } } },
  ]))
  let ctx
  try {
    ctx = await boot('dsh-runtime-check', config)
    const llm = ctx.get('llm')
    const models = await llm.discoverModels('llm-pi-ai', { baseURL })
    assert.deepEqual(models[0].inputModalities, ['text', 'image'])
    assert.equal(models[0].maxTokens, 4096)
    for (const [id, modalities] of [
      ['gemini-3.7-flash-high', ['text', 'image']],
      ['gemini-text-only', ['text']], ['plain-text', ['text']],
    ]) {
      assert.deepEqual((await llm.resolveModelInfo('desktop-test', id)).inputModalities, modalities)
    }
    console.log('PASS: actual Loader -> discovery -> LLM modalities; explicit text-only settings preserved')

    const remoteClient = packageFile('dsh-api-remotes', 'lib/client.js')
    const legacySchema = packageFile('dsh-host-apiproxy', 'lib/types/api/llm.schema.js')
    if (fs.existsSync(legacySchema)) {
      const { llmDiscoverModelsValueSchema } = await import(pathToFileURL(legacySchema).href)
      assert.deepEqual(llmDiscoverModelsValueSchema.parse({ models }).models[0].inputModalities, ['text', 'image'])
      console.log('PASS: legacy API schema retains image metadata')
    } else {
      let client
      vm.runInNewContext(fs.readFileSync(remoteClient, 'utf8'), {
        window: { __ModuleLoader__: { load: descriptor => { client = descriptor.factory(() => { throw new Error('unexpected client import') }) } } },
      })
      const contributions = []
      const dispose = await client.apply({ remote: { $mount: async contribution => { contributions.push(contribution); return async () => {} } } })
      const methods = contributions.flatMap(contribution => contribution.descriptors || [])
      const discovery = methods.find(method => method.id === '@deepseek-ai/dsh-llm#llm/discoverModels')
      assert.ok(discovery, 'generated discovery Remote is mounted')
      const decoded = discovery.result.schema.parse(models)
      assert.deepEqual(Array.from(decoded[0].inputModalities), ['text', 'image'])
      await dispose()
      console.log('PASS: generated browser Remote decoder retains image metadata')
    }
  } finally {
    await ctx?.fiber.dispose()
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
}

if (!process.argv[2]) throw new Error('usage: node native/verify-dsh-runtime.cjs <staged node_modules>')
verifyRuntime(resolve(process.argv[2])).catch(error => { console.error(error); process.exitCode = 1 })
