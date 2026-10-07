import { readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type TsdownPlugin } from 'tsdown'

const CLIENT_ID = 'dsh-mindppt-plugin'
const CLIENT_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])
const BUILD_MODE = process.env.NODE_ENV ?? 'production'

function assetMime(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.woff2': return 'font/woff2'
    case '.woff': return 'font/woff'
    case '.ttf': return 'font/ttf'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    default: return 'application/octet-stream'
  }
}

function inlineCssAssets(source: string, root: string): string {
  return source.replace(
    /url\((['"]?)([^'")]+)\1\)/g,
    (whole, _quote: string, raw: string) => {
      const value = raw.trim()
      if (/^(?:data:|https?:|#|var\()/i.test(value)) return whole
      const path = resolve(root, value.split(/[?#]/, 1)[0] ?? value)
      const data = readFileSync(path).toString('base64')
      return 'url("data:' + assetMime(path) + ';base64,' + data + '")'
    },
  )
}

function excalidrawCss(): string {
  const entry = fileURLToPath(import.meta.resolve('@excalidraw/excalidraw'))
  const root = dirname(entry)
  return inlineCssAssets(readFileSync(resolve(root, 'index.css'), 'utf8'), root)
}

function clientIntro(): string {
  return [
    'var module = { exports: {} }; var exports = module.exports;',
    'if (typeof document !== "undefined" && document.querySelector("style[data-mindppt-style=excalidraw]") === null) {',
    '  var style = document.createElement("style");',
    '  style.dataset.mindpptStyle = "excalidraw";',
    '  style.textContent = ' + JSON.stringify(excalidrawCss()) + ';',
    '  document.head.appendChild(style);',
    '}',
  ].join('\n')
}

const MERMAID_STUB_ID = '\0mindppt-view-only-mermaid'

function viewOnlyExcalidrawGuard(): TsdownPlugin {
  return {
    name: 'mindppt-view-only-excalidraw',
    resolveId(source: string) {
      if (source === '@excalidraw/mermaid-to-excalidraw') {
        return MERMAID_STUB_ID
      }
      return null
    },
    load(id: string) {
      if (id !== MERMAID_STUB_ID) return null
      return [
        'export async function parseMermaidToExcalidraw() {',
        '  throw new Error("Mermaid import is unavailable in MindPPT view-only canvas")',
        '}',
      ].join('\n')
    },
  }
}

function clientExternalGuard(): TsdownPlugin {
  return {
    name: 'mindppt-client-external-guard',
    generateBundle(_options, bundle) {
      const unexpected = new Set<string>()
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const specifier of [...output.imports, ...output.dynamicImports]) {
          if (!(specifier in bundle) && !CLIENT_EXTERNALS.has(specifier)) {
            unexpected.add(specifier)
          }
        }
      }
      if (unexpected.size > 0) {
        throw new Error(
          'MindPPT client contains unresolved non-platform modules: '
            + [...unexpected].sort().join(', '),
        )
      }
    },
  }
}

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
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
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => CLIENT_EXTERNALS.has(specifier),
      alwaysBundle: (specifier: string) => !CLIENT_EXTERNALS.has(specifier),
      dts: {
        neverBundle: true,
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(BUILD_MODE),
      'import.meta.env.MODE': JSON.stringify(BUILD_MODE),
      'import.meta.env': JSON.stringify({ MODE: BUILD_MODE }),
    },
    inputOptions: {
      resolve: {
        conditionNames: [
          BUILD_MODE === 'development' ? 'development' : 'production',
          'browser',
          'import',
          'module',
          'default',
        ],
      },
    },
    plugins: [viewOnlyExcalidrawGuard(), clientExternalGuard()],
    tsconfig: 'tsconfig.json',
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: 'window.__ModuleLoader__.load({ id: '
        + JSON.stringify(CLIENT_ID) + ', factory: (require) => {',
      intro: clientIntro(),
      footer: 'return module.exports; } });',
    },
  },
])
