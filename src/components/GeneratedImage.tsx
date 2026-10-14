import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { fetchOriginal } from '../lib/sync';
import { saveBlob } from '../lib/util';
import { useStore } from '../store';
import type { Message } from '../types';

/** A reply that is a created image: the picture, which model made it, Download and Make another. */
export default function GeneratedImage({ message }: { message: Message }) {
  const file = message.files!.find((f) => f.kind === 'image')!;
  const [data, setData] = useState(file.data);
  const busy = useStore((s) => s.streamingChatId !== null);
  const prompt = useStore((s) => {
    const msgs = s.chats.find((c) => c.id === s.currentId)?.messages || [];
    const i = msgs.findIndex((m) => m.id === message.id);
    return msgs.slice(0, i).reverse().find((m) => m.role === 'user')?.text || '';
  });
  // Made on another device: fetch the synced copy (the thumbnail shows meanwhile).
  useEffect(() => {
    const uid = useStore.getState().user?.uid;
    if (data || !file.stored || !uid) return;
    let live = true;
    void fetchOriginal(uid, file.id).then((o) => { if (live && o) setData(o.data); });
    return () => { live = false; };
  }, [data, file.id, file.stored]);
  const src = data ? `data:${file.mime || 'image/jpeg'};base64,${data}` : file.thumb;
  const download = async () => {
    if (!data) return;
    await saveBlob(new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: file.mime || 'image/jpeg' }), file.name);
  };
  return (
    <figure className="generated-image">
      {src && <img src={src} alt={prompt || file.name} />}
      <figcaption>
        <span className="model-tag">{message.model}</span>
        <span className="spacer" />
        <button className="btn ghost small" disabled={!data} onClick={() => void download()}><Download size={15} /> Download</button>
        {prompt && <button className="btn ghost small" disabled={busy} onClick={() => void useStore.getState().createImage(prompt)}><RefreshCw size={15} /> Make another</button>}
      </figcaption>
    </figure>
  );
}
