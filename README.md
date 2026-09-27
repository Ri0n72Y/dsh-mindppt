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


## Current vertical slice: M3

M2 established the Markdown content profile and generic extension fallback. M3 turns the playground into the first live authoring loop.

The same canonical fixture remains:

`examples/m2-content-profile.mindppt`

The runtime now follows:

```text
edit source
    |
    v
code-editor
    |
    v
code-parser
   / \
success error
 |       |
 v       v
canvas   diagnostics
 |       |
 v       v
new      keep last-good
scene    scene
```

The parser tracks the current source, diagnostics, and the last successful structure. Diagnostics carry source ranges where available, and the React editor uses those ranges for click-to-focus navigation.

The Excalidraw canvas updates after successful source edits. Invalid intermediate source does not clear the previous valid presentation.

A Chromium smoke test covers the real browser path from editing a title through visible canvas update, followed by an invalid edit that surfaces diagnostics while preserving the last-good canvas.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.
