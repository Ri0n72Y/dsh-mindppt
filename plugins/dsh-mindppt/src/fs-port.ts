import type { WorkspaceFilePort } from './controller.ts'
import type { MindPptFileIdentity } from './shared.ts'

interface FsTarget {
  displayPath: string
}

interface DshFileSystem {
  resolve(
    path: string,
    options?: { cwd?: string; signal?: AbortSignal },
  ): Promise<FsTarget>
  contains(root: FsTarget, target: FsTarget): boolean
  readText(target: FsTarget, signal?: AbortSignal): Promise<string>
  writeText(
    target: FsTarget,
    source: string,
    intent?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown>
}

interface Sessions {
  get(id: string): { header: { cwd?: string } } | undefined
}

export function workspaceFilePort(
  fs: DshFileSystem,
  sessions: Sessions,
): WorkspaceFilePort {
  const target = async (
    identity: MindPptFileIdentity,
    signal?: AbortSignal,
  ): Promise<FsTarget> => {
    const cwd = sessions.get(identity.sessionId)?.header.cwd
    if (!cwd) throw new Error('MindPPT requires a live DSH workspace session')
    const root = await fs.resolve(cwd, { signal })
    const resolved = await fs.resolve(identity.path, { cwd, signal })
    if (!fs.contains(root, resolved)) {
      throw new Error('MindPPT file is outside the selected DSH workspace')
    }
    return resolved
  }
  return {
    async readText(identity, signal) {
      return await fs.readText(await target(identity, signal), signal)
    },
    async writeText(identity, source, signal) {
      await fs.writeText(await target(identity, signal), source, undefined, signal)
    },
  }
}
