import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PROFILE = 'mindppt'
const PACKAGE_SPEC = './plugins/dsh-mindppt'
const WEB_ROWS = ['connection', 'workspace-files', 'ui-sidebar-documentpreview']
const MINDPPT_ROW = 'mindppt'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function buildDeployArgs(userArgs) {
  let profile
  let selector
  const forwarded = []

  for (let index = 0; index < userArgs.length; index += 1) {
    const argument = userArgs[index]
    if (argument === '--profile') {
      if (profile !== undefined) throw new Error('DSH profile may only be selected once')
      const value = userArgs[index + 1]
      if (!value) throw new Error('--profile requires a profile name')
      profile = value
      selector = ['--profile', value]
      index += 1
      continue
    }
    if (argument.startsWith('--profile=')) {
      if (profile !== undefined) throw new Error('DSH profile may only be selected once')
      const value = argument.slice('--profile='.length)
      if (!value) throw new Error('--profile requires a profile name')
      profile = value
      selector = [argument]
      continue
    }
    forwarded.push(argument)
  }

  profile ??= DEFAULT_PROFILE
  selector ??= ['--profile', DEFAULT_PROFILE]
  return {
    profile,
    args: ['plugin', ...selector, 'add', PACKAGE_SPEC, ...forwarded],
  }
}

export function resolvePnpmRunner(
  env = process.env,
  platform = process.platform,
  nodeExecPath = process.execPath,
) {
  if (env.npm_execpath) {
    return { command: nodeExecPath, args: [env.npm_execpath] }
  }
  if (platform === 'win32') {
    throw new Error('pnpm executable path unavailable; run through pnpm dsh:deploy')
  }
  return { command: 'pnpm', args: [] }
}

function runDsh(args, spawn, runner, stdio = 'inherit') {
  const result = spawn(runner.command, [...runner.args, 'dsh', ...args], {
    cwd: ROOT,
    stdio,
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  return result
}

function exitCode(result) {
  return typeof result.status === 'number' ? result.status : 1
}

function replayFailure(result) {
  if (typeof result.stdout === 'string' && result.stdout) process.stderr.write(result.stdout)
  if (typeof result.stderr === 'string' && result.stderr) process.stderr.write(result.stderr)
}

function hasRows(source, rows) {
  return rows.every(row => source.includes(`id: ${row}`))
}

function dumpProfile(profile, spawn, runner, fromWeb = false) {
  return runDsh([
    '--profile', profile,
    ...(fromWeb ? ['--from-default-profile', 'web'] : []),
    '--dump-default-config',
  ], spawn, runner, 'pipe')
}

function ensureWebProfile(profile, spawn, runner) {
  const existing = dumpProfile(profile, spawn, runner)
  if (exitCode(existing) === 0) {
    if (hasRows(existing.stdout ?? '', WEB_ROWS)) return 0
    process.stderr.write(
      `dsh: profile ${JSON.stringify(profile)} is not Web-backed; MindPPT requires the Web profile surface\n`,
    )
    return 1
  }

  const created = dumpProfile(profile, spawn, runner, true)
  if (exitCode(created) !== 0) {
    replayFailure(existing)
    replayFailure(created)
    return exitCode(created)
  }
  if (hasRows(created.stdout ?? '', WEB_ROWS)) return 0
  process.stderr.write(
    `dsh: profile ${JSON.stringify(profile)} was created without the required Web surface\n`,
  )
  return 1
}

export function main(
  userArgs,
  spawn = spawnSync,
  runner = resolvePnpmRunner(),
) {
  const version = runDsh(['--version'], spawn, runner, 'pipe')
  if (exitCode(version) !== 0) {
    replayFailure(version)
    return exitCode(version)
  }
  const deployment = buildDeployArgs(userArgs)
  const profileStatus = ensureWebProfile(deployment.profile, spawn, runner)
  if (profileStatus !== 0) return profileStatus

  const installed = runDsh(deployment.args, spawn, runner)
  if (exitCode(installed) !== 0) return exitCode(installed)

  const smoke = dumpProfile(deployment.profile, spawn, runner)
  if (exitCode(smoke) !== 0) {
    replayFailure(smoke)
    return exitCode(smoke)
  }
  if (!hasRows(smoke.stdout ?? '', [...WEB_ROWS, MINDPPT_ROW])) {
    process.stderr.write(
      'dsh: MindPPT bundle was installed but is not active in the selected profile\n',
    )
    return 1
  }
  return 0
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error('dsh: MindPPT deployment failed', error)
    process.exitCode = 1
  }
}
