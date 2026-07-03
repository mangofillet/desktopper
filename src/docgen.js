// Generates a readable, multi-page academic document from a paper's metadata.
// Deterministic per paper (seeded by the title) so the on-screen reader and the
// exported PDF paginate identically — page numbers and search line up.

function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const OPENERS = [
  "We begin by formalizing the setting in which",
  "A central observation of this work is that",
  "It has long been understood that",
  "In contrast to earlier treatments,",
  "The results reported here suggest that",
  "Building on a growing body of evidence,",
  "To motivate the approach, consider that",
  "Somewhat surprisingly, we find that",
];
const MIDDLES = [
  "the underlying structure can be recovered from remarkably few observations",
  "the effect persists across a wide range of parameter regimes",
  "naive estimators systematically underestimate the quantity of interest",
  "the coupling between the two components dominates the dynamics",
  "the phenomenon is robust to reasonable changes in the assumptions",
  "small perturbations propagate in a predictable, quantifiable way",
  "the model reproduces the qualitative behaviour observed empirically",
  "a single control parameter governs the transition between regimes",
];
const CLOSERS = [
  "which we make precise in the following section.",
  "a point we return to in the discussion.",
  "consistent with the theory developed above.",
  "as illustrated in the accompanying figure.",
  "though the mechanism remains only partly understood.",
  "with implications for both theory and practice.",
  "even in the presence of substantial noise.",
  "and this forms the basis of our main result.",
];
const CONNECT = [
  "Moreover,", "In particular,", "Consequently,", "By contrast,",
  "More concretely,", "Taken together,", "Importantly,", "Nevertheless,",
];

function sentence(r, kw) {
  const k = kw.length ? pick(r, kw) : "the system";
  const forms = [
    `${pick(r, OPENERS)} ${pick(r, MIDDLES)} ${pick(r, CLOSERS)}`,
    `${pick(r, CONNECT)} ${k} plays a decisive role once ${pick(r, MIDDLES)}.`,
    `We quantify how ${k} shapes the outcome, finding that ${pick(r, MIDDLES)}.`,
  ];
  return pick(r, forms);
}
function paragraph(r, kw, n) {
  const s = [];
  for (let i = 0; i < n; i++) s.push(sentence(r, kw));
  return s.join(" ");
}

export function generateDocument(paper) {
  const r = rng(seedFrom(paper.title));
  const kw = paper.title
    .split(/[^A-Za-z]+/)
    .filter((w) => w.length > 4)
    .map((w) => w.toLowerCase());

  const blocks = [];
  blocks.push({ type: "h1", text: paper.title });
  blocks.push({ type: "meta", text: paper.authors });
  blocks.push({ type: "meta", text: `${paper.venue}${paper.year ? ", " + paper.year : ""}` });

  blocks.push({ type: "h2", text: "Abstract" });
  blocks.push({ type: "p", text: paper.abstract || paragraph(r, kw, 4) });

  const sections = [
    ["1  Introduction", 3],
    ["2  Related Work", 2],
    ["3  Method", 3],
    ["4  Experiments", 2],
    ["5  Results", 2],
    ["6  Discussion", 2],
    ["7  Conclusion", 1],
  ];
  for (const [title, paras] of sections) {
    blocks.push({ type: "h2", text: title });
    for (let i = 0; i < paras; i++) {
      blocks.push({ type: "p", text: paragraph(r, kw, 3 + Math.floor(r() * 3)) });
    }
    if (title.includes("Method") || title.includes("Results")) {
      blocks.push({ type: "fig", text: `Figure ${title.includes("Results") ? 2 : 1}: ${paragraph(r, kw, 1)}` });
    }
  }

  blocks.push({ type: "h2", text: "References" });
  const refAuthors = ["A. Turing", "G. Hinton", "E. Noether", "C. Shannon", "B. Mandelbrot", "R. Feynman", "K. Gödel", "D. Knuth"];
  for (let i = 0; i < 6; i++) {
    blocks.push({
      type: "ref",
      text: `[${i + 1}] ${pick(r, refAuthors)} and ${pick(r, refAuthors)}. ${paragraph(r, kw, 1).slice(0, 60)}. ${1990 + Math.floor(r() * 34)}.`,
    });
  }
  return blocks;
}

// Word-wrap a string to a column width (in characters).
function wrap(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line.length + w.length + 1 > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Flatten blocks into wrapped display lines, then paginate. Each line carries
// its style so both the HTML reader and the PDF renderer stay in lockstep.
export function paginate(blocks, { width = 92, linesPerPage = 34 } = {}) {
  const lines = [];
  for (const b of blocks) {
    if (b.type === "h1") {
      wrap(b.text, width - 4).forEach((t) => lines.push({ style: "h1", text: t }));
      lines.push({ style: "gap", text: "" });
    } else if (b.type === "meta") {
      lines.push({ style: "meta", text: b.text });
    } else if (b.type === "h2") {
      lines.push({ style: "gap", text: "" });
      lines.push({ style: "h2", text: b.text });
    } else if (b.type === "fig") {
      lines.push({ style: "gap", text: "" });
      lines.push({ style: "figbox", text: "" });
      wrap(b.text, width).forEach((t) => lines.push({ style: "fig", text: t }));
      lines.push({ style: "gap", text: "" });
    } else if (b.type === "ref") {
      wrap(b.text, width).forEach((t, i) =>
        lines.push({ style: i === 0 ? "ref" : "refcont", text: t })
      );
    } else {
      wrap(b.text, width).forEach((t) => lines.push({ style: "p", text: t }));
      lines.push({ style: "gap", text: "" });
    }
  }
  // Paginate, avoiding a heading stranded as the last line of a page.
  const pages = [];
  let page = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (page.length >= linesPerPage || (page.length >= linesPerPage - 1 && ln.style === "h2")) {
      pages.push(page);
      page = [];
    }
    if (ln.style === "gap" && page.length === 0) continue; // no leading blank
    page.push(ln);
  }
  if (page.length) pages.push(page);
  return pages;
}
