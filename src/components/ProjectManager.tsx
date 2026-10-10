import { useEffect, useRef, useState } from 'react';
import { FileText, FolderKanban, Plus, Trash2, X } from 'lucide-react';
import Modal from './Modal';
import { modelLabel, useStore } from '../store';
import { readAttachment } from '../lib/files/read';
import type { Attachment, Project } from '../types';
import { uid } from '../lib/util';

const EMPTY_PROJECTS: Project[] = [];

export default function ProjectManager({ onClose }: { onClose: () => void }) {
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const catalog = useStore((s) => s.catalog);
  const enabledModels = useStore((s) => s.settings.enabledModels);
  const { saveProject, deleteProject, selectProject, toast } = useStore.getState();
  const [selected, setSelected] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setInstructions(selected.instructions || '');
    setDefaultModel(selected.defaultModel || '');
    setFiles(selected.files || []);
  }, [selected]);

  const create = () => setSelected({ id: uid(), name: '', instructions: '', files: [], createdAt: Date.now(), updatedAt: Date.now() });
  const save = () => {
    if (!name.trim()) return;
    const project = { ...(selected || { id: uid(), createdAt: Date.now(), updatedAt: Date.now() }), name: name.trim(), instructions, files, defaultModel: defaultModel || undefined };
    if (!saveProject(project)) return;
    selectProject(project.id);
    onClose();
  };
  const addFiles = async (incoming: File[]) => {
    for (const file of incoming.slice(0, Math.max(0, 5 - files.length))) {
      try {
        const attachment = await readAttachment(file, { textOnly: true });
        if (!attachment.text) throw new Error(`${file.name}: couldn't extract text.`);
        setFiles((current) => [...current, { ...attachment, text: attachment.text!.slice(0, 20000) }]);
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
    if (incoming.length > Math.max(0, 5 - files.length)) toast('A project can keep up to 5 reference files.', 'error');
  };

  return (
    <Modal title="Projects" onClose={onClose}>
      <div className="project-manager">
        {!selected ? (
          <>
            <p className="muted small">Keep related chats together with their own instructions and default model.</p>
            <button className="btn primary project-create" onClick={create} disabled={projects.length >= 25}><Plus size={16} /> New project</button>
            {projects.length > 0 && <div className="project-manage-list">{projects.map((project) => (
              <button key={project.id} className="project-manage-row" onClick={() => setSelected(project)}>
                <FolderKanban size={17} /><span>{project.name}</span><span className="muted small">Edit</span>
              </button>
            ))}</div>}
          </>
        ) : (
          <>
            <label className="field-block"><span className="setting-label">Project name</span><input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hospital reports" /></label>
            <label className="field-block"><span className="setting-label">Instructions for chats in this project</span><textarea value={instructions} maxLength={12000} onChange={(e) => setInstructions(e.target.value)} placeholder="Give chats in this project extra context or response preferences…" /></label>
            <div className="field-block project-files">
              <span className="setting-label">Reference files <span className="muted small">{files.length}/5 · text extracted</span></span>
              <input ref={fileInput} hidden type="file" multiple accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.py,.css,.sql,.log,.yaml,.yml,.srt,.tex" onChange={(e) => { void addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
              {files.map((file) => <div className="project-file" key={file.id}><FileText size={15} /><span title={file.name}>{file.name}</span><small>{Math.min(file.text?.length || 0, 20000).toLocaleString()} chars</small><button className="icon-btn xs" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((x) => x.id !== file.id))}><X size={14} /></button></div>)}
              <button className="btn small" disabled={files.length >= 5} onClick={() => fileInput.current?.click()}><Plus size={14} /> Add files</button>
              <span className="setting-hint">Text is included with project chats and synced across devices. Each file is capped at 20,000 characters; project instructions and files share a 150,000 character account limit.</span>
            </div>
            <label className="field-block"><span className="setting-label">Default model</span><select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}><option value="">Use app default</option>{enabledModels.map((id) => <option key={id} value={id}>{modelLabel(catalog, id)}</option>)}</select></label>
            <div className="project-form-actions">
              {projects.some((p) => p.id === selected.id) && <button className="btn danger" onClick={() => { if (confirm(`Delete project “${selected.name}”? Its chats will stay in All chats.`)) { deleteProject(selected.id); setSelected(null); } }}><Trash2 size={15} /> Delete</button>}
              <span />
              <button className="btn" onClick={() => setSelected(null)}>Back</button>
              <button className="btn primary" disabled={!name.trim() || (!projects.some((p) => p.id === selected.id) && projects.length >= 25)} onClick={save}>Save project</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
