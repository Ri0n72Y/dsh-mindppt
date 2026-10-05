import { defineConfig } from 'tsdown'

const shared = {
  outDir: 'lib',
  format: ['esm'] as const,
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  deps: {
    dts: {
      neverBundle: true as const,
    },
  },
  tsconfig: 'tsconfig.json',
}

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    platform: 'node',
    clean: true,
  },
  {
    ...shared,
    entry: { client: 'src/client/index.tsx' },
    platform: 'browser',
    clean: false,
  },
])
