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

M5 Camera Navigation is complete. The Cordis-native `camera` service owns semantic current-slide and topology navigation state, while the React / Excalidraw host owns viewport choreography.

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
 CameraFocusRequest(revision, from?, target)
              |
              v
      React host sequencer
              |
              v
 current Excalidraw scene lookup
              |
              v
 zoom out -> travel -> zoom in
```

Direct target focus and primary-tree parent / child navigation all use the same semantic focus request. Normal slide-to-slide movement zooms out around the current slide, travels to the target at that wider scale, then fits the target to approximately 85% of the viewport. The first focus from the overview skips the redundant zoom-out phase, while repeated same-slide focus performs only the final animated framing.

Each transition phase resolves the stable `slide:<id>/surface` from the current Excalidraw scene immediately before calling `scrollToContent()`. Source recompiles therefore do not automatically refocus the camera, but an in-flight transition can continue against the latest successful scene geometry.

A newer camera request cancels the previous host sequence before its remaining phases can run. Initial load remains the complete mind-map overview, failed compiles preserve the last-good scene and camera state, and successful removal of the current slide clears its focus request.

Run the standalone playground with:

```sh
pnpm install
pnpm dev
```

The canvas remains a projection of source code. Direct canvas editing is not a semantic authoring path.
