# dsh-mindppt-code-parser

Cordis-native compiler service for MindPPT source code.

The package intentionally exposes its compiler through the Cordis service graph rather than a standalone parser API.

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

## DeepSeek Harness bundle

The package ships `cordis.patch.yml` through the standard `dsh.bundle` manifest, so a DSH profile can install it as a normal plugin bundle:

```sh
dsh plugin --profile web add .
```

At this scaffold milestone the service only establishes the runtime boundary. The compiler implementation follows the milestones in `../../docs/code-parser.md`.
