// While the app starts (signing in, loading your settings), the screen already has the app's shape: the
// sidebar, the top bar and the message box in their real places, with soft placeholder bars. When the app is
// ready, the real content fades in over the same frame, so nothing jumps. index.html shows the same markup
// before any code has loaded (keep the two in step).
export default function AppSkeleton() {
  return (
    <div className="app app-skeleton" aria-busy="true" aria-label="Loading Lumen">
      <aside className="sidebar" aria-hidden="true">
        <div className="sk-brand"><span className="sk sk-dot" /><span className="sk" style={{ width: 64 }} /></div>
        <span className="sk sk-field" />
        <div className="sk-list">
          {[70, 52, 84, 46, 62, 74, 40].map((w, i) => <span key={i} className="sk" style={{ width: `${w}%` }} />)}
        </div>
      </aside>
      <main className="main is-empty" aria-hidden="true">
        <header className="topbar"><span className="sk sk-dot" /><span className="sk" style={{ width: 110 }} /></header>
        <div className="conversation-area"><div className="messages"><div className="empty sk-welcome"><span className="sk sk-star" /><span className="sk sk-title" /></div></div></div>
        <div className="composer-wrap"><div className="composer sk-composer" /></div>
      </main>
    </div>
  );
}

/** Placeholder lines for a list or text that's still loading (screen readers hear `label`). */
export function SkeletonRows({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="sk-rows" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <span key={i} className="sk" style={{ width: `${[88, 64, 76, 52][i % 4]}%` }} />)}
    </div>
  );
}
