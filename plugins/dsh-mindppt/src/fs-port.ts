import type { WorkspaceFilePort } from './controller.ts'

interface FsTarget {
  displayPath: string
}

interface DshFileSystem {
  resolve(path: string, options?: { signal?: AbortSignal }): Promise<FsTarget>
  readText(target: FsTarget, signal?: AbortSignal): Promise<string>
  writeText(
    target: FsTarget,
    source: string,
    intent?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown>
}

export function workspaceFilePort(fs: DshFileSystem): WorkspaceFilePort {
  return {
    async readText(path, signal) {
      const target = await fs.resolve(path, { signal })
      return await fs.readText(target, signal)
    },
    async writeText(path, source, signal) {
      const target = await fs.resolve(path, { signal })
      await fs.writeText(target, source, undefined, signal)
    },
  }
}
