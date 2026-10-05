import type { MindPptWorkspaceController } from './controller.ts'

interface ToolExecution {
  signal: AbortSignal
  agent?: { id: string }
}

interface ToolDefinition {
  name: string
  description: string
  parameters: object
  output: {
    schema: object
    render(args: unknown, value: unknown): Array<{ type: 'text'; text: string }>
  }
  execute(args: unknown, exec: ToolExecution): Promise<unknown>
}

interface ToolRegistry {
  register(tool: ToolDefinition): () => void
}

const output = {
  schema: {},
  render(_args: unknown, value: unknown) {
    return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  },
}

function sessionId(exec: ToolExecution): string {
  if (!exec.agent) throw new Error('MindPPT tools require an active Agent session')
  return String(exec.agent.id)
}

export function registerMindPptTools(
  tools: ToolRegistry,
  controller: MindPptWorkspaceController,
): Array<() => void> {
  return [
    tools.register({
      name: 'mindppt_inspect',
      description: 'Inspect the selected .mindppt source and its current or last-good semantic structure.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      output,
      async execute(_args, exec) {
        return controller.inspect(sessionId(exec))
      },
    }),
    tools.register({
      name: 'mindppt_patch',
      description: 'Guardedly replace or delete one existing non-empty source span in the selected .mindppt file.',
      parameters: {
        type: 'object',
        properties: {
          start: { type: 'integer' },
          end: { type: 'integer' },
          expected: { type: 'string' },
          replacement: { type: 'string' },
        },
        required: ['start', 'end', 'expected', 'replacement'],
        additionalProperties: false,
      },
      output,
      async execute(args, exec) {
        const patch = args as {
          start: number
          end: number
          expected: string
          replacement: string
        }
        return controller.guardedPatch(sessionId(exec), patch, exec.signal)
      },
    }),
    tools.register({
      name: 'mindppt_guidance',
      description: 'Return concise MindPPT v0 authoring syntax and the active extension renderer types.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      output,
      async execute(_args, exec) {
        const inspect = controller.inspect(sessionId(exec))
        return {
          syntax: [
            'mindppt',
            'tree LR { parent --> child }',
            'slide <id> { Markdown content }',
            'link <from> -.-> <to>',
            'path <name> { slideId ... }',
            'layout hero | title-content | two-column',
            'local image: ![alt](./relative/path.png)',
            'table { header [...] row [...] }',
            'chart bar { labels [...] values [...] }',
            'extension: fenced block whose info string is the renderer type',
          ],
          activeExtensionRendererTypes: inspect.activeExtensionRendererTypes,
        }
      },
    }),
  ]
}
