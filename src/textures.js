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

export function posterTexture({ title = "golden hour", subtitle = "slow light / good work" } = {}) {
  const [c, ctx] = makeCanvas(420, 594);
  // Warm swiss-style poster: big low sun over hills, one line of type.
  const g = ctx.createLinearGradient(0, 0, 0, 594);
  g.addColorStop(0, "#e8d5b0");
  g.addColorStop(1, "#d8a878");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 420, 594);
  const sun = ctx.createRadialGradient(280, 200, 12, 280, 200, 110);
  sun.addColorStop(0, "#f8e8c0");
  sun.addColorStop(0.7, "#eab868");
  sun.addColorStop(1, "rgba(234,184,104,0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(280, 200, 110, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e89858";
  ctx.beginPath();
  ctx.arc(280, 200, 46, 0, Math.PI * 2);
  ctx.fill();
  // layered hills
  for (const [y, col] of [[320, "#c08858"], [370, "#a87048"], [420, "#8a5a3c"]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 594);
    ctx.lineTo(0, y + 30);
    ctx.quadraticCurveTo(210, y - 40, 420, y + 20);
    ctx.lineTo(420, 594);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "#6a4630";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 490);
  ctx.lineTo(380, 490);
  ctx.stroke();
  ctx.fillStyle = "#4a3220";
  ctx.font = "28px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(title, 40, 528);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#6a4a34";
  ctx.fillText(subtitle, 40, 552);
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

export function skyTexture() {
  // Evening sky: deep indigo overhead melting through mauve into a warm coral
  // sunset at the horizon, with a low sun glow and a few early stars up high.
  const [c, ctx] = makeCanvas(1024, 640);
  const g = ctx.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, "#20264a");
  g.addColorStop(0.38, "#42425f");
  g.addColorStop(0.62, "#6e5568");
  g.addColorStop(0.82, "#b0745e");
  g.addColorStop(0.95, "#dd9a5c");
  g.addColorStop(1, "#e8b064");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 640);
  const r = rng(41);
  // Low sun glow near the horizon, right of centre.
  const sun = ctx.createRadialGradient(680, 500, 8, 680, 500, 220);
  sun.addColorStop(0, "rgba(255,238,200,0.9)");
  sun.addColorStop(0.25, "rgba(255,205,140,0.5)");
  sun.addColorStop(1, "rgba(255,190,120,0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(680, 500, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,245,215,0.85)";
  ctx.beginPath();
  ctx.arc(680, 500, 26, 0, Math.PI * 2);
  ctx.fill();
  // A few faint early stars, confined to the upper (darker) third.
  for (let i = 0; i < 70; i++) {
    const x = r() * 1024;
    const y = r() * 230;
    ctx.globalAlpha = (0.2 + r() * 0.5) * (1 - y / 260);
    const s = r();
    if (s > 0.94) {
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 4);
      gl.addColorStop(0, "rgba(245,240,255,0.9)");
      gl.addColorStop(1, "rgba(245,240,255,0)");
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#eae6f2";
      ctx.fillRect(x, y, 1.3, 1.3);
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

export function frostTexture() {
  // Milky, softly-mottled translucent glass. Translucency is baked into the
  // canvas alpha so it obscures the stars behind like real frosted glass.
  const [c, ctx] = makeCanvas(256, 320);
  ctx.clearRect(0, 0, 256, 320);
  const r = rng(5);
  // base milk — cool + light so the pane stays clearly translucent at night
  ctx.fillStyle = "rgba(178,196,200,0.7)";
  ctx.fillRect(0, 0, 256, 320);
  // soft cloudy blooms
  for (let i = 0; i < 40; i++) {
    const x = r() * 256, y = r() * 320, rad = 20 + r() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.05 + r() * 0.12;
    g.addColorStop(0, `rgba(240,248,250,${a})`);
    g.addColorStop(1, "rgba(240,248,250,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // faint vertical condensation streaks
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.04 + r() * 0.05;
    ctx.fillStyle = "#c4d2d6";
    ctx.fillRect(r() * 256, 0, 1 + r() * 2, 320);
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function forestLayerTexture({ seed = 1, color = "#0b1410", base = 300, spread = 90, step = 26 } = {}) {
  // A transparent band of pine silhouettes for a parallax depth layer.
  const [c, ctx] = makeCanvas(1024, 512);
  const r = rng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(0, base);
  for (let x = 0; x <= 1024; x += step) {
    const h = spread * (0.4 + r() * 0.6);
    // little triangular pine: up to a tip, back down, with a notch
    ctx.lineTo(x + step * 0.3, base - h);
    ctx.lineTo(x + step * 0.5, base - h * 0.55);
    ctx.lineTo(x + step * 0.7, base - h * 0.9);
    ctx.lineTo(x + step, base - h * 0.35);
  }
  ctx.lineTo(1024, 512);
  ctx.closePath();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
