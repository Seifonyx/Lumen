// Synthetic QA build entry. Nothing runs before the gate's lease confirms this reviewer may use this exact
// build; then the review account is seeded from synthetic fixtures and the real Lumen app is mounted.
// Firebase, cloud sync, live providers and the service worker are replaced at build time (vite.qa.config.ts).

import './qa.css';
import { lock, onLock, readLease, watchLease, type Lease } from './adapters/lease';
import { configureQaAccount } from './adapters/firebase';
import { FIRST_CHAT, FIXTURE_CHATS, FIXTURE_SETTINGS } from './fixtures/profile';

const root = document.getElementById('root')!;
const seededKey = (uid: string) => `mr.qa.seeded.${uid}`;

function unavailable() {
  root.className = 'qa-unavailable';
  root.innerHTML = '<h1>Review build unavailable</h1><p>This review build has expired, was revoked, or is not available to this account. Nothing was loaded.</p><p><a href="/">Open the review list</a></p>';
}

function openDatabase(uid: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`model-router-account-${uid}`, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('chats')) request.result.createObjectStore('chats', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** First visit for this reviewer + build: start from the synthetic fixtures (never from real data). */
async function seed(uid: string): Promise<boolean> {
  if (localStorage.getItem(seededKey(uid))) return false;
  localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ settings: FIXTURE_SETTINGS }));
  localStorage.setItem('mr.installHint', '1');
  localStorage.setItem('mr.modelCheck.background', JSON.stringify(Date.now()));
  const db = await openDatabase(uid);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('chats', 'readwrite');
    for (const chat of FIXTURE_CHATS) tx.objectStore('chats').put(chat);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  localStorage.setItem(seededKey(uid), '1');
  return true;
}

/** Removes only this review account's local data, then reloads from the fixtures. */
async function reset(uid: string) {
  if (!confirm('Reset this review to its starting chats? Your local review drafts and changes in this build are removed.')) return;
  for (const key of Object.keys(localStorage)) if (key.includes(uid)) localStorage.removeItem(key);
  for (const name of [`model-router-account-${uid}`, `model-router-tasks-${uid}`, `model-router-knowledge-${uid}`]) {
    await new Promise<void>((done) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => done(); });
  }
  location.reload();
}

function banner(lease: Lease, uid: string) {
  const bar = document.createElement('div');
  bar.className = 'qa-banner';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  const until = new Date(lease.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  text.textContent = `Synthetic review · no live provider requests · ${lease.buildId.slice(0, 7)} · until ${until}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reset';
  button.setAttribute('aria-label', 'Reset this review to its starting chats');
  button.addEventListener('click', () => void reset(uid));
  bar.append(text, button);
  document.body.append(bar);
}

function lockScreen(reason: string) {
  root.inert = true;
  root.setAttribute('aria-hidden', 'true');
  const overlay = document.createElement('div');
  overlay.className = 'qa-lock';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'qa-lock-title');
  overlay.innerHTML = '<div><h1 id="qa-lock-title">Review ended</h1><p></p><p>Nothing more will be sent. Unsent text stays on this device only.</p><a href="/">Open the review list</a></div>';
  overlay.querySelector('p')!.textContent = reason;
  document.body.append(overlay);
  overlay.querySelector('a')!.focus();
}

void (async () => {
  const lease = await readLease();
  if (!lease) return unavailable();
  const user = configureQaAccount(lease.namespace);
  const firstVisit = await seed(user.uid);
  localStorage.setItem('mr.preview_user', JSON.stringify(user));
  banner(lease, user.uid);
  onLock((reason) => {
    void import('../../src/store').then(({ useStore }) => useStore.getState().stop());
    lockScreen(reason);
  });
  // A page reopened after expiry must not keep working from a stale copy.
  if (Date.now() >= lease.expiresAt) return lock('This review build has expired.');
  await import('../../src/main');
  watchLease();
  if (firstVisit) {
    const { useStore } = await import('../../src/store');
    const ready = () => useStore.getState().authed === true && useStore.getState().chats.some((c) => c.id === FIRST_CHAT);
    if (ready()) useStore.getState().selectChat(FIRST_CHAT);
    else { const stop = useStore.subscribe(() => { if (ready()) { stop(); useStore.getState().selectChat(FIRST_CHAT); } }); }
  }
})();
