// Central mutable store: base portfolio.json overlaid with the owner's saved
// edits (content) and object layout (positions/rotations), both persisted to
// localStorage. Everything in the app reads `config` from here so edits stick.
import base from "../portfolio.json";

const LS_CONFIG = "desktopper.config.v1";
const LS_LAYOUT = "desktopper.layout.v1";
const LS_EDITOR = "desktopper.editor";

const clone = (o) => JSON.parse(JSON.stringify(o));

// ?reset clears all saved edits (content + layout) before anything reads them,
// so the page loads exactly like the original.
try {
  if (new URLSearchParams(location.search).has("reset")) {
    localStorage.removeItem(LS_CONFIG);
    localStorage.removeItem(LS_LAYOUT);
  }
} catch (e) {
  /* ignore */
}

// Merged config: saved override wins if present, else the shipped base.
let config = clone(base);
try {
  const saved = localStorage.getItem(LS_CONFIG);
  if (saved) config = { ...clone(base), ...JSON.parse(saved) };
} catch (e) {
  /* private-mode / disabled storage — fall back to base */
}

let layout = {};
try {
  const s = localStorage.getItem(LS_LAYOUT);
  if (s) layout = JSON.parse(s);
} catch (e) {
  /* ignore */
}

export { config };
export const getLayout = () => layout;

// ---- undo history (edit mode) ----
// Before each change we snapshot the *previous* saved state onto a stack in
// sessionStorage (survives the reloads that Apply/Undo trigger, clears on a
// fresh session). Rapid successive edits (e.g. typing) coalesce into one step.
const LS_HISTORY = "desktopper.history";
let lastPush = 0;
function readStack() {
  try { return JSON.parse(sessionStorage.getItem(LS_HISTORY) || "[]"); } catch { return []; }
}
function writeStack(s) {
  try { sessionStorage.setItem(LS_HISTORY, JSON.stringify(s)); } catch { /* ignore */ }
}
function pushHistory() {
  const now = Date.now();
  let stack = readStack();
  // coalesce: edits within 700ms of the last snapshot belong to one action
  if (now - lastPush < 700 && stack.length) { lastPush = now; return; }
  lastPush = now;
  stack.push({
    config: localStorage.getItem(LS_CONFIG),
    layout: localStorage.getItem(LS_LAYOUT),
  });
  if (stack.length > 50) stack = stack.slice(-50);
  writeStack(stack);
}
export function canUndo() { return readStack().length > 0; }
export function undo() {
  const stack = readStack();
  const snap = stack.pop();
  if (!snap) return false;
  try {
    if (snap.config == null) localStorage.removeItem(LS_CONFIG);
    else localStorage.setItem(LS_CONFIG, snap.config);
    if (snap.layout == null) localStorage.removeItem(LS_LAYOUT);
    else localStorage.setItem(LS_LAYOUT, snap.layout);
  } catch { /* ignore */ }
  writeStack(stack);
  return true;
}

function writeLayoutLS() {
  try { localStorage.setItem(LS_LAYOUT, JSON.stringify(layout)); } catch { /* ignore */ }
}

export function saveConfig() {
  pushHistory();
  try {
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  } catch (e) {
    /* ignore */
  }
}

export function setLayout(id, pos, rot) {
  pushHistory();
  layout[id] = {
    ...(layout[id] || {}),
    pos: pos.map((n) => +n.toFixed(4)),
    rot: rot.map((n) => +n.toFixed(4)),
  };
  writeLayoutLS();
}

// Hide (delete) or restore a desk object; scene.js reads layout[id].hidden.
export function setHidden(id, hidden) {
  pushHistory();
  layout[id] = { ...(layout[id] || {}), hidden: !!hidden };
  writeLayoutLS();
}

export function resetAll() {
  try {
    localStorage.removeItem(LS_CONFIG);
    localStorage.removeItem(LS_LAYOUT);
    sessionStorage.removeItem(LS_HISTORY);
  } catch (e) {
    /* ignore */
  }
  try {
    indexedDB.deleteDatabase(DB_NAME);
  } catch (e) {
    /* ignore */
  }
}

// ---- PDF blob storage (IndexedDB — PDFs are too big for localStorage) ----
const DB_NAME = "desktopper";
const DB_STORE = "pdfs";
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function savePdf(key, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(DB_STORE, "readwrite");
    t.objectStore(DB_STORE).put(blob, key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
export async function getPdf(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(DB_STORE, "readonly");
    const rq = t.objectStore(DB_STORE).get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

export function exportConfig() {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Edit mode is owner-only: unlocked once via ?edit, then remembered here.
export function editorUnlocked() {
  try {
    const url = new URLSearchParams(location.search);
    if (url.has("edit")) localStorage.setItem(LS_EDITOR, "1");
    return localStorage.getItem(LS_EDITOR) === "1";
  } catch (e) {
    return new URLSearchParams(location.search).has("edit");
  }
}
export function lockEditor() {
  try {
    localStorage.removeItem(LS_EDITOR);
  } catch (e) {
    /* ignore */
  }
}
