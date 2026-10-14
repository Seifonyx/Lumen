import Modal from './Modal';
import { SHORTCUTS } from '../lib/shortcuts';

/** The keyboard cheat sheet (Ctrl/⌘ + / or ? anywhere outside a text field). */
export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div className="shortcuts">
        {groups.map((group) => (
          <section key={group} className="shortcuts-group">
            <h3>{group}</h3>
            <dl>
              {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                <div key={s.id} className="shortcut-row">
                  <dt>{s.label}</dt>
                  <dd>{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="muted small shortcuts-note">Enter sends; Shift+Enter adds a new line. Arrow keys move through menus and lists.</p>
      </div>
    </Modal>
  );
}
