import { useSyncExternalStore } from 'react'

export type DocumentView = 'code' | 'panorama'

export interface DocumentViewCell {
  getSnapshot(): DocumentView
  subscribe(listener: () => void): () => void
  set(view: DocumentView): void
}

const cells = new WeakMap<AbortSignal, Map<string, DocumentViewCell>>()

export function createDocumentViewCell(
  initial: DocumentView = 'code',
): DocumentViewCell {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(view) {
      if (view === value) return
      value = view
      for (const listener of listeners) listener()
    },
  }
}

export function documentViewCell(
  signal: AbortSignal,
  resourceAddress: string,
): DocumentViewCell {
  let byResource = cells.get(signal)
  if (!byResource) {
    byResource = new Map()
    cells.set(signal, byResource)
  }
  let cell = byResource.get(resourceAddress)
  if (!cell) {
    cell = createDocumentViewCell()
    byResource.set(resourceAddress, cell)
  }
  return cell
}

export function useDocumentView(
  signal: AbortSignal,
  resourceAddress: string,
): readonly [DocumentView, (view: DocumentView) => void] {
  const cell = documentViewCell(signal, resourceAddress)
  const view = useSyncExternalStore(
    cell.subscribe,
    cell.getSnapshot,
    cell.getSnapshot,
  )
  return [view, cell.set] as const
}

export function nextDocumentView(view: DocumentView): DocumentView {
  return view === 'code' ? 'panorama' : 'code'
}
