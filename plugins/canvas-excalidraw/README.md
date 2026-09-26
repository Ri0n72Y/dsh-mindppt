# dsh-mindppt-canvas-excalidraw

Cordis-native renderer that subscribes to `mindppt/compiled` and lowers the resolved MindPPT structure into Excalidraw elements.

The renderer does not parse source and does not perform presentation layout.

Current hello-world slice:

```text
MindPPT source
  -> ctx.mindpptParser.compile()
  -> mindppt/compiled
  -> ctx.mindpptCanvas
  -> Excalidraw text + frame
```

Direct canvas editing is intentionally outside the source-of-truth path.
