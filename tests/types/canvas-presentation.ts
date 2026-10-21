// Compile-only contract: these interfaces must preserve current callers and cannot carry credentials/state.
import type { ComponentType } from 'react';
import App, { type AppProps } from '../../src/App';
import Sidebar, { type SidebarProps } from '../../src/components/Sidebar';
import ChatView, { type ChatViewProps } from '../../src/components/ChatView';
import Composer, { type ComposerProps } from '../../src/components/Composer';
import type { WorkspacePresentation } from '../../src/lib/workspace-presentation';

export const canonical: WorkspacePresentation = { App, Sidebar, ChatView, Composer };
export const application: AppProps = {};
export const navigation: SidebarProps = { onCollapse() {} };
export const conversation: ChatViewProps = { onExpandSidebar() {} };
export const writing: ComposerProps = { model: 'auto', meter: null, modelPicker: null };
export type RootTakesNoProps = Parameters<typeof App>['length'] extends 0 ? true : never;
export const rootTakesNoProps: RootTakesNoProps = true;
export const applicationModule: ComponentType<AppProps> = App;
// @ts-expect-error Credentials are never a presentation prop.
export const unsafeApp: AppProps = { apiKey: 'synthetic-contract-marker' };
// @ts-expect-error Navigation needs the canonical collapse callback.
export const missingNavigation: SidebarProps = {};
// @ts-expect-error Composer does not accept a second dispatch owner.
export const unsafeWriting: ComposerProps = { model: 'auto', send() {} };
// @ts-expect-error Conversation does not accept an alternate account store.
export const unsafeConversation: ChatViewProps = { onExpandSidebar() {}, account: {} };
// @ts-expect-error Presentation role ownership cannot be reassigned.
canonical.App = App;
