'use strict';

// ---------- Limits ----------
// Vercel rejects request bodies above ~4.5 MB, so keep each request comfortably below that.
const MAX_REQUEST_CHARS = 4_000_000;
const MAX_NATIVE_PDF_BYTES = 2_500_000; // larger PDFs are sent as extracted text
const MAX_TEXT_CHARS = 300_000;
const IMAGE_MAX_SIDE = 1600;

const PDFJS = '/vendor/pdf.min.js';
const PDFJS_WORKER = '/vendor/pdf.worker.min.js';
const MAMMOTH = '/vendor/mammoth.browser.min.js';
const TEXT_EXT = /\.(txt|md|csv|tsv|json|html?|xml|js|ts|py|css|log|ya?ml)$/i;

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const els = {
  login: $('login'), loginForm: $('login-form'), loginPassword: $('login-password'), loginError: $('login-error'),
  app: $('app'), drawer: $('drawer'), scrim: $('scrim'), chatList: $('chat-list'),
  model: $('model'), messages: $('messages'), empty: $('empty'),
  composer: $('composer'), input: $('input'), send: $('send'), fileInput: $('file-input'), attachments: $('attachments'),
};

// ---------- Small storage helpers ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

// Chats live in IndexedDB because attached files are too big for localStorage.
const db = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('model-router', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('chats', { keyPath: 'id' });
      req.onsuccess = () => resolve((this._db = req.result));
      req.onerror = () => reject(req.error);
    });
  },
  async tx(mode, fn) {
    const d = await this.open();
    return new Promise((resolve, reject) => {
      const t = d.transaction('chats', mode);
      const r = fn(t.objectStore('chats'));
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => reject(t.error);
    });
  },
  all() { return this.tx('readonly', (s) => s.getAll()); },
  put(chat) { return this.tx('readwrite', (s) => s.put(chat)); },
  remove(id) { return this.tx('readwrite', (s) => s.delete(id)); },
};

// ---------- State ----------
let password = store.get('password') || '';
let models = [];
let chats = [];
let current = null; // { id, title, messages, updated }
let pending = []; // attachments waiting to be sent
let controller = null; // AbortController while streaming

// ---------- Utilities ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

function readAs(file, method) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r[method](file);
  });
}

const stripDataUrl = (url) => url.slice(url.indexOf(',') + 1);

function renderMarkdown(text) {
  if (!window.marked || !window.DOMPurify) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }
  return DOMPurify.sanitize(marked.parse(text, { breaks: true }));
}

// ---------- File handling ----------
async function imageToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read image'));
      i.src = url;
    });
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return stripDataUrl(canvas.toDataURL('image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfToText(file) {
  await loadScript(PDFJS);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(`--- Page ${i} ---\n` + content.items.map((it) => it.str).join(' '));
  }
  return pages.join('\n\n');
}

function clip(text) {
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + '\n[…file truncated]' : text;
}

async function prepareFile(file) {
  const name = file.name;
  if (file.type.startsWith('image/')) {
    return { kind: 'image', name, mime: 'image/jpeg', data: await imageToJpeg(file) };
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) {
    if (file.size <= MAX_NATIVE_PDF_BYTES) {
      return { kind: 'pdf', name, mime: 'application/pdf', data: stripDataUrl(await readAs(file, 'readAsDataURL')) };
    }
    const text = await pdfToText(file);
    if (text.replace(/--- Page \d+ ---|\s/g, '').length < 50) {
      throw new Error(`${name} is too big and looks scanned (no text inside). Send screenshots of the pages instead.`);
    }
    return { kind: 'text', name, text: clip(text) };
  }
  if (/\.docx$/i.test(name)) {
    await loadScript(MAMMOTH);
    const { value } = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind: 'text', name, text: clip(value) };
  }
  if (file.type.startsWith('text/') || TEXT_EXT.test(name)) {
    return { kind: 'text', name, text: clip(await readAs(file, 'readAsText')) };
  }
  throw new Error(`${name}: this file type isn't supported. Use PDF, Word (.docx), images or text files.`);
}

function fileIcon(f) {
  return f.kind === 'image' ? '🖼️' : f.kind === 'pdf' || /\.pdf$/i.test(f.name) ? '📄' : '📝';
}

function renderPending() {
  els.attachments.innerHTML = '';
  pending.forEach((p, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (p.busy ? ' busy' : '');
    const label = document.createElement('span');
    label.textContent = `${p.busy ? '⏳' : fileIcon(p.file)} ${p.name}`;
    chip.appendChild(label);
    if (!p.busy) {
      const x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', `Remove ${p.name}`);
      x.onclick = () => { pending.splice(i, 1); renderPending(); };
      chip.appendChild(x);
    }
    els.attachments.appendChild(chip);
  });
  updateSend();
}

async function addFiles(fileList) {
  for (const file of fileList) {
    const entry = { name: file.name, busy: true };
    pending.push(entry);
    renderPending();
    try {
      entry.file = await prepareFile(file);
      entry.busy = false;
    } catch (e) {
      pending.splice(pending.indexOf(entry), 1);
      alert(e.message);
    }
    renderPending();
  }
}

// ---------- API ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), 'x-app-password': password },
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res;
}

// Builds the request body, dropping file contents from the oldest messages if it would be too big.
function buildBody(model, messages) {
  const msgs = messages.map((m) => ({ role: m.role, text: m.text, files: m.files }));
  let body = JSON.stringify({ model, messages: msgs });
  for (let i = 0; body.length > MAX_REQUEST_CHARS && i < msgs.length - 1; i++) {
    if (!msgs[i].files?.length) continue;
    const names = msgs[i].files.map((f) => f.name).join(', ');
    msgs[i] = { ...msgs[i], files: [], text: `[Earlier I attached: ${names} — no longer included]\n${msgs[i].text}` };
    body = JSON.stringify({ model, messages: msgs });
  }
  if (body.length > MAX_REQUEST_CHARS) {
    throw new Error('These files are too big to send together. Remove some, or send them one at a time.');
  }
  return body;
}

// ---------- Rendering ----------
function messageEl(m) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${m.role}`;
  if (m.files?.length) {
    const files = document.createElement('div');
    files.className = 'files';
    for (const f of m.files) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const label = document.createElement('span');
      label.textContent = `${fileIcon(f)} ${f.name}`;
      chip.appendChild(label);
      files.appendChild(chip);
    }
    wrap.appendChild(files);
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.dir = 'auto';
  if (m.role === 'user') bubble.textContent = m.text;
  else if (m.error) { bubble.classList.add('error-text'); bubble.textContent = m.error; }
  else bubble.innerHTML = renderMarkdown(m.text);
  if (m.role === 'user' && !m.text) bubble.hidden = true;
  wrap.appendChild(bubble);

  if (m.role === 'assistant') {
    const meta = document.createElement('div');
    meta.className = 'meta';
    const who = document.createElement('span');
    who.textContent = m.model ? m.model.split(':').slice(1).join(':') : '';
    meta.appendChild(who);
    if (m.text) {
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Copy';
      copy.onclick = async () => {
        try { await navigator.clipboard.writeText(m.text); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; }
        setTimeout(() => (copy.textContent = 'Copy'), 1500);
      };
      meta.appendChild(copy);
    }
    wrap.appendChild(meta);
  }
  return wrap;
}

function renderMessages() {
  els.messages.querySelectorAll('.msg').forEach((n) => n.remove());
  const list = current?.messages || [];
  els.empty.hidden = list.length > 0;
  for (const m of list) els.messages.appendChild(messageEl(m));
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderChatList() {
  els.chatList.innerHTML = '';
  for (const c of chats) {
    const li = document.createElement('li');
    if (current && c.id === current.id) li.className = 'active';
    const open = document.createElement('button');
    open.className = 'open-chat';
    open.dir = 'auto';
    open.textContent = c.title || 'New chat';
    open.onclick = () => { selectChat(c); closeDrawer(); };
    const del = document.createElement('button');
    del.className = 'icon-btn delete-chat';
    del.textContent = '🗑';
    del.setAttribute('aria-label', 'Delete chat');
    del.onclick = async () => {
      if (!confirm(`Delete "${c.title || 'New chat'}"?`)) return;
      await db.remove(c.id);
      chats = chats.filter((x) => x.id !== c.id);
      if (current?.id === c.id) newChat();
      renderChatList();
    };
    li.append(open, del);
    els.chatList.appendChild(li);
  }
}

function renderModels() {
  els.model.innerHTML = '';
  for (const provider of [...new Set(models.map((m) => m.provider))]) {
    const group = document.createElement('optgroup');
    group.label = provider;
    for (const m of models.filter((x) => x.provider === provider)) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      group.appendChild(opt);
    }
    els.model.appendChild(group);
  }
  const saved = store.get('model');
  if (models.some((m) => m.id === saved)) els.model.value = saved;
}

function updateSend() {
  if (controller) {
    els.send.textContent = '■';
    els.send.classList.add('stop');
    els.send.setAttribute('aria-label', 'Stop');
    els.send.disabled = false;
    return;
  }
  els.send.textContent = '➤';
  els.send.classList.remove('stop');
  els.send.setAttribute('aria-label', 'Send');
  const ready = pending.every((p) => !p.busy);
  els.send.disabled = !ready || (!els.input.value.trim() && pending.length === 0);
}

// ---------- Chats ----------
function newChat() {
  current = { id: uid(), title: '', messages: [], updated: Date.now() };
  renderMessages();
  renderChatList();
  updateSend();
  els.input.focus();
}

function selectChat(c) {
  current = c;
  renderMessages();
  renderChatList();
}

async function saveCurrent() {
  current.updated = Date.now();
  if (!chats.includes(current)) chats.unshift(current);
  chats.sort((a, b) => b.updated - a.updated);
  try { await db.put(current); } catch (e) { console.warn('Could not save chat', e); }
  renderChatList();
}

// ---------- Sending ----------
async function send() {
  const text = els.input.value.trim();
  const files = pending.filter((p) => !p.busy).map((p) => p.file);
  if (!text && files.length === 0) return;
  const model = els.model.value;

  const userMsg = { role: 'user', text, files };
  const history = [...current.messages, userMsg];
  let body;
  try {
    body = buildBody(model, history);
  } catch (e) {
    alert(e.message);
    return;
  }

  current.messages.push(userMsg);
  if (!current.title) current.title = (text || files[0].name).slice(0, 60);
  els.input.value = '';
  autosize();
  pending = [];
  renderPending();

  const reply = { role: 'assistant', text: '', model };
  current.messages.push(reply);
  renderMessages();
  const bubble = els.messages.lastElementChild.querySelector('.bubble');
  bubble.classList.add('typing');

  controller = new AbortController();
  updateSend();
  try {
    const res = await api('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: controller.signal,
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let scheduled = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      reply.text += decoder.decode(value, { stream: true });
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const nearBottom = els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight < 120;
          bubble.innerHTML = renderMarkdown(reply.text);
          if (nearBottom) els.messages.scrollTop = els.messages.scrollHeight;
        });
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      if (e.status === 401) return logout('Wrong password. Please log in again.');
      if (!reply.text) reply.error = e.message;
      else reply.text += `\n\n⚠️ ${e.message}`;
    }
  } finally {
    controller = null;
    updateSend();
  }
  await saveCurrent();
  renderMessages();
}

// ---------- Drawer ----------
function openDrawer() { els.drawer.classList.add('open'); els.scrim.hidden = false; }
function closeDrawer() { els.drawer.classList.remove('open'); els.scrim.hidden = true; }

// ---------- Login ----------
function logout(message) {
  password = '';
  store.del('password');
  els.app.hidden = true;
  els.login.hidden = false;
  els.loginError.hidden = !message;
  els.loginError.textContent = message || '';
  els.loginPassword.value = '';
  els.loginPassword.focus();
}

async function start() {
  try {
    const res = await api('/api/models');
    models = (await res.json()).models;
  } catch (e) {
    return logout(e.status === 401 ? (password ? 'Wrong password.' : '') : e.message);
  }
  store.set('password', password);
  els.login.hidden = true;
  els.app.hidden = false;
  renderModels();
  try { chats = (await db.all()).sort((a, b) => b.updated - a.updated); } catch { chats = []; }
  newChat();
}

// ---------- Events ----------
function autosize() {
  els.input.style.height = 'auto';
  els.input.style.height = els.input.scrollHeight + 'px';
  updateSend();
}

els.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  password = els.loginPassword.value;
  start();
});
els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  if (controller) controller.abort();
  else send();
});
els.input.addEventListener('input', autosize);
els.input.addEventListener('keydown', (e) => {
  // Enter sends on desktop; on touch devices Enter adds a new line.
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) {
    e.preventDefault();
    els.composer.requestSubmit();
  }
});
els.fileInput.addEventListener('change', () => {
  addFiles([...els.fileInput.files]);
  els.fileInput.value = '';
});
els.input.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});
els.messages.addEventListener('dragover', (e) => e.preventDefault());
els.messages.addEventListener('drop', (e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]); });
els.model.addEventListener('change', () => store.set('model', els.model.value));
$('new-chat').onclick = newChat;
$('drawer-new').onclick = () => { newChat(); closeDrawer(); };
$('open-drawer').onclick = openDrawer;
$('close-drawer').onclick = closeDrawer;
els.scrim.onclick = closeDrawer;
$('logout').onclick = () => logout();

if (password) start();
else logout();
