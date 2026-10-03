import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'

export function replaceMountedFiles(
  api: ExcalidrawImperativeAPI,
  files: BinaryFiles,
): void {
  const mounted = api.getFiles()

  for (const fileId of Object.keys(mounted)) {
    if (!(fileId in files)) delete mounted[fileId]
  }

  api.addFiles(Object.values(files))
}
