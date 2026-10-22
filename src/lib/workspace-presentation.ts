/**
 * Type-only composition contract for an isolated presentation adapter.
 * These are the current owners, not runtime replacements or a feature flag.
 * App owns authentication/pages; Sidebar/ChatView own navigation/reading;
 * Composer owns its mounted input, draft, tools and Send/Stop.
 * CP02 must separately design any runtime composition/expanded-writing seam.
 */
import type { ComponentType } from 'react';
import type { AppProps } from '../App';
import type { SidebarProps } from '../components/Sidebar';
import type { ChatViewProps } from '../components/ChatView';
import type { ComposerProps } from '../components/Composer';

export interface WorkspacePresentation {
  readonly App: ComponentType<AppProps>;
  readonly Sidebar: ComponentType<SidebarProps>;
  readonly ChatView: ComponentType<ChatViewProps>;
  readonly Composer: ComponentType<ComposerProps>;
}
