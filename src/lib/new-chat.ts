// Canvas New chat (Phase 2 slice 2, owner decision 2026-10-23). Reached only through canvas-presentation.on.ts.
// Two kinds, never mixed:
//  - General: the drawer's bottom New chat, the desktop sidebar's, the collapsed rail's, the top bar's, ⌘⇧O and the
//    command palette. Always outside projects: the remembered ("sticky") project is cleared first, and the open
//    conversation's project is never borrowed. No chat is moved and no draft is touched.
//  - In a project: "New chat in <project>" in that project's folder (and the project page). Always in that project.
// Choosing a project in the composer, or creating one, still works as before (they set the project explicitly).
import { useStore } from '../store';

export function newGeneralChat() {
  if (useStore.getState().activeProjectId) {
    try { localStorage.removeItem('mr.activeProject'); } catch { /* private mode */ }
    useStore.setState({ activeProjectId: null });
  }
  useStore.getState().newChat();
}

export function newProjectChat(projectId: string) {
  const s = useStore.getState();
  s.selectProject(projectId);
  s.newChat();
}
