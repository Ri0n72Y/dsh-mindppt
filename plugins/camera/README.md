# dsh-mindppt-camera

Cordis-native presentation navigation service for MindPPT.

The camera consumes only the latest successful `MindPptStructure`: slide geometry and primary-tree edges. It does not parse slide content and has no dependency on React or Excalidraw.

M5.1 supports:

- direct slide focus;
- parent -> child navigation;
- child -> parent navigation;
- current target geometry and primary-tree relationship views;
- request revisions so a repeated focus of the same slide remains an explicit viewport command.

Compile failures leave camera state untouched because the parser does not publish a new successful structure. A successful compile keeps the current slide when it still exists and clears camera state when it was removed.

The service key is `mindpptCamera`.
