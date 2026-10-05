import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client/index.tsx',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  deps: {
    dts: {
      neverBundle: true,
    },
  },
  tsconfig: 'tsconfig.json',
})
