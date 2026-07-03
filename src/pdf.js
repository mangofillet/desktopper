// Minimal, dependency-free PDF writer. Lays the paginated document lines onto
// A4 pages using the base-14 Helvetica fonts (no embedding needed) and returns
// a Blob you can download. Enough to produce a clean, real, readable .pdf.

const PW = 595.28, PH = 841.89; // A4 in points
const ML = 58, MT = 800;        // left margin, top text baseline

const STYLE = {
  h1: { f: "F2", size: 17, lead: 22, indent: 0 },
  meta: { f: "F3", size: 9.5, lead: 13, indent: 0 },
  h2: { f: "F2", size: 12.5, lead: 18, indent: 0 },
  p: { f: "F1", size: 10, lead: 13.5, indent: 0 },
  fig: { f: "F3", size: 9, lead: 12, indent: 10 },
  figbox: { f: "F1", size: 9, lead: 46, indent: 0 },
  ref: { f: "F1", size: 9, lead: 12, indent: 0 },
  refcont: { f: "F1", size: 9, lead: 12, indent: 16 },
  gap: { f: "F1", size: 10, lead: 7, indent: 0 },
};

// PDF text can't carry raw unicode in a base font; fold the common typographic
// characters back to ASCII and drop anything else exotic.
function ascii(s) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "--")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
}
const esc = (s) => ascii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function pageContent(lines, pageNo, pageCount) {
  const rects = [];
  const text = [];
  let y = MT;
  for (const ln of lines) {
    const st = STYLE[ln.style] || STYLE.p;
    if (ln.style === "figbox") {
      rects.push(`${ML} ${(y - 38).toFixed(1)} ${PW - 2 * ML} 40 re`);
      y -= st.lead;
      continue;
    }
    if (ln.text) {
      text.push(`/${st.f} ${st.size} Tf`);
      text.push(`1 0 0 1 ${(ML + st.indent).toFixed(1)} ${y.toFixed(1)} Tm`);
      text.push(`(${esc(ln.text)}) Tj`);
    }
    y -= st.lead;
  }
  // page-number footer, centred
  const foot = `- ${pageNo} -`;
  const fx = PW / 2 - foot.length * 2.4;
  let g = "";
  if (rects.length) g += `0.5 G 0.7 w\n${rects.join(" S\n")} S\n`;
  g += "BT\n" + text.join("\n") + "\n";
  g += `/F3 8.5 Tf 1 0 0 1 ${fx.toFixed(1)} 40 Tm (${esc(foot)}) Tj\n`;
  g += "ET";
  return g;
}

export function buildPdf(pages, meta = {}) {
  const objects = [];
  const add = (s) => objects.push(s) - 1; // returns index (id-1)

  // 1 catalog, 2 pages tree, 3 fonts (F1/F2/F3) — reserve ids up front.
  const N = pages.length;
  const kids = [];
  const contentIds = [];
  // Page + content objects come after the fixed ones.
  // Fixed: 1=catalog, 2=pages, 3=F1, 4=F2, 5=F3
  let nextId = 6;
  const pageIds = [];
  for (let i = 0; i < N; i++) {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
  }

  const objs = {};
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${N} >>`;
  objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  objs[5] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>`;

  for (let i = 0; i < N; i++) {
    const pid = pageIds[i], cid = contentIds[i];
    objs[pid] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> ` +
      `/Contents ${cid} 0 R >>`;
    const stream = pageContent(pages[i], i + 1, N);
    objs[cid] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  // Serialize with an xref table.
  const totalObjs = 5 + N * 2;
  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id <= totalObjs; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xrefStart = out.length;
  out += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= totalObjs; id++) {
    out += String(offsets[id]).padStart(10, "0") + " 00000 n \n";
  }
  out += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}

export function downloadPdf(pages, filename, meta) {
  const blob = buildPdf(pages, meta);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : filename + ".pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
