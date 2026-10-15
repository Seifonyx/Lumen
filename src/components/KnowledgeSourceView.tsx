import { useEffect, useState } from "react";
import { SkeletonRows } from './AppSkeleton';
import { ExternalLink } from "lucide-react";
import type { KnowledgeSource } from "../types";
import { useStore } from "../store";
import { original, page } from "../lib/knowledge/db";
import Modal from "./Modal";

export default function KnowledgeSourceView({
  source,
  onClose,
}: {
  source: KnowledgeSource;
  onClose: () => void;
}) {
  const account = useStore((s) => s.user?.uid);
  const [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [loading, setLoading] = useState(true),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true,
      objectUrl = "";
    setLoading(true);
    setText("");
    setUrl("");
    setMissing(false);
    if (!account) {
      setLoading(false);
      return;
    }
    void Promise.all([
      page(account, source.docId, source.page),
      original(account, source.docId),
    ])
      .then(([saved, file]) => {
        if (!live || useStore.getState().user?.uid !== account) return;
        setText(saved?.text || source.excerpt);
        setMissing(!saved);
        if (file?.type === "application/pdf" || /\.pdf$/i.test(source.title)) {
          if (file) {
            objectUrl = URL.createObjectURL(file);
            setUrl(`${objectUrl}#page=${source.page}`);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (live) {
          setText(source.excerpt);
          setMissing(true);
          setLoading(false);
        }
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [account, source]);
  return (
    <Modal title="Document source" onClose={onClose} wide>
      <div className="knowledge-source-view">
        <h3 dir="auto">{source.title}</h3>
        <p className="muted small">
          {/\.pdf$/i.test(source.title) ? "PDF page" : "Text section"}{" "}
          {source.page}
        </p>
        {loading ? (
          <SkeletonRows rows={4} label="Loading source" />
        ) : (
          <>
            {missing && (
              <p role="status" className="muted small">
                The original is not in this device library. This is the saved
                source excerpt; import the document on this device to read the
                original.
              </p>
            )}
            <pre className="knowledge-page" dir="auto">
              {text || "No saved source text is available."}
            </pre>
            {url && (
              <a
                className="btn"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} /> Open original PDF
              </a>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
