import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Clock,
  ExternalLink,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { modelLabel, useStore } from '../store';
import { readAttachment } from '../lib/files/read';
import type { Attachment, Project } from '../types';
import Modal from './Modal';

const PRESET_TEMPLATES = [
  { label: '+ Technical Code', text: 'Focus on production-grade, typed, modular code with clean architectural explanations.' },
  { label: '+ Clinical / Medical', text: 'Use metric units and clinical terminology. Ground answers in verified medical sources.' },
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

export default function ProjectWorkspace({
  project,
  onOpenSettings,
}: {
  project: Project;
  onOpenSettings?: () => void;
}) {
  const chats = useStore((s) => s.chats);
  const catalog = useStore((s) => s.catalog);
  const enabledModels = useStore((s) => s.settings.enabledModels);
  const {
    saveProject,
    deleteProject,
    selectProject,
    selectChat,
    newChat,
    deleteChat,
    renameChat,
    moveChatToProject,
    send,
    toast,
  } = useStore.getState();

  const [quickPrompt, setQuickPrompt] = useState('');
  const [searchChats, setSearchChats] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ name: string; text: string } | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [chatNewTitle, setChatNewTitle] = useState('');
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);

  // Editable settings state
  const [name, setName] = useState(project.name);
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(project.description || '');
  const [instructions, setInstructions] = useState(project.instructions || '');
  const [defaultModel, setDefaultModel] = useState(project.defaultModel || '');
  const [color, setColor] = useState(project.color || 'indigo');
  const [files, setFiles] = useState<Attachment[]>(project.files || []);
  const [savedInstructionsNotice, setSavedInstructionsNotice] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description || '');
    setInstructions(project.instructions || '');
    setDefaultModel(project.defaultModel || '');
    setColor(project.color || 'indigo');
    setFiles(project.files || []);
  }, [project]);

  // Sync edits
  const handleSaveEdits = (override?: Partial<Project>) => {
    const updated: Project = {
      ...project,
      name: (override?.name ?? name).trim(),
      description: (override?.description ?? description).trim() || undefined,
      instructions: override?.instructions ?? instructions,
      defaultModel: (override?.defaultModel ?? defaultModel) || undefined,
      color: override?.color ?? color,
      files: override?.files ?? files,
      updatedAt: Date.now(),
    };
    if (!updated.name) {
      toast('Project name cannot be empty', 'error');
      return false;
    }
    const ok = saveProject(updated);
    if (ok && override?.instructions !== undefined) {
      setSavedInstructionsNotice(true);
      setTimeout(() => setSavedInstructionsNotice(false), 2000);
    }
    return ok;
  };

  const handleFileUpload = async (incoming: File[]) => {
    if (!incoming.length) return;
    setIsUploading(true);
    const remainingSlots = Math.max(0, 5 - files.length);
    if (remainingSlots <= 0) {
      toast('A project can keep up to 5 reference documents.', 'error');
      setIsUploading(false);
      return;
    }

    const added: Attachment[] = [];
    for (const file of incoming.slice(0, remainingSlots)) {
      try {
        const attachment = await readAttachment(file, { textOnly: true });
        if (!attachment.text) throw new Error(`${file.name}: unable to extract readable text.`);
        added.push({
          ...attachment,
          text: attachment.text.slice(0, 20000),
        });
      } catch (err) {
        toast((err as Error).message, 'error');
      }
    }

    if (added.length > 0) {
      const nextFiles = [...files, ...added];
      setFiles(nextFiles);
      handleSaveEdits({ files: nextFiles });
      toast(`Added ${added.length} file${added.length === 1 ? '' : 's'} to project knowledge.`, 'info');
    }
    if (incoming.length > remainingSlots) {
      toast('Maximum 5 reference files allowed per project.', 'error');
    }
    setIsUploading(false);
  };

  const handleRemoveFile = (fileId: string) => {
    const nextFiles = files.filter((f) => f.id !== fileId);
    setFiles(nextFiles);
    handleSaveEdits({ files: nextFiles });
  };

  const handleAddTemplate = (text: string) => {
    const next = instructions.trim() ? `${instructions.trim()}\n• ${text}` : `• ${text}`;
    setInstructions(next);
  };

  const handleStartChatFromPrompt = () => {
    const text = quickPrompt.trim();
    if (!text) return;
    newChat();
    setTimeout(() => {
      void send(text, []);
    }, 40);
  };

  // Chats in this project
  const projectChats = chats.filter((c) => c.projectId === project.id);
  const filteredChats = projectChats.filter((c) => {
    if (!searchChats.trim()) return true;
    const q = searchChats.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q));
  });

  const totalChars = (files || []).reduce((sum, f) => sum + (f.text?.length || 0), 0) + instructions.length;
  const quotaPct = Math.min(100, Math.round((totalChars / 150000) * 100));

  const formatRelativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="claude-project-view">
      {/* Sleek Claude Top Navbar */}
      <header className="claude-project-topbar">
        <div className="claude-project-breadcrumb">
          <button
            type="button"
            className="claude-project-back-btn"
            onClick={() => selectProject(null)}
            title="Return to all chats"
          >
            <ArrowLeft size={14} />
            <span>All chats</span>
          </button>
          <span className="claude-breadcrumb-slash">/</span>
          <span className="claude-breadcrumb-name">{project.name}</span>
        </div>

        <div className="claude-project-top-actions">
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              if (onOpenSettings) onOpenSettings();
              else setShowSettingsDrawer(true);
            }}
            title="Project settings"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="btn primary sm"
            onClick={() => newChat()}
            title="Start a new chat in this project"
          >
            <Plus size={15} />
            <span>New chat</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column Claude Layout */}
      <div className="claude-project-body">
        {/* ===================== LEFT / MAIN COLUMN ===================== */}
        <main className="claude-project-main">
          {/* Hero Header */}
          <section className="claude-project-hero">
            <div className="claude-project-hero-badge">
              <div className={`claude-project-avatar color-${color}`}>
                <FolderKanban size={24} />
              </div>
              <div className="claude-project-title-area">
                {editingTitle ? (
                  <input
                    autoFocus
                    className="claude-project-title-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      if (name.trim()) handleSaveEdits({ name });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingTitle(false);
                        if (name.trim()) handleSaveEdits({ name });
                      } else if (e.key === 'Escape') {
                        setName(project.name);
                        setEditingTitle(false);
                      }
                    }}
                  />
                ) : (
                  <div className="claude-project-title-row">
                    <h1 className="claude-project-title">{project.name}</h1>
                    <button
                      type="button"
                      className="icon-btn xs"
                      title="Rename project"
                      onClick={() => setEditingTitle(true)}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
                {project.description ? (
                  <p className="claude-project-desc">{project.description}</p>
                ) : (
                  <button
                    type="button"
                    className="claude-project-add-desc-btn"
                    onClick={() => {
                      if (onOpenSettings) onOpenSettings();
                      else setShowSettingsDrawer(true);
                    }}
                  >
                    + Add project description
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Central Claude Prompt Composer */}
          <div className="claude-composer-box">
            <textarea
              rows={3}
              value={quickPrompt}
              placeholder={`Send a message to start a new chat in ${project.name}...`}
              onChange={(e) => setQuickPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStartChatFromPrompt();
                }
              }}
            />
            <div className="claude-composer-foot">
              <div className="claude-composer-meta">
                {files.length > 0 ? (
                  <span className="claude-composer-pill" title="Documents attached to all messages">
                    <FileText size={12} /> {files.length} doc{files.length === 1 ? '' : 's'} active
                  </span>
                ) : (
                  <span className="claude-composer-pill muted">
                    <Sparkles size={12} /> Using project instructions
                  </span>
                )}
                {project.defaultModel && (
                  <span className="claude-composer-pill" title="Default Model">
                    {modelLabel(catalog, project.defaultModel)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn primary claude-composer-send"
                disabled={!quickPrompt.trim()}
                onClick={handleStartChatFromPrompt}
                title="Send message (Enter)"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>

          {/* Project Activity / Recent Conversations */}
          <section className="claude-project-activity">
            <div className="claude-activity-header">
              <h2 className="claude-activity-title">
                Conversations ({projectChats.length})
              </h2>
              {projectChats.length > 2 && (
                <label className="claude-activity-search">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Search chats..."
                    value={searchChats}
                    onChange={(e) => setSearchChats(e.target.value)}
                  />
                </label>
              )}
            </div>

            {projectChats.length === 0 ? (
              <div className="claude-empty-chats">
                <div className="claude-empty-chats-icon">
                  <MessageSquare size={24} />
                </div>
                <h3>No conversations yet</h3>
                <p>
                  Start a chat above, or click New chat. Messages will automatically have access to
                  your reference knowledge and custom guidelines.
                </p>
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => newChat()}
                >
                  <Plus size={14} /> Start first conversation
                </button>
              </div>
            ) : filteredChats.length === 0 ? (
              <p className="muted small" style={{ padding: '16px 0' }}>
                No chats match &ldquo;{searchChats}&rdquo;.
              </p>
            ) : (
              <div className="claude-chats-list">
                {filteredChats.map((c) => {
                  const msgCount = c.messages.length;
                  const lastMsg = c.messages.length ? c.messages[c.messages.length - 1] : null;
                  const previewText = lastMsg?.text?.slice(0, 110) || 'Empty conversation';
                  const isRenaming = renamingChatId === c.id;

                  return (
                    <div
                      key={c.id}
                      className="claude-chat-row"
                      onClick={() => selectChat(c.id)}
                    >
                      <div className="claude-chat-row-icon">
                        <MessageSquare size={16} />
                      </div>

                      <div className="claude-chat-row-body">
                        {isRenaming ? (
                          <input
                            autoFocus
                            className="claude-chat-rename-input"
                            value={chatNewTitle}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setChatNewTitle(e.target.value)}
                            onBlur={() => {
                              if (chatNewTitle.trim()) void renameChat(c.id, chatNewTitle.trim());
                              setRenamingChatId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (chatNewTitle.trim()) void renameChat(c.id, chatNewTitle.trim());
                                setRenamingChatId(null);
                              } else if (e.key === 'Escape') {
                                setRenamingChatId(null);
                              }
                            }}
                          />
                        ) : (
                          <span className="claude-chat-row-title" title={c.title}>
                            {c.title}
                          </span>
                        )}
                        <p className="claude-chat-row-snippet">{previewText}</p>
                      </div>

                      <div className="claude-chat-row-meta" onClick={(e) => e.stopPropagation()}>
                        <span className="claude-chat-row-time">
                          <Clock size={12} />
                          {formatRelativeTime(c.updatedAt)}
                        </span>
                        <span className="claude-chat-row-count">{msgCount} msgs</span>

                        <div className="claude-chat-menu-anchor">
                          <button
                            type="button"
                            className="icon-btn xs"
                            aria-label="Options"
                            onClick={() => setChatMenuId(chatMenuId === c.id ? null : c.id)}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {chatMenuId === c.id && (
                            <div className="menu claude-chat-dropdown" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setChatMenuId(null);
                                  setChatNewTitle(c.title);
                                  setRenamingChatId(c.id);
                                }}
                              >
                                <Pencil size={13} /> Rename
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setChatMenuId(null);
                                  moveChatToProject(c.id, null);
                                  toast('Moved to All chats', 'info');
                                }}
                              >
                                <ExternalLink size={13} /> Move out
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="danger"
                                onClick={() => {
                                  setChatMenuId(null);
                                  if (confirm(`Delete "${c.title}"?`)) void deleteChat(c.id);
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* ===================== RIGHT SIDEBAR (PROJECT CONTEXT) ===================== */}
        <aside className="claude-project-sidebar">
          {/* 1. Project Knowledge Card */}
          <div className="claude-side-card">
            <div className="claude-side-card-head">
              <div>
                <h3 className="claude-side-card-title">Project Knowledge</h3>
                <span className="muted small">
                  {totalChars.toLocaleString()} / 150,000 chars ({quotaPct}%)
                </span>
              </div>
              <button
                type="button"
                className="btn ghost xs"
                disabled={files.length >= 5 || isUploading}
                onClick={() => fileInputRef.current?.click()}
                title="Upload document"
              >
                <Plus size={14} /> Add doc
              </button>
            </div>

            <div className="claude-side-quota-bar">
              <div
                className="claude-side-quota-fill"
                style={{
                  width: `${quotaPct}%`,
                  background: quotaPct > 90 ? 'var(--danger)' : quotaPct > 70 ? '#f59e0b' : 'var(--accent)',
                }}
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept=".pdf,.docx,.xlsx,.xlsm,.pptx,.txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.py,.css,.sql,.log,.yaml,.yml,.srt,.tex"
              onChange={(e) => {
                const incoming = Array.from(e.target.files || []);
                void handleFileUpload(incoming);
                e.target.value = '';
              }}
            />

            {files.length === 0 ? (
              <div
                className="claude-side-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleFileUpload(Array.from(e.dataTransfer.files || []));
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} style={{ color: 'var(--text-3)' }} />
                <span>Upload PDF, Word, Code or CSV</span>
                <small className="muted">Attached to all chats in this project</small>
              </div>
            ) : (
              <div className="claude-side-files-list">
                {files.map((file) => {
                  const isSheet = /\.(xlsx|xlsm|csv|tsv)$/i.test(file.name);
                  const isCode = /\.(js|ts|tsx|jsx|py|html|css|json|sql|ya?ml)$/i.test(file.name);
                  const isDoc = /\.(docx|pdf|txt|md)$/i.test(file.name);
                  const Icon = isSheet ? FileSpreadsheet : isCode ? FileCode : isDoc ? FileText : ScrollText;

                  return (
                    <div key={file.id} className="claude-side-file-item">
                      <Icon size={15} className="claude-side-file-icon" />
                      <div className="claude-side-file-meta">
                        <span className="claude-side-file-name" title={file.name}>
                          {file.name}
                        </span>
                        <span className="claude-side-file-chars">
                          {(file.text?.length || 0).toLocaleString()} chars
                        </span>
                      </div>
                      <div className="claude-side-file-actions">
                        {file.text && (
                          <button
                            type="button"
                            className="icon-btn xs"
                            title="Preview text"
                            onClick={() => setPreviewDoc({ name: file.name, text: file.text || '' })}
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn xs danger"
                          title="Remove file"
                          onClick={() => handleRemoveFile(file.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Custom Instructions Card */}
          <div className="claude-side-card">
            <div className="claude-side-card-head">
              <div>
                <h3 className="claude-side-card-title">Custom Instructions</h3>
                <span className="muted small">Model persona & guidelines</span>
              </div>
              <button
                type="button"
                className="btn ghost xs"
                onClick={() => handleSaveEdits()}
                title="Save instructions"
              >
                {savedInstructionsNotice ? (
                  <>
                    <Check size={13} /> Saved
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>

            <div className="claude-preset-chips">
              {PRESET_TEMPLATES.slice(0, 3).map((tmpl) => (
                <button
                  key={tmpl.label}
                  type="button"
                  className="claude-preset-chip"
                  onClick={() => handleAddTemplate(tmpl.text)}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              className="claude-side-instructions-input"
              value={instructions}
              maxLength={12000}
              placeholder="How should models respond in this project? (e.g., tone, style, constraints)..."
              onChange={(e) => setInstructions(e.target.value)}
              onBlur={() => handleSaveEdits()}
            />
            <div className="claude-side-char-count">
              <span className="muted small">{instructions.length}/12,000 chars</span>
            </div>
          </div>

          {/* 3. Project Settings & Details */}
          <div className="claude-side-card">
            <h3 className="claude-side-card-title" style={{ marginBottom: 10 }}>
              Project Settings
            </h3>

            <div className="claude-side-setting-row">
              <span className="setting-label">Default Model</span>
              <select
                className="claude-side-select"
                value={defaultModel}
                onChange={(e) => {
                  setDefaultModel(e.target.value);
                  handleSaveEdits({ defaultModel: e.target.value });
                }}
              >
                <option value="">Auto (Default)</option>
                {enabledModels.map((id) => (
                  <option key={id} value={id}>
                    {modelLabel(catalog, id)}
                  </option>
                ))}
              </select>
            </div>

            <div className="claude-side-setting-row" style={{ marginTop: 10 }}>
              <span className="setting-label">Color Theme</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`project-color-dot${color === c.id ? ' active' : ''}`}
                    style={{ background: c.bg, width: 18, height: 18 }}
                    title={c.label}
                    onClick={() => {
                      setColor(c.id);
                      handleSaveEdits({ color: c.id });
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="claude-side-danger-action">
              <button
                type="button"
                className="btn danger xs"
                onClick={() => {
                  if (confirm(`Delete project "${project.name}"? Existing chats will remain in All chats.`)) {
                    deleteProject(project.id);
                    selectProject(null);
                  }
                }}
              >
                <Trash2 size={13} /> Delete project
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Extracted Document Preview Modal */}
      {previewDoc && (
        <Modal title={`Knowledge Preview: ${previewDoc.name}`} onClose={() => setPreviewDoc(null)}>
          <div className="project-doc-preview-modal">
            <div className="project-doc-preview-meta">
              <span className="muted small">
                {previewDoc.text.length.toLocaleString()} characters extracted and provided to models
              </span>
            </div>
            <pre className="project-doc-preview-body">{previewDoc.text}</pre>
          </div>
        </Modal>
      )}

      {/* Edit Details Drawer Modal */}
      {showSettingsDrawer && (
        <Modal title={`Project Settings: ${project.name}`} onClose={() => setShowSettingsDrawer(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field-block">
              <span className="setting-label">Project Name</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="field-block">
              <span className="setting-label">Project Description</span>
              <input
                value={description}
                maxLength={160}
                placeholder="Short summary of this project purpose"
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="field-block">
              <span className="setting-label">Default Model</span>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              >
                <option value="">Auto (Default)</option>
                {enabledModels.map((id) => (
                  <option key={id} value={id}>
                    {modelLabel(catalog, id)}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  handleSaveEdits();
                  setShowSettingsDrawer(false);
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
