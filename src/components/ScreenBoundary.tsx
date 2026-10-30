import { Component, type ReactNode } from 'react';

/** Keeps one screen's failure inside that screen: the rest of the app (the chat, its draft, navigation) stays usable.
 * Shows a plain message with Try again (re-mounts the screen) and Reload. Nothing about the error is shown or sent. */
export default class ScreenBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(`${this.props.label} failed to render`, error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="screen-failed" role="alert">
        <strong>{this.props.label} couldn’t load</strong>
        <p>Your chats and drafts are safe. Try again, or reload Lumen if it keeps happening.</p>
        <span><button type="button" className="rc-primary" onClick={() => this.setState({ failed: false })}>Try again</button><button type="button" className="rc-quiet" onClick={() => location.reload()}>Reload</button></span>
      </div>
    );
  }
}
