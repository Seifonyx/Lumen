// CodeMirror editor for repository files. Loaded on demand (its own chunk).
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';

function language(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['js', 'mjs', 'cjs', 'jsx'].includes(ext)) return javascript({ jsx: true });
  if (['ts', 'mts', 'cts', 'tsx'].includes(ext)) return javascript({ jsx: ext === 'tsx', typescript: true });
  if (['html', 'htm', 'vue', 'svelte'].includes(ext)) return html();
  if (['css', 'scss', 'less'].includes(ext)) return css();
  if (['json', 'jsonc', 'webmanifest'].includes(ext)) return json();
  if (['md', 'mdx', 'markdown'].includes(ext)) return markdown();
  if (ext === 'py') return python();
  return [];
}

const dark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

const base = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6' },
  '.cm-gutters': { borderRight: '1px solid var(--border)' },
});

export default function CodeEditor({ path, value, onChange, readOnly = false }: { path: string; value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    const theme = new Compartment();
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          language(path),
          base,
          theme.of(dark() ? oneDark : []),
          EditorView.lineWrapping,
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) changeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => v.dispatch({ effects: theme.reconfigure(dark() ? oneDark : []) });
    mq.addEventListener('change', onTheme);
    return () => {
      mq.removeEventListener('change', onTheme);
      v.destroy();
    };
    // A new file gets a new editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly]);

  // Outside changes (an applied edit, a revert) replace the text.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div className="code-editor" ref={host} />;
}
