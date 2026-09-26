import { Context } from '@deepseek-ai/cordis'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import MindPptCanvasService, {
  type RenderedElements,
} from 'dsh-mindppt-canvas-excalidraw'
import MindPptParserService from 'dsh-mindppt-code-parser'
import source from '../../../examples/hello-world.mindppt?raw'

import './style.css'

async function compileHelloWorld(): Promise<RenderedElements> {
  const ctx = new Context()

  await ctx.plugin(MindPptParserService)
  await ctx.plugin(MindPptCanvasService)

  let elements: RenderedElements | undefined

  await ctx.plugin({
    name: 'mindppt-playground-driver',
    inject: ['mindpptParser', 'mindpptCanvas'],
    apply(runtime: Context) {
      runtime.mindpptParser.compile(source)
      elements = runtime.mindpptCanvas.elements
    },
  })

  if (!elements) {
    throw new Error('MindPPT renderer did not produce a scene')
  }

  return elements
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
