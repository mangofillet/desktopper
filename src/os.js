// DESKTOPPER OS — a Linux Mint-flavoured toy desktop drawn onto a 640×480
// canvas (the real VGA resolution of the classic_laptop). Its contents are a
// DISTINCT, editable filesystem (config.laptop) — separate from the desk props.
// Papers/presentations/cv open in the full-screen reader; contact links are
// clickable; the projects drive mounts only with the floppy in; there's a
// password-locked secret folder.

const W = 640;
const H = 480;
const BAR = 32;
const MINT = "#3aa66a";
const MINT_DIM = "#2e7d4f";

export function createOS({ config }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // handlers wired after construction (reader/media/links live elsewhere)
  let handlers = { openReader: () => {}, openUrl: () => {}, playMedia: () => {} };

  // Read the laptop's own content (falls back to top-level config for compat).
  function data() {
    const L = config.laptop || {};
    return {
      welcome: L.welcome || {},
      about: L.about ?? config.bio ?? "",
      contact: L.contact || config.links || {},
      papers: L.papers || [],
      presentations: L.presentations || [],
      projects: L.projects || config.projects || [],
      media: L.media || [],
      secret: L.secret || { password: "", projects: [] },
    };
  }

  // ---------- state ----------
  let mode = "sleep"; // sleep | boot | on
  let bootT0 = 0;
  let dirty = true;
  let now = 0;
  let windows = []; // stack of window objects
  let regions = [];
  let term = null;
  let floppyIn = false;
  let winId = 0;

  const BOOT_LINES = [
    "DESKTOPPER BIOS v1.0 — 640K ok",
    "loading kernel ................ ok",
    "mounting /dev/desk ............ ok",
    "starting mint session ......... ok",
    "",
    "wake up…",
  ];

  // ---------- helpers ----------
  const region = (x, y, w, h, onClick) => regions.push({ x, y, w, h, onClick });

  function icon(x, y, glyph, label, onClick, color = "#cfd8cf") {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x, y, 58, 46, 8);
    ctx.fill();
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.fillText(glyph, x + 29, y + 28);
    ctx.font = "10px monospace";
    ctx.fillText(label, x + 29, y + 58);
    region(x, y, 58, 62, onClick);
  }

  function wrap(text, width) {
    const out = [];
    for (const raw of String(text).split("\n")) {
      let line = "";
      for (const word of raw.split(" ")) {
        if ((line + word).length > width && line) {
          out.push(line.trimEnd());
          line = "";
        }
        line += word + " ";
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  const closeWin = (w) => {
    windows = windows.filter((v) => v !== w);
    dirty = true;
  };
  const focusWin = (w) => {
    windows = windows.filter((v) => v !== w);
    windows.push(w);
  };

  function windowFrame(w, title) {
    const { x, y, w: ww, h: wh } = w;
    ctx.fillStyle = "rgba(24, 28, 25, 0.98)";
    ctx.beginPath();
    ctx.roundRect(x, y, ww, wh, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 160, 130, 0.5)";
    ctx.stroke();
    ctx.fillStyle = "#242a26";
    ctx.beginPath();
    ctx.roundRect(x, y, ww, 24, [6, 6, 0, 0]);
    ctx.fill();
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#b8c8ba";
    ctx.fillText(title, x + 10, y + 16);
    ctx.fillStyle = "#c46a5a";
    ctx.beginPath();
    ctx.arc(x + ww - 14, y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    region(x, y, ww, 24, () => focusWin(w)); // title bar → focus
    region(x + ww - 22, y + 2, 20, 20, () => closeWin(w));
  }

  // Clip a scrollable body region and draw rows with vertical scroll.
  function scrollBody(w, contentH, drawRows) {
    const bx = w.x + 12, by = w.y + 32, bw = w.w - 24, bh = w.h - 44;
    w.scroll = Math.max(0, Math.min(w.scroll || 0, Math.max(0, contentH - bh)));
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    drawRows(bx, by - w.scroll, bw);
    ctx.restore();
    // scrollbar
    if (contentH > bh) {
      const th = Math.max(20, (bh * bh) / contentH);
      const tt = by + ((bh - th) * (w.scroll)) / (contentH - bh);
      ctx.fillStyle = "rgba(140,180,150,0.35)";
      ctx.fillRect(w.x + w.w - 7, tt, 4, th);
    }
    w._body = { bx, by, bw, bh };
  }

  // ---------- openers ----------
  function openFolder(kind, title, items) {
    windows.push({ id: ++winId, type: "folder", kind, title, items, x: 108, y: 44, w: 410, h: 300, scroll: 0 });
    dirty = true;
  }
  function openDoc(title, body, links) {
    windows.push({ id: ++winId, type: "doc", title, body, links, x: 150, y: 56, w: 400, h: 320, scroll: 0 });
    dirty = true;
  }
  function openTerm() {
    if (!term) term = { lines: ["desktopper os 1.0 — type `help`"], input: "", pw: null };
    windows = windows.filter((w) => w.type !== "term");
    windows.push({ id: ++winId, type: "term", x: 84, y: 96, w: 470, h: 300, scroll: 0 });
    dirty = true;
  }

  // File → reader/doc/link routing.
  const paperItem = (p) => ({ ...p, title: p.title || p.pdfName || "document" });
  function openPaper(p) { handlers.openReader(paperItem(p)); }
  function openContact() {
    const cc = data().contact;
    const links = Object.entries(cc)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: `${k}: ${v}`, url: k === "email" ? `mailto:${v}` : v }));
    openDoc("contact.txt", "", links);
  }

  // ---------- folders content ----------
  function folderItems(kind) {
    const d = data();
    if (kind === "papers")
      return d.papers.map((p) => ({ glyph: "▤", label: fileName(p.title, "pdf"), onClick: () => openPaper(p) }));
    if (kind === "presentations")
      return d.presentations.map((p) => ({ glyph: "◈", label: fileName(p.title, "pdf"), onClick: () => openPaper(p) }));
    if (kind === "projects" || kind === "secretprojects") {
      const list = kind === "secretprojects" ? d.secret.projects : d.projects;
      return list.map((p) => ({
        glyph: "▦",
        label: (p.name || "project").toLowerCase(),
        onClick: () => openDoc(p.name || "project", p.blurb || "", p.url ? [{ label: "visit ↗", url: p.url }] : []),
      }));
    }
    if (kind === "media")
      return d.media.map((m) => ({
        glyph: m.type === "video" ? "▶" : "♪",
        label: m.name || "media",
        onClick: () => handlers.playMedia(m),
      }));
    return [];
  }
  const fileName = (t, ext) => (t || "file").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 22) + "." + ext;

  // ---------- terminal ----------
  function runCommand(cmd) {
    const t = term;
    const d = data();
    // password mode for the secret folder
    if (t.pw) {
      t.lines.push("password: " + "•".repeat(cmd.length));
      if (cmd === d.secret.password && d.secret.password) {
        t.lines.push("access granted.");
        t.pw = null;
        openFolder("secretprojects", "~/secret", folderItems("secretprojects"));
      } else {
        t.pw.tries -= 1;
        if (t.pw.tries <= 0) {
          t.lines.push("Curiosity is not a sin, but exercise caution.");
          t.pw = null;
        } else {
          t.lines.push(`wrong. ${t.pw.tries} attempt${t.pw.tries === 1 ? "" : "s"} left.`);
        }
      }
      t.lines = t.lines.slice(-16);
      return;
    }
    t.lines.push("jin@desk:~$ " + cmd);
    const [c, ...args] = cmd.trim().split(/\s+/);
    const arg = args.join(" ");
    const files = ["about.txt", "contact.txt", "cv.pdf"];
    const dirs = ["papers", "presentations", "media", ...(floppyIn ? ["projects"] : []), "secret"];
    if (!c) {
    } else if (c === "help") {
      t.lines.push("ls · cd <dir> · cat <file> · open <file> · clear · exit");
    } else if (c === "ls") {
      t.lines.push(dirs.map((x) => x + "/").join("  "));
      t.lines.push(files.join("  "));
    } else if (c === "cat" && arg === "about.txt") {
      wrap(d.about, 54).forEach((l) => t.lines.push(l));
    } else if (c === "cat" && arg === "contact.txt") {
      Object.entries(d.contact).filter(([, v]) => v).forEach(([k, v]) => t.lines.push(`${k}: ${v}`));
    } else if ((c === "open" || c === "cd") && (arg === "secret" || arg === "secret/")) {
      promptSecret();
    } else if (c === "cd" && dirs.includes(arg.replace(/\/$/, ""))) {
      const k = arg.replace(/\/$/, "");
      openFolder(k, "~/" + k, folderItems(k));
    } else if (c === "open" && arg === "about.txt") {
      openDoc("about.txt", d.about, []);
    } else if (c === "open" && arg === "contact.txt") {
      openContact();
    } else if (c === "open" && arg === "cv.pdf") {
      handlers.openReader({ title: "Curriculum Vitae", pdfUrl: config.cvUrl, pdfName: "cv.pdf" });
    } else if (c === "open") {
      const p = d.papers.concat(d.presentations).find((x) => fileName(x.title, "pdf").startsWith(arg));
      if (p) openPaper(p);
      else t.lines.push(`open: ${arg}: not found`);
    } else if (c === "clear") {
      t.lines = [];
    } else if (c === "exit") {
      windows = windows.filter((w) => w.type !== "term");
    } else {
      t.lines.push(`${c}: command not found (try \`help\`)`);
    }
    t.lines = t.lines.slice(-16);
  }

  function promptSecret() {
    openTerm();
    term.lines.push("secret/ is locked.");
    term.pw = { tries: 3 };
    dirty = true;
  }

  // ---------- drawing ----------
  function drawSleep() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#101812");
    g.addColorStop(1, "#0a0f0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = MINT;
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 50, 160, 100, 100, 22);
    ctx.stroke();
    ctx.font = "bold 56px monospace";
    ctx.fillStyle = MINT;
    ctx.textAlign = "center";
    ctx.fillText("D", W / 2, 232);
    ctx.globalAlpha = 0.6 + 0.35 * Math.sin(now * 2.2);
    ctx.font = "19px monospace";
    ctx.fillStyle = "#7fd9a4";
    ctx.fillText("click to wake", W / 2, 330);
    ctx.globalAlpha = 1;
    region(0, 0, W, H, wake);
  }

  function drawBoot() {
    ctx.fillStyle = "#060906";
    ctx.fillRect(0, 0, W, H);
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#7fd9a4";
    const chars = Math.floor((now - bootT0) * 60);
    let used = 0;
    BOOT_LINES.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, chars - used));
      ctx.fillText(line.slice(0, n), 24, 40 + i * 20);
      used += line.length;
    });
    if (chars > used + 25) {
      mode = "on";
      openTerm();
    }
  }

  function drawDesktop() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#26302a");
    g.addColorStop(1, "#181f1a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = MINT;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 80, H / 2 - 100, 160, 160, 34);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const d = data();
    // two columns of icons
    const col = [18, 86];
    const rows = [20, 96, 172, 248, 324];
    const cells = [];
    const put = (glyph, label, onClick, color) => cells.push({ glyph, label, onClick, color });
    put("▤", "papers", () => openFolder("papers", "~/papers", folderItems("papers")));
    put("◈", "presentations", () => openFolder("presentations", "Data Analytics & Science Presentations", folderItems("presentations")), "#8fd9a8");
    put("≡", "about.txt", () => openDoc("about.txt", d.about, []));
    put("@", "contact.txt", () => openContact());
    put("▣", "cv.pdf", () => handlers.openReader({ title: "Curriculum Vitae", pdfUrl: config.cvUrl, pdfName: "cv.pdf" }));
    if (d.media.length) put("♪", "media", () => openFolder("media", "~/media", folderItems("media")));
    if (floppyIn) put("▦", "projects (A:)", () => openFolder("projects", "~/projects", folderItems("projects")), "#8fd9a8");
    put("🔒", "secret", () => promptSecret(), "#c9a86a");
    cells.forEach((cll, i) => {
      const x = col[Math.floor(i / rows.length)];
      const y = rows[i % rows.length];
      if (x !== undefined && y !== undefined) icon(x, y, cll.glyph, cll.label, cll.onClick, cll.color);
    });

    for (const w of windows) drawWindow(w);

    // taskbar
    ctx.fillStyle = "#141a16";
    ctx.fillRect(0, H - BAR, W, BAR);
    ctx.fillStyle = MINT_DIM;
    ctx.beginPath();
    ctx.roundRect(8, H - BAR + 5, 46, 22, 4);
    ctx.fill();
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff2";
    ctx.fillText("❖ D", 31, H - BAR + 20);
    region(8, H - BAR + 5, 46, 22, openTerm);
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#9ab0a0";
    ctx.fillText("term", 66, H - BAR + 20);
    region(60, H - BAR + 5, 40, 22, openTerm);
    ctx.textAlign = "right";
    ctx.fillText("19:47", W - 12, H - BAR + 20);
  }

  function drawWindow(w) {
    if (w.type === "folder") {
      windowFrame(w, w.title);
      const rowH = 26;
      const contentH = w.items.length * rowH + 8;
      scrollBody(w, contentH, (bx, byTop) => {
        ctx.font = "13px monospace";
        ctx.textAlign = "left";
        w.items.forEach((it, i) => {
          const iy = byTop + 16 + i * rowH;
          ctx.fillStyle = "#8fd9a8";
          ctx.fillText(it.glyph, bx + 4, iy);
          ctx.fillStyle = "#cfd8cf";
          ctx.fillText(it.label, bx + 28, iy);
          region(bx, iy - 15, w.w - 30, 22, it.onClick);
        });
      });
    } else if (w.type === "doc") {
      windowFrame(w, w.title);
      const lines = w.links && w.links.length ? [] : wrap(w.body, 50);
      const rowH = 15;
      const linkRows = (w.links || []).length;
      const contentH = lines.length * rowH + linkRows * 24 + 8;
      scrollBody(w, contentH, (bx, byTop, bw) => {
        ctx.font = "12.5px monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = "#cfd8cf";
        lines.forEach((l, i) => ctx.fillText(l, bx + 4, byTop + 16 + i * rowH));
        (w.links || []).forEach((lk, i) => {
          const ly = byTop + 16 + lines.length * rowH + i * 24;
          ctx.fillStyle = "#7fd9c0";
          ctx.fillText("• " + lk.label, bx + 4, ly);
          region(bx, ly - 14, bw, 20, () => handlers.openUrl(lk.url));
        });
      });
    } else if (w.type === "term") {
      windowFrame(w, term?.pw ? "jin@desk: ~ [locked]" : "jin@desk: ~");
      ctx.save();
      ctx.beginPath();
      ctx.rect(w.x + 8, w.y + 28, w.w - 16, w.h - 40);
      ctx.clip();
      ctx.font = "13px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#9fe8b8";
      const shown = term.lines.slice(-14);
      shown.forEach((l, i) => ctx.fillText(l, w.x + 14, w.y + 44 + i * 16));
      const iy = w.y + 44 + shown.length * 16;
      const cursor = Math.floor(now * 2.5) % 2 ? "█" : " ";
      const prompt = term.pw ? "password: " + "•".repeat(term.input.length) : "jin@desk:~$ " + term.input;
      ctx.fillText(prompt + cursor, w.x + 14, iy);
      ctx.restore();
    }
  }

  // ---------- public API ----------
  function wake() {
    if (mode !== "sleep") return;
    mode = "boot";
    bootT0 = now;
    dirty = true;
  }

  function pointer(px, py) {
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        r.onClick();
        dirty = true;
        return true;
      }
    }
    return false;
  }

  function wheel(px, py, delta) {
    // scroll the topmost window under the cursor
    for (let i = windows.length - 1; i >= 0; i--) {
      const w = windows[i];
      if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) {
        w.scroll = (w.scroll || 0) + (delta > 0 ? 28 : -28);
        dirty = true;
        return true;
      }
    }
    return false;
  }

  function key(e) {
    if (mode === "sleep") {
      wake();
      return true;
    }
    const t = windows.find((w) => w.type === "term");
    if (!t || mode !== "on") return false;
    if (e.key === "Enter") {
      runCommand(term.input);
      term.input = "";
    } else if (e.key === "Backspace") {
      term.input = term.input.slice(0, -1);
    } else if (e.key.length === 1) {
      term.input = (term.input + e.key).slice(0, 48);
    } else {
      return false;
    }
    dirty = true;
    return true;
  }

  function tick(t) {
    now = t;
    const animating = mode === "boot" || mode === "sleep" || windows.some((w) => w.type === "term");
    if (!dirty && !animating) return false;
    regions = [];
    if (mode === "sleep") drawSleep();
    else if (mode === "boot") drawBoot();
    else drawDesktop();
    dirty = false;
    return true;
  }

  function setFloppy(v) {
    floppyIn = v;
    if (!v) windows = windows.filter((w) => w.kind !== "projects");
    dirty = true;
  }

  function setHandlers(h) {
    handlers = { ...handlers, ...h };
  }

  return { canvas, tick, pointer, wheel, key, wake, setFloppy, setHandlers, get mode() { return mode; } };
}
