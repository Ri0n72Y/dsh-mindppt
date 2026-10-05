import {
  defineTool,
  type ToolDefinition,
  type ToolRunContext,
} from '@deepseek-ai/dsh-tools'
import type { MindPptWorkspaceController } from './controller.ts'

interface ToolRegistry {
  register(tool: ToolDefinition): () => void
}

const output = {
  schema: { type: 'json' as const },
  render(_args: unknown, value: unknown) {
    return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  },
}

function sessionId(exec: ToolRunContext): string {
  if (!exec.agent) throw new Error('MindPPT tools require an active Agent session')
  return String(exec.agent.id)
}

export function registerMindPptTools(
  tools: ToolRegistry,
  controller: MindPptWorkspaceController,
): Array<() => void> {
  return [
    tools.register(defineTool({
      name: 'mindppt_inspect',
      description: 'Inspect the selected .mindppt source and its current or last-good semantic structure.',
      parameters: {},
      output,
      async execute(_args, exec) {
        return controller.inspect(sessionId(exec))
      },
    })),
    tools.register(defineTool({
      name: 'mindppt_patch',
      description: 'Guardedly replace or delete one existing non-empty source span in the selected .mindppt file.',
      parameters: {
        start: { type: 'integer', required: true },
        end: { type: 'integer', required: true },
        expected: { type: 'string', required: true },
        replacement: { type: 'string', required: true },
      },
      output,
      async execute(args, exec) {
        return controller.guardedPatch(sessionId(exec), args, exec.signal)
      },
    })),
    tools.register(defineTool({
      name: 'mindppt_guidance',
      description: 'Return concise MindPPT v0 authoring syntax and the active extension renderer types.',
      parameters: {},
      output,
      async execute(_args, exec) {
        const inspect = controller.inspect(sessionId(exec))
        return {
          syntax: [
            'mindppt',
            'tree: directed slide hierarchy',
            'slide <id>: Markdown content',
            'link <from> -> <to>',
            'path <name>: ordered slide occurrences',
            'layouts: hero | title-content | two-column',
            'local image: Markdown image with a relative path',
            'structured: table and chart bar',
            'extension fence: fenced block whose info string is the renderer type',
          ],
          activeExtensionRendererTypes: inspect.activeExtensionRendererTypes,
        }
      },
    })),
  ]
}
