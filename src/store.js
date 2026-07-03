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

export function saveConfig() {
  try {
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));
  } catch (e) {
    /* ignore */
  }
}

export function setLayout(id, pos, rot) {
  layout[id] = { pos: pos.map((n) => +n.toFixed(4)), rot: rot.map((n) => +n.toFixed(4)) };
  try {
    localStorage.setItem(LS_LAYOUT, JSON.stringify(layout));
  } catch (e) {
    /* ignore */
  }
}

export function resetAll() {
  try {
    localStorage.removeItem(LS_CONFIG);
    localStorage.removeItem(LS_LAYOUT);
  } catch (e) {
    /* ignore */
  }
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
