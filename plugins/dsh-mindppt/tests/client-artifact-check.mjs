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

const allowed = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])
const required = [...source.matchAll(/require\(["']([^"']+)["']\)/g)]
  .map(match => match[1])
const unexpected = [...new Set(required.filter(name => !allowed.has(name)))]
assert.deepEqual(
  unexpected,
  [],
  'client artifact contains unresolved non-platform modules: '
    + unexpected.join(', '),
)
