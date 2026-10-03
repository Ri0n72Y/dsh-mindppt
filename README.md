# dsh-mindppt

MindPPT is a Cordis-native experiment that treats presentation slides as nodes on an infinite mind-map canvas.

The project is intentionally **Cordis-entangled**: major capabilities are implemented as Cordis plugins and services rather than standalone domain libraries. DSH integration is optional, while Cordis is part of the runtime architecture.

## Core idea

```text
MindPPT source code
       |
       v
   code-parser
       |
       v
MindPPT structure
   |          |
   v          v
canvas      camera
   |
   v
Excalidraw
```

A slide is rendered as an Excalidraw frame. Tree edges define the primary spatial structure, soft links add cross-tree relations, and presentation paths define optional playback routes through that structure.

## Initial plugin split

- `code-editor` — edits MindPPT source; source code is the single source of truth.
- `code-parser` — parses MindPPT source into the renderable structure.
- `canvas-excalidraw` — subscribes to compiled structures and lowers them to Excalidraw elements.
- `camera` — controls presentation navigation and viewport transitions.
- `dsh-capability` — exposes authoring knowledge, source access, templates, and agent-facing tools to DSH.
- `dsh-mindppt-sidebar` — mounts MindPPT into the DSH sidebar.

The standalone web host will run the same Cordis plugins without requiring DSH.

Web graphical interfaces are written in React + TypeScript. React owns host UI composition; Excalidraw remains the canvas renderer rather than the application state model.

## Design documents

- `docs/language-v0.md` — MindPPT Language v0 draft.
- `docs/code-parser.md` — compiler boundary, output model, source mapping, and stable identity.
- `docs/roadmap.md` — accepted v0 implementation roadmap and milestone delivery contract.


## Current vertical slice: M6

M6 now includes the complete initial layout preset set plus the first local image/asset pipeline slice.

Canonical fixtures:

- `examples/m6-layout-presets.mindppt` — `hero`, `title-content`, and `two-column` in one visible tree;
- `examples/m6-two-column.mindppt` — focused two-column + local-image regression fixture.

The delivered path is:

```text
MindPPT source
    |
    v
hero / title-content / two-column
    |
    v
compiler-owned semantic placement
    |
    +--> ordinary Markdown content
    |
    +--> left/right slots for two-column
    |
    v
Markdown image node
    |
    v
Excalidraw image skeleton + stable semantic identity
    |
    v
document-relative local asset resolution
    |
    v
content-revision binary fileId + Excalidraw BinaryFiles
    |
    v
visible browser canvas
```

`hero` vertically centers a compact ordinary-content stack inside a deterministic slide-relative box. `title-content` separates the first level-one title from the ordinary content region. `two-column` keeps the title in the slide header and lays out named `left` / `right` slots. All three presets produce semantic placement in the compiler/layout layer: slide-relative position, available width, and basic block rhythm. Excalidraw owns real font measurement during conversion rather than the compiler approximating glyph metrics. After Excalidraw's fonts settle, the browser host reconverts the same semantic scene once so cold-start rendering and later source recompiles use the same font metrics.

Image source paths remain semantic source data; browser bytes and Excalidraw binary identity are handled outside the parser model. Binary file IDs are deterministic for unchanged source + bytes and change when the bytes at the same source change. Missing, malformed, or non-local assets produce warnings instead of crashing the live authoring loop.

M3-M5 behavior remains part of the same runtime: failed compiles keep the last-good elements and files, stable slide/content identities are preserved, and Camera remains content-agnostic. Successful asset-warning snapshots publish source, elements, files, and camera from the same logical compile. Chromium coverage exercises all three M6 presets, cold-start font readiness, live recompilation, the local image pipeline, last-good behavior, and the canonical M4 camera flow.

M6 remains in progress only for broader image-fit behavior beyond the deterministic current image box. No generic layout engine, theme system, asset registry, or CSS-like layout DSL is introduced by the initial preset set.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.
