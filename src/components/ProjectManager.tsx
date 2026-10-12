import { useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Plus,
  ScrollText,
  Trash2,
  Upload,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Modal from './Modal';
import { modelLabel, useStore } from '../store';
import { readAttachment } from '../lib/files/read';
import type { Attachment, Project } from '../types';
import { uid } from '../lib/util';

const EMPTY_PROJECTS: Project[] = [];

const PRESET_TEMPLATES = [
  { label: '+ Technical & Code', text: 'Focus on production-grade, typed, modular code with clean architectural explanations.' },
  { label: '+ Clinical & Healthcare', text: 'Use metric units and clinical terminology. Ground answers in verified medical sources.' },
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
  createNewImmediately,
}: {
  onClose: () => void;
  initialProjectId?: string;
  createNewImmediately?: boolean;
}) {
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const chats = useStore((s) => s.chats);
  const catalog = useStore((s) => s.catalog);
  const enabledModels = useStore((s) => s.settings.enabledModels);
  const { saveProject, deleteProject, selectProject, toast } = useStore.getState();

  const [selected, setSelected] = useState<Project | null>(() => {
    if (initialProjectId) {
      return projects.find((p) => p.id === initialProjectId) || null;
    }
    if (createNewImmediately || projects.length === 0) {
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

  const startCreate = () =>
    setSelected({
      id: uid(),
      name: '',
      instructions: '',
      files: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

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

  const totalChars = (files || []).reduce((sum, f) => sum + (f.text?.length || 0), 0) + instructions.length;
  const isEditingExisting = selected && projects.some((p) => p.id === selected.id);

  return (
    <Modal
      title={
        selected
          ? isEditingExisting
            ? `Project Settings: ${selected.name}`
            : 'Create New Project'
          : 'Projects'
      }
      onClose={onClose}
    >
      <div className="project-manager-modal-inner">
        {!selected ? (
          <>
            <div className="project-modal-top-bar">
              <div>
                <p className="muted small" style={{ margin: 0 }}>
                  Organize chats, reference files, and tailored guidelines into dedicated workspaces like Claude and ChatGPT.
                </p>
              </div>
              <button
                type="button"
                className="btn primary small"
                onClick={startCreate}
                disabled={projects.length >= 25}
              >
                <Plus size={15} /> New project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="project-welcome" style={{ padding: '36px 16px' }}>
                <div className="project-welcome-icon">
                  <FolderKanban size={28} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 600 }}>
                  Create your first project
                </h3>
                <p className="muted small" style={{ maxWidth: 380, margin: '0 0 16px' }}>
                  Group conversations by topic, upload reference documentation that AI models reference
                  automatically, and set custom response guidelines.
                </p>
                <button type="button" className="btn primary" onClick={startCreate}>
                  <Plus size={16} /> Create project
                </button>
              </div>
            ) : (
              <div className="project-cards-grid" style={{ marginTop: 12 }}>
                {projects.map((project) => {
                  const count = chats.filter((c) => c.projectId === project.id).length;
                  const docCount = (project.files || []).length;
                  return (
                    <div
                      key={project.id}
                      className="project-card-item"
                      onClick={() => {
                        selectProject(project.id);
                        onClose();
                      }}
                    >
                      <div>
                        <div className="project-card-head">
                          <div className={`project-avatar-sm color-${project.color || 'indigo'}`}>
                            <FolderKanban size={18} />
                          </div>
                          <span className="project-card-name">{project.name}</span>
                        </div>
                        {project.description && (
                          <p className="project-card-desc muted small">{project.description}</p>
                        )}
                        <div className="project-card-stats">
                          <span className="project-stat-pill">
                            {count} chat{count === 1 ? '' : 's'}
                          </span>
                          <span className="project-stat-pill">
                            {docCount} doc{docCount === 1 ? '' : 's'}
                          </span>
                          {project.defaultModel && (
                            <span className="project-stat-pill" title="Default Model">
                              <Sparkles size={11} style={{ display: 'inline', verticalAlign: -1 }} />{' '}
                              {modelLabel(catalog, project.defaultModel)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="project-card-actions-row">
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(project);
                          }}
                        >
                          Configure
                        </button>
                        <button
                          type="button"
                          className="btn primary sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectProject(project.id);
                            onClose();
                          }}
                        >
                          Open <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Form for Create / Edit Project */
          <div className="project-edit-form">
            <div className="settings-group">
              <span className="settings-group-title">Project Details</span>
              <div className="settings-card">
                <div className="setting-row">
                  <div className="setting-text">
                    <span className="setting-label">Project Name *</span>
                    <span className="setting-hint">E.g., Medical Assistant, TypeScript Architecture</span>
                  </div>
                  <div className="setting-ctrl">
                    <input
                      autoFocus
                      value={name}
                      maxLength={60}
                      style={{ width: 280 }}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter project name"
                    />
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <span className="setting-label">Description</span>
                    <span className="setting-hint">Optional subtitle for your workspace</span>
                  </div>
                  <div className="setting-ctrl">
                    <input
                      value={description}
                      maxLength={160}
                      style={{ width: 280 }}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="E.g., Production guidelines and reference docs"
                    />
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <span className="setting-label">Theme Color</span>
                    <span className="setting-hint">Badge color in navigation</span>
                  </div>
                  <div className="setting-ctrl">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`project-color-dot${color === c.id ? ' active' : ''}`}
                          style={{ background: c.bg }}
                          title={c.label}
                          onClick={() => setColor(c.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-text">
                    <span className="setting-label">Default Model</span>
                    <span className="setting-hint">Selected automatically for chats in this project</span>
                  </div>
                  <div className="setting-ctrl">
                    <select
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                      style={{ width: 250 }}
                    >
                      <option value="">Use application default (Auto)</option>
                      {enabledModels.map((id) => (
                        <option key={id} value={id}>
                          {modelLabel(catalog, id)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Knowledge files */}
            <div className="settings-group">
              <span className="settings-group-title">
                Project Knowledge ({files.length}/5 files) · {totalChars.toLocaleString()} / 150,000 chars
              </span>
              <div className="settings-card" style={{ padding: '16px 18px' }}>
                <p className="muted small" style={{ margin: '0 0 10px' }}>
                  Uploaded files are parsed and automatically injected into every conversation in this project.
                </p>

                <div className="project-quota-track" style={{ marginBottom: 12 }}>
                  <div
                    className="project-quota-fill"
                    style={{ width: `${Math.min(100, Math.round((totalChars / 150000) * 100))}%` }}
                  />
                </div>

                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  multiple
                  accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.py,.css,.sql,.log,.yaml,.yml,.srt,.tex"
                  onChange={(e) => {
                    void addFiles([...(e.target.files || [])]);
                    e.target.value = '';
                  }}
                />

                {files.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {files.map((file) => {
                      const isSheet = /\.(xlsx|xlsm|csv|tsv)$/i.test(file.name);
                      const isDoc = /\.(docx|pdf|txt|md)$/i.test(file.name);
                      const Icon = isSheet ? FileSpreadsheet : isDoc ? FileText : ScrollText;
                      return (
                        <div className="project-file" key={file.id}>
                          <Icon size={16} style={{ color: 'var(--text-2)' }} />
                          <span title={file.name}>{file.name}</span>
                          <small>{(file.text?.length || 0).toLocaleString()} chars</small>
                          <button
                            type="button"
                            className="icon-btn xs"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => setFiles((current) => current.filter((x) => x.id !== file.id))}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="btn small"
                  disabled={files.length >= 5}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={14} /> Add reference files
                </button>
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="settings-group">
              <span className="settings-group-title">Project Instructions</span>
              <div className="settings-card" style={{ padding: '16px 18px' }}>
                <p className="muted small" style={{ margin: '0 0 10px' }}>
                  Custom behavior and persona followed by all models answering inside this project.
                </p>

                <div className="preset-chips" style={{ margin: '0 0 8px' }}>
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      type="button"
                      className="preset-chip"
                      onClick={() => appendTemplate(tmpl.text)}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={instructions}
                  maxLength={12000}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Examples:&#10;• Always ground answers in the project reference documents.&#10;• Write responses in TypeScript with concise explanations.&#10;• Use metric units and professional tone."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span className="muted small">{instructions.length}/12,000</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="project-form-actions">
              {isEditingExisting && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    if (confirm(`Delete project “${selected.name}”? Its chats will remain in All chats.`)) {
                      deleteProject(selected.id);
                      setSelected(null);
                    }
                  }}
                >
                  <Trash2 size={15} /> Delete project
                </button>
              )}
              <span />
              {projects.length > 0 && !createNewImmediately && (
                <button type="button" className="btn" onClick={() => setSelected(null)}>
                  Back
                </button>
              )}
              <button
                type="button"
                className="btn primary"
                disabled={!name.trim()}
                onClick={save}
              >
                {isEditingExisting ? 'Save changes' : 'Create workspace'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
