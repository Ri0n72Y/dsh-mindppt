import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main, resolvePnpmRunner } from './deploy-dsh.mjs'

const dir = mkdtempSync(join(tmpdir(), 'mindppt pnpm smoke-'))
const fake = join(dir, 'pnpm.mjs')
const fakeSource = [
  "const args = process.argv.slice(2)",
  "if (args[0] !== 'dsh') process.exit(9)",
  "const dsh = args.slice(1)",
  "if (dsh.length === 1 && dsh[0] === '--version') {",
  "  process.stdout.write('0.2.0-rc.2\\n')",
  "  process.exit(0)",
  "}",
  "if (dsh.includes('--dump-default-config')) {",
  "  process.stdout.write('id: connection\\nid: workspace-files\\nid: ui-sidebar-documentpreview\\nid: mindppt\\n')",
  "  process.exit(0)",
  "}",
  "if (dsh[0] === 'plugin') process.exit(0)",
  "process.exit(8)",
].join('\n')

try {
  writeFileSync(fake, fakeSource)
  const runner = resolvePnpmRunner(
    { npm_execpath: fake },
    process.platform,
    process.execPath,
  )
  const code = main([], spawnSync, runner)
  if (code !== 0) throw new Error('deploy runner smoke failed with exit ' + code)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
