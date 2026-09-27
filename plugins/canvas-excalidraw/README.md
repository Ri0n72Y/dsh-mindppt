# dsh-mindppt-canvas-excalidraw

Cordis-native renderer that subscribes to `mindppt/compiled` and mechanically lowers resolved MindPPT structure into official Excalidraw Skeletons.

The renderer does not parse source and does not perform presentation layout.

## Current M2 scene

```text
MindPptStructure
  - 1280x720 slide surfaces
  - resolved LR tree edge
  - title / subtitle / text / list semantic boxes
  - generic extension semantic boxes
        |
        v
canvas-excalidraw
  - visible slide surface
  - text containers + labels
  - readable unknown-extension fallback
  - invisible Excalidraw grouping frame
  - tree arrow
        |
        v
browser host: convertToExcalidrawElements()
        |
        v
<Excalidraw />
```

Unknown extension types are not interpreted by this package. Their type and raw payload are shown through a generic fallback until a later runtime capability handles them.

Scene lowering lives separately from the Cordis service lifecycle. Direct canvas editing remains outside the source-of-truth path.
