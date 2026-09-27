# dsh-mindppt-code-parser

Cordis-native compiler service for MindPPT source code.

The package intentionally exposes compilation through the Cordis service graph rather than a parallel standalone runtime.

## Current M1 capability

The current compiler supports the first structural slice:

```text
mindppt marker
slide <id> { ... }
# heading
tree LR { ... }
A --> B
```

It produces deterministic slide geometry, one resolved LR tree edge, stable semantic IDs, and source ranges.

The tokenizer also treats triple-backtick fenced blocks as opaque input so future extension payload cannot leak braces or arrows into the structural grammar. Fenced slide content itself remains an M2 feature.

## Cordis service

Mount the plugin class into a Cordis context:

```ts
import { Context } from '@deepseek-ai/cordis'
import MindPptParserService from 'dsh-mindppt-code-parser'

const ctx = new Context()
await ctx.plugin(MindPptParserService)

// Other plugins consume ctx.mindpptParser.
```

The service key is `mindpptParser`.

The implementation order and compiler boundaries are defined in `docs/roadmap.md` and `docs/code-parser.md`.
