# dsh-mindppt-canvas-excalidraw

Cordis-native renderer that subscribes to `mindppt/compiled` and mechanically lowers resolved MindPPT structure into official Excalidraw Skeletons.

The renderer does not parse source and does not perform presentation layout.

## Current M1 scene

```text
MindPptStructure
  - two 1600x900 slides
  - one resolved LR tree edge
        |
        v
canvas-excalidraw
  - white slide surface as the only visible PPT boundary
  - centered title text
  - Excalidraw frame
  - arrow between slide boundaries
        |
        v
browser host: convertToExcalidrawElements()
        |
        v
<Excalidraw />
```

Scene lowering lives separately from the Cordis service lifecycle so each file keeps one focused responsibility.

Direct canvas editing remains outside the source-of-truth path.
