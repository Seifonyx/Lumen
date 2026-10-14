import { useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  ScrollText,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Modal from './Modal';
import { modelLabel, useStore } from '../store';
import { readAttachment } from '../lib/files/read';
import type { Attachment, Project } from '../types';
import { formatBytes, uid } from '../lib/util';

const EMPTY_PROJECTS: Project[] = [];

const PRESET_TEMPLATES = [
  { label: '+ Technical & Code', text: 'Focus on production-grade, typed, modular code with clean architectural explanations.' },
  { label: '+ Research & Sources', text: 'Ground answers in reliable sources and cite them. Say clearly when something is uncertain.' },
  { label: '+ Direct & Concise', text: 'Keep responses concise, direct, and structured. Avoid conversational preamble.' },
  { label: '+ Structured Markdown', text: 'Use structured markdown with headers, bullet points, and syntax-highlighted code blocks.' },
  { label: '+ Egyptian Arabic', text: 'Respond in professional Egyptian Arabic unless prompted in English.' },
];

const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', bg: 'var(--accent)' },
  { id: 'emerald', label: 'Emerald', bg: '#10b981' },
  { id: 'amber', label: 'Amber', bg: '#f59e0b' },
  { id: 'rose', label: 'Rose', bg: '#f43f5e' },
  { id: 'cyan', label: 'Cyan', bg: '#06b6d4' },
  { id: 'purple', label: 'Purple', bg: '#8b5cf6' },
];

export default function ProjectManager({
  onClose,
  initialProjectId,
}: {
  onClose: () => void;
  initialProjectId?: string;
  createNewImmediately?: boolean;
}) {
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const catalog = useStore((s) => s.catalog);
  const enabledModels = useStore((s) => s.settings.enabledModels);
  const { saveProject, deleteProject, selectProject, toast } = useStore.getState();

  const [selected] = useState<Project | null>(() => {
    if (initialProjectId) {
      return projects.find((p) => p.id === initialProjectId) || null;
    }
    {
      return {
        id: uid(),
        name: '',
        instructions: '',
        files: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    return null;
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [color, setColor] = useState('indigo');
  const [files, setFiles] = useState<Attachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name || '');
    setDescription(selected.description || '');
    setInstructions(selected.instructions || '');
    setDefaultModel(selected.defaultModel || '');
    setColor(selected.color || 'indigo');
    setFiles(selected.files || []);
  }, [selected]);

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast('Please enter a project name', 'error');
      return;
    }
    const project: Project = {
      ...(selected || { id: uid(), createdAt: Date.now(), updatedAt: Date.now() }),
      name: trimmedName,
      description: description.trim() || undefined,
      instructions,
      files,
      color,
      defaultModel: defaultModel || undefined,
      updatedAt: Date.now(),
    };
    if (!saveProject(project)) return;
    selectProject(project.id);
    onClose();
  };

  const addFiles = async (incoming: File[]) => {
    const remainingSlots = Math.max(0, 5 - files.length);
    for (const file of incoming.slice(0, remainingSlots)) {
      try {
        const attachment = await readAttachment(file, { textOnly: true });
        if (!attachment.text) throw new Error(`${file.name}: couldn't extract text.`);
        setFiles((current) => [...current, { ...attachment, text: attachment.text!.slice(0, 20000) }]);
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
    if (incoming.length > remainingSlots) {
      toast('A project can keep up to 5 reference files.', 'error');
    }
  };

  const appendTemplate = (text: string) => {
    const next = instructions.trim() ? `${instructions.trim()}\n• ${text}` : `• ${text}`;
    setInstructions(next);
  };

  const isEditingExisting = selected && projects.some((p) => p.id === selected.id);

  // Opened without a project: start a new one.
  const current = selected || null;

  return (
    <Modal title={isEditingExisting ? 'Edit project' : 'New project'} onClose={onClose}>
      <div className="project-edit-form">
        <label className="pf-field">
          <span className="pf-label">Name</span>
          <input aria-label="Project name" value={name} maxLength={60} autoFocus={!isEditingExisting} placeholder="e.g. Monthly reports" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="pf-field">
          <span className="pf-label">Description <em>optional</em></span>
          <input aria-label="Project description" value={description} maxLength={160} placeholder="What this project is for" onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="pf-field">
          <span className="pf-label" id="project-color-label">Colour</span>
          <div className="project-color-choices" role="radiogroup" aria-labelledby="project-color-label">
            {COLOR_OPTIONS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={c.label} className={`project-color-dot color-${c.id}${color === c.id ? ' active' : ''}`} onClick={() => setColor(c.id)} />
            ))}
          </div>
        </div>
        <label className="pf-field">
          <span className="pf-label">Instructions <em>optional</em></span>
          <span className="pf-hint">How models should work here: tone, language, what to focus on.</span>
          <textarea aria-label="Project instructions" value={instructions} maxLength={12000} rows={5} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Write formal reports for the management team. Use metric units." />
          <span className="pf-presets">
            <span className="pf-hint">Add:</span>
            {PRESET_TEMPLATES.map((t) => (
              <button key={t.label} type="button" className="pf-preset" onClick={() => appendTemplate(t.text)}>{t.label.replace(/^\+\s*/, '')}</button>
            ))}
          </span>
        </label>
        <div className="pf-field">
          <span className="pf-label">Files <em>{files.length}/5 · every chat here can read them</em></span>
          <input ref={fileInput} hidden type="file" multiple accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.py,.css,.sql,.log,.yaml,.yml,.srt,.tex" onChange={(e) => { void addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
          {files.length > 0 && (
            <ul className="pf-files">
              {files.map((file) => {
                const Icon = /\.(xlsx|xlsm|csv|tsv)$/i.test(file.name) ? FileSpreadsheet : /\.(docx|pdf|txt|md)$/i.test(file.name) ? FileText : ScrollText;
                return (
                  <li className="project-file" key={file.id}>
                    <Icon size={16} />
                    <span title={file.name}>{file.name}</span>
                    <small>{formatBytes(file.size || file.text?.length || 0)}</small>
                    <button type="button" className="icon-btn xs" aria-label={`Remove ${file.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.id !== file.id))}><X size={14} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="btn small pf-add" disabled={files.length >= 5} onClick={() => fileInput.current?.click()}><Upload size={14} /> Add files</button>
        </div>
        <label className="pf-field">
          <span className="pf-label">Model</span>
          <select aria-label="Default project model" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>
            <option value="">Same as the rest of the app</option>
            {enabledModels.map((id) => <option key={id} value={id}>{modelLabel(catalog, id)}</option>)}
          </select>
        </label>
        <div className="project-form-actions">
          {isEditingExisting && current && (
            <button type="button" className="btn ghost danger" onClick={() => { if (confirm(`Delete the project “${current.name}”? Its chats stay in your chat list.`)) { deleteProject(current.id); onClose(); } }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={!name.trim()} onClick={save}>{isEditingExisting ? 'Save changes' : 'Create project'}</button>
        </div>
      </div>
    </Modal>
  );
}
