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

Keeping the final Excalidraw browser conversion in the host avoids importing the browser-heavy Excalidraw runtime into Node-side Cordis tests while retaining Excalidraw's official programmatic element format.

Direct canvas editing is intentionally outside the source-of-truth path.
