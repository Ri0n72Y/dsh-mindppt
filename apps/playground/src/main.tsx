import { Context } from '@deepseek-ai/cordis'
import {
  Excalidraw,
  convertToExcalidrawElements,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import MindPptCanvasService, {
  type ExcalidrawScene,
} from 'dsh-mindppt-canvas-excalidraw'
import MindPptParserService from 'dsh-mindppt-code-parser'
import source from '../../../examples/hello-world.mindppt?raw'

import './style.css'

async function compileHelloWorld() {
  const ctx = new Context()

  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCanvasService)

  let scene: ExcalidrawScene | undefined

  await ctx.plugin({
    name: 'mindppt-playground-driver',
    inject: ['mindpptParser', 'mindpptCanvas'],
    apply(runtime: Context) {
      runtime.mindpptParser.compile(source)
      scene = runtime.mindpptCanvas.scene
    },
  })

  if (!scene) {
    throw new Error('MindPPT renderer did not produce a scene')
  }

  return convertToExcalidrawElements(scene, { regenerateIds: false })
}

const elements = await compileHelloWorld()
const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root')
}

createRoot(root).render(
  <StrictMode>
    <main className="playground">
      <aside className="source-panel">
        <div className="panel-label">MindPPT source</div>
        <pre>{source}</pre>
      </aside>

      <section className="canvas-panel">
        <Excalidraw
          initialData={{
            elements,
            scrollToContent: true,
            appState: {
              zenModeEnabled: true,
            },
          }}
          viewModeEnabled
        />
      </section>
    </main>
  </StrictMode>,
)
