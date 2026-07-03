import * as THREE from "three";

// All 2D content in the scene (paper pages, book covers, poster art, the
// night sky) is drawn onto canvases at build time — no image downloads, and
// everything restyles from code.

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Deterministic pseudo-random so paper layouts differ but are stable per index.
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function paperTexture({ title, authors, seed = 1 }) {
  const [c, ctx] = makeCanvas(420, 594);
  const rand = rng(seed);
  ctx.fillStyle = "#f6f0e3";
  ctx.fillRect(0, 0, 420, 594);

  // Title block
  ctx.fillStyle = "#22201c";
  ctx.font = "bold 22px Georgia, serif";
  wrapText(ctx, title, 40, 60, 340, 26);
  ctx.font = "italic 14px Georgia, serif";
  ctx.fillStyle = "#44403a";
  ctx.fillText(authors, 40, 128, 340);

  // Abstract: a justified grey block
  ctx.fillStyle = "#57534c";
  for (let y = 165; y < 240; y += 11) {
    ctx.fillRect(40, y, 340 * (0.82 + rand() * 0.18), 5);
  }

  // Two columns of body "text"
  ctx.fillStyle = "#6b675f";
  for (const colX of [40, 225]) {
    for (let y = 270; y < 545; y += 10) {
      if (rand() > 0.93) continue; // paragraph breaks
      ctx.fillRect(colX, y, 155 * (0.75 + rand() * 0.25), 4);
    }
  }
  // A "figure" box in one column
  const figY = 300 + rand() * 150;
  ctx.strokeStyle = "#8a857b";
  ctx.strokeRect(225, figY, 155, 90);
  ctx.beginPath();
  ctx.moveTo(235, figY + 75);
  for (let x = 0; x <= 135; x += 5) {
    ctx.lineTo(235 + x, figY + 75 - 60 * Math.abs(Math.sin(x * 0.05 + seed)) * (x / 135));
  }
  ctx.stroke();
  return toTexture(c);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w + " ";
      y += lineH;
    } else line += w + " ";
  }
  ctx.fillText(line, x, y);
  return y;
}

export function bookCoverTexture({ title, author, bg, fg }) {
  const [c, ctx] = makeCanvas(300, 420);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 300, 420);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 264, 384);
  ctx.fillStyle = fg;
  ctx.font = "bold 30px Georgia, serif";
  ctx.textAlign = "center";
  const endY = wrapTextCentered(ctx, title.toUpperCase(), 150, 110, 230, 36);
  ctx.font = "16px Georgia, serif";
  ctx.fillText(author, 150, endY + 60);
  ctx.beginPath();
  ctx.moveTo(90, endY + 25);
  ctx.lineTo(210, endY + 25);
  ctx.stroke();
  return toTexture(c);
}

function wrapTextCentered(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW && line) {
      ctx.fillText(line.trim(), cx, y);
      line = w + " ";
      y += lineH;
    } else line += w + " ";
  }
  ctx.fillText(line.trim(), cx, y);
  return y;
}

export function posterTexture() {
  const [c, ctx] = makeCanvas(420, 594);
  // Night-swiss poster: deep field, big moon, one line of type.
  const g = ctx.createLinearGradient(0, 0, 0, 594);
  g.addColorStop(0, "#0c1626");
  g.addColorStop(1, "#1a2c3f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 420, 594);
  const r = rng(7);
  ctx.fillStyle = "#c8d6ea";
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.7;
    ctx.fillRect(20 + r() * 380, 20 + r() * 420, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  const moon = ctx.createRadialGradient(290, 170, 10, 290, 170, 95);
  moon.addColorStop(0, "#f2ead8");
  moon.addColorStop(0.75, "#e8dcc4");
  moon.addColorStop(1, "rgba(232,220,196,0)");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(290, 170, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d8c9a8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 480);
  ctx.lineTo(380, 480);
  ctx.stroke();
  ctx.fillStyle = "#e8dfcc";
  ctx.font = "28px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText("nocturne", 40, 522);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#93a5bd";
  ctx.fillText("late hours / quiet work", 40, 548);
  return toTexture(c);
}

export function stickyTexture(lines, ink = "#333") {
  const [c, ctx] = makeCanvas(160, 160);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, 160, 160);
  ctx.fillStyle = ink;
  ctx.font = "italic 20px 'Comic Sans MS', cursive";
  lines.forEach((l, i) => ctx.fillText(l, 16, 45 + i * 30));
  return toTexture(c);
}

export function keyboardTexture(cols = 14, rows = 5) {
  // Transparent atlas of key legends, laid over the instanced keycap grid.
  const cw = 46;
  const [c, ctx] = makeCanvas(cols * cw, rows * cw);
  const layout = [
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "⌫"],
    ["⇥", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
    ["⇪", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "⏎", "⏎"],
    ["⇧", "", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "⇧", "⇧"],
    ["fn", "ctl", "alt", "", "", "", "", "", "", "", "alt", "ctl", "←", "→"],
  ];
  ctx.fillStyle = "#3b372e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const label = layout[r]?.[col] ?? "";
      if (!label) continue;
      ctx.font = label.length > 1 ? `${cw * 0.32}px monospace` : `bold ${cw * 0.5}px monospace`;
      ctx.fillText(label, col * cw + cw / 2, r * cw + cw / 2);
    }
  }
  // space bar hint
  ctx.fillRect(3.6 * cw, 4.62 * cw, 6 * cw, 3);
  return toTexture(c);
}

export function screenSleepTexture() {
  // What the laptop shows before the OS milestone: dark desktop, hint of mint.
  // 640×480 — the VGA 4:3 panel these machines actually shipped with.
  const [c, ctx] = makeCanvas(640, 480);
  const g = ctx.createLinearGradient(0, 0, 640, 480);
  g.addColorStop(0, "#101812");
  g.addColorStop(1, "#0a0f0c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 480);
  // Mint-ish emblem, faint
  ctx.strokeStyle = "#3aa66a";
  ctx.lineWidth = 7;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.roundRect(270, 160, 100, 100, 22);
  ctx.stroke();
  ctx.font = "bold 56px monospace";
  ctx.fillStyle = "#3aa66a";
  ctx.textAlign = "center";
  ctx.fillText("D", 320, 232);
  ctx.globalAlpha = 0.85;
  ctx.font = "19px monospace";
  ctx.fillStyle = "#7fd9a4";
  ctx.fillText("Wake up…", 320, 330);
  // taskbar
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#131a15";
  ctx.fillRect(0, 448, 640, 32);
  ctx.fillStyle = "#2e7d4f";
  ctx.fillRect(10, 454, 52, 20);
  ctx.fillStyle = "#9ab0a0";
  ctx.font = "15px monospace";
  ctx.textAlign = "right";
  ctx.fillText("18:47", 626, 469);
  return toTexture(c);
}

export function steamTexture() {
  // Soft vertical wisp for the mug's steam sprites.
  const [c, ctx] = makeCanvas(64, 128);
  const g = ctx.createRadialGradient(32, 64, 4, 32, 64, 60);
  g.addColorStop(0, "rgba(255,250,240,0.55)");
  g.addColorStop(0.5, "rgba(255,250,240,0.18)");
  g.addColorStop(1, "rgba(255,250,240,0)");
  ctx.save();
  ctx.translate(32, 64);
  ctx.scale(0.55, 1);
  ctx.translate(-32, -64);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 128);
  ctx.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function nightSkyTexture() {
  // Early evening: blue dusk fading to a warm just-set-sun horizon.
  const [c, ctx] = makeCanvas(512, 640);
  const g = ctx.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, "#131c3a");
  g.addColorStop(0.45, "#2b3560");
  g.addColorStop(0.75, "#5a4668");
  g.addColorStop(0.92, "#a86a4e");
  g.addColorStop(1, "#c98a52");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 640);
  const r = rng(23);
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.15 + r() * 0.5; // first faint stars, high in the sky
    ctx.fillStyle = "#dce6f5";
    ctx.fillRect(r() * 512, r() * 260, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  // A pale early moon, upper right — subtler at dusk than at night
  const halo = ctx.createRadialGradient(380, 390, 16, 380, 390, 80);
  halo.addColorStop(0, "rgba(238,242,252,0.85)");
  halo.addColorStop(0.3, "rgba(210,220,245,0.25)");
  halo.addColorStop(1, "rgba(210,220,245,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(380, 390, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8ecf8";
  ctx.beginPath();
  ctx.arc(380, 390, 24, 0, Math.PI * 2);
  ctx.fill();
  // Soft distant treeline at the horizon — no buildings, just evening.
  ctx.fillStyle = "#1c1520";
  ctx.beginPath();
  ctx.moveTo(0, 640);
  ctx.lineTo(0, 560);
  for (let x = 0; x <= 512; x += 18) {
    ctx.lineTo(x, 560 - r() * 26 - 8 * Math.sin(x * 0.02));
  }
  ctx.lineTo(512, 640);
  ctx.closePath();
  ctx.fill();
  return toTexture(c);
}
