import { createRoot } from 'react-dom/client'

import { MindPptCanvas } from './MindPptCanvas.tsx'
import {
  createPlaygroundRuntime,
  type PlaygroundRuntime,
} from './runtime.ts'
import type { PlaygroundAssetContext } from './assets.ts'

export interface AssetBrowserHarness {
  runtime: PlaygroundRuntime
  dispose: () => void
}

export async function mountAssetBrowserHarness(
  container: HTMLElement,
  source: string,
  assetContext: PlaygroundAssetContext,
): Promise<AssetBrowserHarness> {
  const runtime = await createPlaygroundRuntime(source, assetContext)
  const root = createRoot(container)

  const render = () => {
    const snapshot = runtime.getSnapshot()
    root.render(
      <MindPptCanvas
        elements={snapshot.elements}
        files={snapshot.files}
        focusRequest={snapshot.camera.focusRequest}
      />,
    )
  }

  const unsubscribe = runtime.subscribe(render)
  render()

  return {
    runtime,
    dispose() {
      unsubscribe()
      root.unmount()
    },
  }
}
