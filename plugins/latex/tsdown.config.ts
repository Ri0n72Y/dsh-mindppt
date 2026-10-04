import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'browser',
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
