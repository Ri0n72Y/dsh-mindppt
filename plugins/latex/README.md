# dsh-mindppt-latex

M9 reference content plugin for MindPPT.

The package is a real Cordis plugin that claims only the `latex` extension renderer capability from `mindpptCanvas`. Registration is owned by the plugin fiber through `ctx.effect()`, so unloading the fiber removes the renderer and reprojects the current last-successful semantic structure through generic fallback.

The renderer does not add grammar, modify `ExtensionNode`, request layout changes, or touch Camera state. It uses the existing compiler-owned extension box and lowers the supported M9 formula profile into deterministic Excalidraw primitives with separate baseline and superscript placement.
