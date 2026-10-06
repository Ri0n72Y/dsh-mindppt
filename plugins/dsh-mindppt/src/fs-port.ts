import type { MindPptFileIdentity } from './shared.ts'
import type { WorkspaceFilePort } from './workspace-file-port.ts'

interface FsTarget {
  displayPath: string
}

interface FsInfo {
  version: string
}

interface DshFileSystem {
  resolve(
    path: string,
    options?: { cwd?: string; signal?: AbortSignal },
  ): Promise<FsTarget>
  contains(root: FsTarget, target: FsTarget): boolean
  stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined>
  readText(target: FsTarget, signal?: AbortSignal): Promise<string>
  writeText(
    target: FsTarget,
    source: string,
    intent: { kind: 'replaceIfVersion'; version: string },
    signal?: AbortSignal,
  ): Promise<{ version: string }>
}

interface Sessions {
  get(id: string): { header: { cwd?: string } } | undefined
}

type ObserveFile = (target: FsTarget, version: string) => void

export function workspaceFilePort(
  fs: DshFileSystem,
  sessions: Sessions,
  observe: ObserveFile = () => {},
): WorkspaceFilePort {
  const target = async (
    identity: MindPptFileIdentity,
    signal?: AbortSignal,
  ): Promise<FsTarget> => {
    const cwd = sessions.get(identity.sessionId)?.header.cwd
    if (!cwd) throw new Error('MindPPT requires a live DSH workspace session')
    const path = identity.path.replace(/\\/g, '/')
    if (
      path.startsWith('/')
      || /^[A-Za-z]:\//.test(path)
      || path.split('/').includes('..')
    ) {
      throw new Error('MindPPT requires a workspace-relative file path')
    }
    const root = await fs.resolve(cwd, signal ? { signal } : undefined)
    const resolved = await fs.resolve(
      path,
      signal ? { cwd, signal } : { cwd },
    )
    if (!fs.contains(root, resolved)) {
      throw new Error('MindPPT file is outside the selected DSH workspace')
    }
    return resolved
  }

  return {
    async readText(identity, signal) {
      return await fs.readText(await target(identity, signal), signal)
    },
    async readSnapshot(identity, signal) {
      const resolved = await target(identity, signal)
      const info = await fs.stat(resolved, signal)
      if (!info) throw new Error('selected MindPPT file no longer exists')
      return {
        source: await fs.readText(resolved, signal),
        version: info.version,
      }
    },
    async writeText(identity, source, expectedVersion, signal) {
      const resolved = await target(identity, signal)
      const outcome = await fs.writeText(
        resolved,
        source,
        { kind: 'replaceIfVersion', version: expectedVersion },
        signal,
      )
      observe(resolved, outcome.version)
      return outcome.version
    },
  }
}
