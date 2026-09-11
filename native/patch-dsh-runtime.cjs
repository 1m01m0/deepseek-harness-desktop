#!/usr/bin/env node
'use strict'

// The desktop shells install the published dsh runtime. Keep this small,
// idempotent overlay until the corresponding upstream package is published.
// The overlay preserves upstream modality metadata and adds the desktop
// fallback for standard Gemini model ids when an OpenAI-compatible gateway
// omits that metadata. Explicit model declarations remain authoritative.

const fs = require('fs')
const path = require('path')

const modulesRoot = process.argv[2]
if (!modulesRoot) {
  console.error('usage: node native/patch-dsh-runtime.cjs <node_modules>')
  process.exit(2)
}

function packageFile(packageName, relativePath) {
  return path.join(modulesRoot, '@deepseek-ai', packageName, relativePath)
}

// Bundlers can reindent a function (e.g. when adding class decorators) without
// changing its code. Ignore only leading indentation, not semantic changes.
function anchor(text) {
  return new RegExp(text.trim().split('\n').map(line =>
    line.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  ).join('\\r?\\n[\\t ]*'), 'g')
}

const pending = new Map()
function replaceOnce(file, before, after) {
  const source = pending.get(file) ?? fs.readFileSync(file, 'utf8')
  if (anchor(after).test(source)) return false
  const pattern = anchor(before)
  const matches = [...source.matchAll(pattern)].length
  if (matches !== 1) {
    throw new Error(`expected one patch anchor in ${file}, found ${matches}; runtime not supported (no files changed)`)
  }
  pending.set(file, source.replace(pattern, () => after.trim()))
  return true
}

const changes = []
function patch(packageName, relativePath, before, after) {
  const file = packageFile(packageName, relativePath)
  if (replaceOnce(file, before, after)) changes.push(path.relative(modulesRoot, file))
}

patch(
  'dsh-llm',
  'lib/index.js',
  `\t\t\t\t...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens }\n\t\t\t});`,
  `\t\t\t\t...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens },\n\t\t\t\t...model.inputModalities === void 0 ? {} : { inputModalities: [...model.inputModalities] }\n\t\t\t});`,
)

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `function declaredInput(configured) {\n\treturn configured === void 0 || configured.length === 0 ? void 0 : [...configured];\n}`,
  `function declaredInput(configured) {\n\treturn configured === void 0 || configured.length === 0 ? void 0 : [...configured];\n}\nfunction inferredInput(id, fallback) {\n\treturn /^gemini(?:[-_]|$)/i.test(id) ? ["text", "image"] : [...fallback];\n}`,
)

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `input: declaredInput(entry.input) ?? base?.input ?? [...request.defaultInput],`,
  `input: declaredInput(entry.input) ?? base?.input ?? inferredInput(entry.id, request.defaultInput),`,
)

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `function label(...candidates) {\n\tfor (const candidate of candidates) if (typeof candidate === "string" && candidate.length > 0) return candidate;\n}`,
  `function modalities(...candidates) {\n\tfor (const candidate of candidates) {\n\t\tif (!Array.isArray(candidate)) continue;\n\t\tconst values = candidate.filter((value) => value === "text" || value === "image");\n\t\tif (values.length > 0) return [...new Set(values)];\n\t}\n}\n/** A non-empty string field of a listing entry, or \`undefined\`. */\nfunction label(...candidates) {\n\tfor (const candidate of candidates) if (typeof candidate === "string" && candidate.length > 0) return candidate;\n}`,
)

const adapterSource = pending.get(packageFile('dsh-llm-pi-ai', 'lib/index.js'))
  ?? fs.readFileSync(packageFile('dsh-llm-pi-ai', 'lib/index.js'), 'utf8')
const discoveredName = adapterSource.includes('const name = label(entry?.name, entry?.display_name);')
  ? '...name === void 0 ? {} : { name }' : 'name'
patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `models.push({\n id,\n ${discoveredName},\n ...contextWindow === void 0 ? {} : { contextWindow },\n ...maxTokens === void 0 ? {} : { maxTokens }\n });`,
  `const inputModalities = modalities(entry?.input, entry?.input_modalities, entry?.inputModalities, entry?.modalities);\n models.push({\n id,\n ${discoveredName},\n ...contextWindow === void 0 ? {} : { contextWindow },\n ...maxTokens === void 0 ? {} : { maxTokens },\n ...inputModalities === void 0 ? {} : { inputModalities }\n });`,
)

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `\t\t\tmaxTokens: model.maxTokens\n\t\t}));`,
  `\t\t\tmaxTokens: model.maxTokens,\n\t\t\tinputModalities: [...model.input]\n\t\t}));`,
)

if (fs.existsSync(packageFile('dsh-host-apiproxy', 'package.json'))) {
patch(
  'dsh-host-apiproxy',
  'lib/index.js',
  `\tname: z$1.string().min(1).optional(),\n\tcontextWindow: z$1.number().int().positive().optional(),\n\tmaxTokens: z$1.number().int().positive().optional()\n});`,
  `\tname: z$1.string().min(1).optional(),\n\tcontextWindow: z$1.number().int().positive().optional(),\n\tmaxTokens: z$1.number().int().positive().optional(),\n\tinputModalities: z$1.array(z$1.enum(["text", "image"])).min(1).optional()\n});`,
)

patch(
  'dsh-host-apiproxy',
  'lib/types/api/llm.schema.js',
  `    name: z.string().min(1).optional(),\n    contextWindow: z.number().int().positive().optional(),\n    maxTokens: z.number().int().positive().optional(),\n});`,
  `    name: z.string().min(1).optional(),\n    contextWindow: z.number().int().positive().optional(),\n    maxTokens: z.number().int().positive().optional(),\n    inputModalities: z.array(z.enum(["text", "image"])).min(1).optional(),\n});`,
)
} else {
  // Newer dsh moved discovery from host-apiproxy to the generated Remote
  // transport. Preserve metadata in its client decoder too, or Zod strips it.
  patch(
    'dsh-api-remotes',
    'lib/client.js',
    `const _deepseek_ai_dsh_llm_llm_discoverModels_result$schema = array(object({\n"id": string(),\n"name": string().optional(),\n"contextWindow": number().optional(),\n"maxTokens": number().optional()\n}));`,
    `const _deepseek_ai_dsh_llm_llm_discoverModels_result$schema = array(object({\n"id": string(),\n"name": string().optional(),\n"contextWindow": number().optional(),\n"maxTokens": number().optional(),\n"inputModalities": array(union([literal("text"), literal("image")])).min(1).optional()\n}));`,
  )
}

patch(
  'dsh-client-ui-settings-models',
  'lib/client.js',
  `\t\t\t\t...candidate.maxTokens === void 0 ? {} : { maxTokens: candidate.maxTokens }\n\t\t\t};`,
  `\t\t\t\t...candidate.maxTokens === void 0 ? {} : { maxTokens: candidate.maxTokens },\n\t\t\t\t...candidate.inputModalities === void 0 ? {} : { input: [...candidate.inputModalities] }\n\t\t\t};`,
)

// Validate every anchor before writing any file. An unsupported runtime must
// fail closed without leaving a partially patched staged package.
for (const [file, source] of pending) fs.writeFileSync(file, source)
console.log(changes.length === 0 ? 'dsh runtime patch already applied' : `patched dsh runtime: ${changes.join(', ')}`)
