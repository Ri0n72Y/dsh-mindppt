import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    dts: true,
    format: 'esm',
    clean: true,
  },
  {
    entry: { client: 'src/client/index.tsx' },
    dts: true,
    format: 'esm',
  },
])
