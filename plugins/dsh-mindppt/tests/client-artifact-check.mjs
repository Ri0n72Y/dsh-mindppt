import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
assert.match(
  source,
  /window\.__ModuleLoader__\.load\(\{\s*id:\s*["']dsh-mindppt-dsh["']/,
  'client artifact must register through the DSH lazy module loader',
)
assert.match(
  source,
  /data-mindppt-style|mindpptStyle/,
  'client artifact must carry the Excalidraw stylesheet',
)
assert.doesNotMatch(
  source,
  /(^|\n)\s*import\s/m,
  'client artifact must not ship as an ESM entry',
)
assert.doesNotMatch(
  source,
  /process\.env\.NODE_ENV|import\.meta\.env/,
  'client artifact must not retain build-environment probes',
)
