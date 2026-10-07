import type { Context } from '@deepseek-ai/cordis'
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { MINDPPT_BODY_ID } from '../shared.ts'
import { MindPptDocument, type MindPptDocumentProps, type SidebarRightFace } from './Document.tsx'
import { PreviewAction, type PreviewActionProps } from './PreviewAction.tsx'
import { PreviewPage } from './PreviewPage.tsx'
import type { WorkspaceFilesRemote } from './dsh.ts'

type SlotProps = Omit<MindPptDocumentProps, 'remote' | 'sidebarRight'>

interface ClientContext extends Context {
  documentPreviews: {
    register(definition: {
      id: string
      extensions: readonly string[]
      priority: 'extension'
      title(): string
      loading: 'renderer'
      wrap: boolean
    }): () => void
  }
  slots: {
    inject(
      name: 'sidebar.right.tab.document' | 'sidebar.right.tab.document.action',
      setup: () => () => void,
    ): () => void
    register(
      definition: { name: 'sidebar.right.tab.document'; key: string },
      component: (props: SlotProps) => ReactNode,
    ): () => void
    register(
      definition: { name: 'sidebar.right.tab.document.action'; key: string },
      component: (props: PreviewActionProps) => ReactNode,
    ): () => void
  }
  remote: { workspaceFiles: WorkspaceFilesRemote }
  sidebarRight: SidebarRightFace
}

export const name = 'dsh-mindppt-client'
export const inject = [
  'documentPreviews', 'slots', 'remote', 'remote.workspaceFiles', 'sidebarRight',
]

export function apply(ctx: Context): void {
  const client = ctx as ClientContext
  ctx.effect(
    () => client.documentPreviews.register({
      id: MINDPPT_BODY_ID,
      extensions: ['mindppt'],
      priority: 'extension',
      title: () => 'MindPPT',
      loading: 'renderer',
      wrap: false,
    }),
    'dsh-mindppt: document metadata',
  )
  ctx.effect(
    () => client.slots.inject(
      'sidebar.right.tab.document',
      () => client.slots.register(
        { name: 'sidebar.right.tab.document', key: MINDPPT_BODY_ID },
        props => (
          <MindPptDocument
            {...props}
            remote={client.remote.workspaceFiles}
            sidebarRight={client.sidebarRight}
          />
        ),
      ),
    ),
    'dsh-mindppt: document body',
  )
  ctx.effect(
    () => client.slots.inject(
      'sidebar.right.tab.document.action',
      () => client.slots.register(
        { name: 'sidebar.right.tab.document.action', key: MINDPPT_BODY_ID },
        props => <PreviewAction {...props} />,
      ),
    ),
    'dsh-mindppt: document preview action',
  )
  mountPreviewPage(ctx, client.remote.workspaceFiles)
}

function mountPreviewPage(ctx: Context, remote: WorkspaceFilesRemote): void {
  const resourceAddress = new URL(window.location.href)
    .searchParams.get('mindppt-preview')
  if (!resourceAddress) return
  const container = document.createElement('div')
  container.dataset.mindpptPreview = 'true'
  document.body.append(container)
  const root = createRoot(container)
  root.render(<PreviewPage resourceAddress={resourceAddress} remote={remote} />)
  ctx.effect(() => () => {
    root.unmount()
    container.remove()
  }, 'dsh-mindppt: preview page')
}
