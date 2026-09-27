# dsh-mindppt-code-editor

Cordis-native source editing service for MindPPT.

M3 gives source editing its own lifecycle boundary. The editor owns the current authoring source and forwards each source change to the parser.

```text
setSource(source)
    |
    v
mindpptParser.compile(source)
   / \
success error
 |       |
 v       v
compiled diagnostics
scene    parser keeps last-good structure
```

The editor does not duplicate parser diagnostics or compiled structures.

The service key is `mindpptEditor`.
