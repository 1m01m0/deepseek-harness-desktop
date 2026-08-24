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

function replaceOnce(file, before, after) {
  const source = fs.readFileSync(file, 'utf8')
  if (source.includes(after)) return false
  const matches = source.split(before).length - 1
  if (matches !== 1) {
    throw new Error(`expected one patch anchor in ${file}, found ${matches}`)
  }
  fs.writeFileSync(file, source.replace(before, after))
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

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `\t\tconst maxTokens = capacity(entry?.max_output_tokens, entry?.max_tokens);\n\t\tmodels.push({`,
  `\t\tconst maxTokens = capacity(entry?.max_output_tokens, entry?.max_tokens);\n\t\tconst inputModalities = modalities(entry?.input, entry?.input_modalities, entry?.inputModalities, entry?.modalities);\n\t\tmodels.push({`,
)

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `\t\t\t...maxTokens === void 0 ? {} : { maxTokens }\n\t\t});`,
  `\t\t\t...maxTokens === void 0 ? {} : { maxTokens },\n\t\t\t...inputModalities === void 0 ? {} : { inputModalities }\n\t\t});`,
)

patch(
  'dsh-llm-pi-ai',
  'lib/index.js',
  `\t\t\tmaxTokens: model.maxTokens\n\t\t}));`,
  `\t\t\tmaxTokens: model.maxTokens,\n\t\t\tinputModalities: [...model.input]\n\t\t}));`,
)

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

patch(
  'dsh-client-ui-settings-models',
  'lib/client.js',
  `\t\t\t\t...candidate.maxTokens === void 0 ? {} : { maxTokens: candidate.maxTokens }\n\t\t\t};`,
  `\t\t\t\t...candidate.maxTokens === void 0 ? {} : { maxTokens: candidate.maxTokens },\n\t\t\t\t...candidate.inputModalities === void 0 ? {} : { input: [...candidate.inputModalities] }\n\t\t\t};`,
)

console.log(changes.length === 0 ? 'dsh runtime patch already applied' : `patched dsh runtime: ${changes.join(', ')}`)
