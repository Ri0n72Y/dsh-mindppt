import type { MindPptFileIdentity } from './shared.ts'

export interface WorkspaceFileSnapshot {
  source: string
  version: string
}

export interface WorkspaceFilePort {
  readText(identity: MindPptFileIdentity, signal?: AbortSignal): Promise<string>
  readSnapshot(
    identity: MindPptFileIdentity,
    signal?: AbortSignal,
  ): Promise<WorkspaceFileSnapshot>
  writeText(
    identity: MindPptFileIdentity,
    source: string,
    expectedVersion: string,
    signal?: AbortSignal,
  ): Promise<string>
}
