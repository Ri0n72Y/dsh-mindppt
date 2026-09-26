# dsh-mindppt-canvas-excalidraw

Cordis-native renderer that subscribes to `mindppt/compiled` and lowers the resolved MindPPT structure into official Excalidraw Skeletons.

The renderer does not parse source and does not perform presentation layout.

Current hello-world slice:

```text
MindPPT source
  -> ctx.mindpptParser.compile()
  -> mindppt/compiled
  -> ctx.mindpptCanvas.scene
  -> Excalidraw Skeleton
  -> browser host: convertToExcalidrawElements()
  -> <Excalidraw />
```

A slide currently renders as a simple shadow, white 16:9 surface, title content, and Excalidraw frame.

Direct canvas editing is intentionally outside the source-of-truth path.
