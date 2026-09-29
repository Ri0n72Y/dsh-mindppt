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


## Current vertical slice: M5

M4 completed branching primary-tree validation and deterministic spatial layout in `LR`, `RL`, `TB`, `TD`, and `BT`.

M5 is now in progress. Its first vertical slice adds the Cordis-native `camera` service and keeps presentation navigation separate from both source semantics and React-local UI state.

The canonical browser fixture is:

`examples/m4-branching-lr-tree.mindppt`

The current runtime path is:

```text
successful structure
    |
    +--> canvas scene
    |
    +--> camera navigation state
              |
              v
       focus request revision
              |
              v
        React host bridge
              |
              v
   Excalidraw viewport focus
```

Direct target focus and primary-tree parent/child navigation are available. The host projects each real navigation request to the stable `slide:<id>/surface` element with a single-step Excalidraw viewport operation.

Initial load remains the complete mind-map overview. Source recompiles do not automatically pull the viewport back to the current slide, while failed compiles keep both the last-good scene and camera state.

The three-stage `zoom out -> travel -> zoom in` choreography remains intentionally deferred until this first camera slice is evaluated in practice.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.
