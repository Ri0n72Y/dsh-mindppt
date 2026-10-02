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

M6 is in progress. The first end-to-end Layout + Image + Asset Pipeline slice is implemented with the canonical fixture:

`examples/m6-two-column.mindppt`

The delivered path is:

```text
MindPPT source
    |
    v
layout two-column + left/right slots
    |
    v
compiler-owned semantic boxes
    |
    v
Markdown image node
    |
    v
Excalidraw image skeleton + stable fileId
    |
    v
document-relative local asset resolution
    |
    v
Excalidraw BinaryFiles
    |
    v
visible browser canvas
```

The two-column preset keeps the title in the slide header and lays out named `left` / `right` slots deterministically. Image source paths remain semantic source data; browser bytes and Excalidraw file delivery are handled outside the parser model. Missing or non-local assets produce warnings instead of crashing the live authoring loop.

M3-M5 behavior remains part of the same runtime: failed compiles keep the last-good elements and files, stable slide/content identities are preserved, and Camera remains content-agnostic. The browser smoke test switches from the M6 fixture back to the canonical M4 tree to exercise M5 navigation after the asset path has rendered.

Remaining M6 work includes the `hero` and `title-content` presets and broader image fit policy. Those are intentionally not generalized into a layout/theme framework in this slice.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.
