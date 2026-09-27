import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'dsh-mindppt-code-editor': fileURLToPath(
        new URL('../../plugins/code-editor/src/index.ts', import.meta.url),
      ),
      'dsh-mindppt-canvas-excalidraw': fileURLToPath(
        new URL('../../plugins/canvas-excalidraw/src/index.ts', import.meta.url),
      ),
      'dsh-mindppt-code-parser': fileURLToPath(
        new URL('../../plugins/code-parser/src/index.ts', import.meta.url),
      ),
    },
  },
})
