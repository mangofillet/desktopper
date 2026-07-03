// DESKTOPPER OS — a Linux Mint-flavoured toy desktop drawn onto a 640×480
// canvas (the real VGA resolution of the classic_laptop). It is a convincing
// prop, not an emulator: file manager, doc viewer, terminal, and one
// well-earned easter egg. All content comes from portfolio.json.

const W = 640;
const H = 480;
const BAR = 32; // taskbar height
const MINT = "#3aa66a";
const MINT_DIM = "#2e7d4f";

export function createOS({ config, openUrl }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ---------- virtual filesystem ----------
  const fs = {
    "about.txt": config.bio,
    "contact.txt": Object.entries(config.links)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    "cv.pdf": null, // opens externally
  };
  const paperFiles = config.papers.map((p, i) => ({
    name: `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}.pdf`,
    paper: p,
    idx: i,
  }));

  // ---------- state ----------
  let mode = "sleep"; // sleep | boot | on
  let bootT0 = 0;
  let dirty = true;
  let now = 0;
  let windows = []; // {type:'files'|'docs'|'doc'|'term', title, ...}
  let regions = []; // hit areas, rebuilt every draw
  let term = null; // {lines:[], input:""}

  const BOOT_LINES = [
    "DESKTOPPER BIOS v1.0 — 640K ok",
    "loading kernel ................ ok",
    "mounting /dev/desk ............ ok",
    "starting mint session ......... ok",
    "",
    "wake up…",
  ];

  // ---------- helpers ----------
  function region(x, y, w, h, onClick) {
    regions.push({ x, y, w, h, onClick });
  }

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

  function windowFrame(x, y, w, h, title, onClose) {
    ctx.fillStyle = "rgba(24, 28, 25, 0.97)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 160, 130, 0.5)";
    ctx.stroke();
    ctx.fillStyle = "#242a26";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 24, [6, 6, 0, 0]);
    ctx.fill();
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#b8c8ba";
    ctx.fillText(title, x + 10, y + 16);
    ctx.fillStyle = "#c46a5a";
    ctx.beginPath();
    ctx.arc(x + w - 14, y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    region(x + w - 22, y + 2, 20, 20, onClose);
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

  // ---------- window openers ----------
  const closeTop = () => {
    windows.pop();
    dirty = true;
  };

  function openFiles(which) {
    windows.push({ type: which }); // 'files' (papers) | 'docs' (projects)
    dirty = true;
  }
  function openDoc(title, body, url, linkLabel) {
    windows.push({ type: "doc", title, body, url, linkLabel });
    dirty = true;
  }
  function openTerm() {
    if (!term) {
      term = {
        lines: ["desktopper os 1.0 — type `help`"],
        input: "",
      };
    }
    windows = windows.filter((w) => w.type !== "term");
    windows.push({ type: "term" });
    dirty = true;
  }

  // ---------- terminal ----------
  function runCommand(cmd) {
    const t = term;
    t.lines.push("jin@desk:~$ " + cmd);
    const [c, ...args] = cmd.trim().split(/\s+/);
    const arg = args.join(" ");
    if (!c) {
    } else if (c === "help") {
      t.lines.push("ls · cat <file> · open <file> · papers · clear · exit");
    } else if (c === "ls") {
      t.lines.push("papers/  projects/  " + Object.keys(fs).join("  "));
    } else if (c === "papers") {
      paperFiles.forEach((f) => t.lines.push("  " + f.name));
    } else if (c === "clear") {
      t.lines = [];
    } else if (c === "exit") {
      windows = windows.filter((w) => w.type !== "term");
    } else if (c === "cat" && fs[arg] !== undefined) {
      if (fs[arg] === null) t.lines.push(`binary file — try \`open ${arg}\``);
      else wrap(fs[arg], 52).forEach((l) => t.lines.push(l));
    } else if (c === "open") {
      const pf = paperFiles.find((f) => f.name.startsWith(arg));
      if (arg === "cv.pdf") openUrl(config.cvUrl);
      else if (pf) openUrl(pf.paper.url);
      else t.lines.push(`open: ${arg}: not found`);
    } else {
      t.lines.push(`${c}: command not found (try \`help\`)`);
    }
    t.lines = t.lines.slice(-14);
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
    // wallpaper
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

    // desktop icons
    icon(18, 20, "▤", "papers", () => openFiles("files"));
    icon(18, 96, "▦", "projects", () => openFiles("docs"));
    icon(18, 172, "≡", "about.txt", () =>
      openDoc("about.txt", config.bio, null)
    );
    icon(18, 248, "@", "contact.txt", () =>
      openDoc("contact.txt", fs["contact.txt"], null)
    );
    icon(18, 324, "▣", "cv.pdf", () => openUrl(config.cvUrl));

    // windows
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
    ctx.fillText("18:47", W - 12, H - BAR + 20);
  }

  function drawWindow(w) {
    if (w.type === "files" || w.type === "docs") {
      const isPapers = w.type === "files";
      const items = isPapers
        ? paperFiles.map((f) => ({
            label: f.name,
            glyph: "▤",
            onClick: () =>
              openDoc(
                f.name,
                `${f.paper.title}\n${f.paper.authors} — ${f.paper.venue} ${f.paper.year}\n\n${f.paper.abstract}`,
                f.paper.url,
                "open ↗"
              ),
          }))
        : config.projects.map((p) => ({
            label: p.name.toLowerCase(),
            glyph: "▦",
            onClick: () => openDoc(p.name, p.blurb, p.url, "visit ↗"),
          }));
      const x = 110, y = 46, ww = 400, wh = 60 + items.length * 26;
      windowFrame(x, y, ww, wh, isPapers ? "~/papers" : "~/projects", closeTop);
      ctx.font = "13px monospace";
      ctx.textAlign = "left";
      items.forEach((it, i) => {
        const iy = y + 46 + i * 26;
        ctx.fillStyle = "#8fd9a8";
        ctx.fillText(it.glyph, x + 16, iy);
        ctx.fillStyle = "#cfd8cf";
        ctx.fillText(it.label, x + 40, iy);
        region(x + 10, iy - 14, ww - 20, 22, it.onClick);
      });
    } else if (w.type === "doc") {
      const x = 150, y = 60, ww = 420, wh = 330;
      windowFrame(x, y, ww, wh, w.title, closeTop);
      ctx.font = "12.5px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#cfd8cf";
      wrap(w.body, 52)
        .slice(0, 18)
        .forEach((l, i) => ctx.fillText(l, x + 16, y + 46 + i * 15));
      if (w.url) {
        ctx.fillStyle = MINT_DIM;
        ctx.beginPath();
        ctx.roundRect(x + 16, y + wh - 40, 90, 26, 5);
        ctx.fill();
        ctx.fillStyle = "#eafff2";
        ctx.fillText(w.linkLabel ?? "open ↗", x + 28, y + wh - 22);
        region(x + 16, y + wh - 40, 90, 26, () => openUrl(w.url));
      }
    } else if (w.type === "term") {
      const x = 92, y = 120, ww = 460, wh = 290;
      windowFrame(x, y, ww, wh, "jin@desk: ~", () => {
        windows = windows.filter((v) => v.type !== "term");
        dirty = true;
      });
      ctx.font = "13px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#9fe8b8";
      term.lines.forEach((l, i) => ctx.fillText(l, x + 14, y + 44 + i * 16));
      const iy = y + 44 + term.lines.length * 16;
      const cursor = Math.floor(now * 2.5) % 2 ? "█" : " ";
      ctx.fillText("jin@desk:~$ " + term.input + cursor, x + 14, iy);
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
    // topmost region wins
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

  function key(e) {
    if (mode === "sleep") {
      wake();
      return true;
    }
    const hasTerm = windows.some((w) => w.type === "term");
    if (!hasTerm || mode !== "on") return false;
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
    const animating =
      mode === "boot" || mode === "sleep" ||
      windows.some((w) => w.type === "term");
    if (!dirty && !animating) return false;
    regions = [];
    if (mode === "sleep") drawSleep();
    else if (mode === "boot") drawBoot();
    else drawDesktop();
    dirty = false;
    return true;
  }

  return { canvas, tick, pointer, key, wake, get mode() { return mode; } };
}
