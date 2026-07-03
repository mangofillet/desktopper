// Full-screen document reader: shows a paper as real, paginated, readable pages
// with search (term + page jumping), page navigation, an "open original" link,
// and a "take a copy" button that downloads a genuine PDF to the user's machine.
import { generateDocument, paginate } from "./docgen.js";
import { downloadPdf } from "./pdf.js";
import { asset } from "./assets.js";

const css = /* css */ `
  #dt-reader {
    position: fixed; inset: 0; z-index: 40; display: none;
    align-items: center; justify-content: center;
    background: rgba(8, 7, 5, 0.72); backdrop-filter: blur(6px);
    font-family: Georgia, "Times New Roman", serif;
  }
  #dt-reader.show { display: flex; }
  #dt-reader-frame {
    width: min(760px, 94vw); height: min(90vh, 940px);
    display: flex; flex-direction: column;
    background: #f6f2e9; color: #1e1b16;
    border-radius: 8px; overflow: hidden;
    box-shadow: 0 30px 90px rgba(0,0,0,0.6);
    transform: translateY(40px) scale(0.72); opacity: 0;
    transition: transform 0.5s cubic-bezier(.2,.9,.3,1), opacity 0.4s ease;
  }
  #dt-reader.show #dt-reader-frame { transform: none; opacity: 1; }
  #dt-reader-bar {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    background: #2b2620; color: #ece3d2; font-family: system-ui, sans-serif; font-size: 13px;
    flex-wrap: wrap;
  }
  #dt-reader-bar .title { font-weight: 600; margin-right: auto; max-width: 40%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #dt-reader-bar input {
    background: #1c1814; border: 1px solid #4a4236; color: #ece3d2;
    border-radius: 5px; padding: 5px 9px; font-size: 13px; width: 150px; font-family: inherit;
  }
  #dt-reader-bar .count { color: #b6ab97; min-width: 44px; font-variant-numeric: tabular-nums; }
  #dt-reader-bar button {
    background: #3a332a; color: #ece3d2; border: 1px solid #554b3d;
    border-radius: 5px; padding: 5px 10px; font-size: 12.5px; cursor: pointer; font-family: inherit;
  }
  #dt-reader-bar button:hover { background: #4a4236; }
  #dt-reader-bar button.accent { background: #2e7d4f; border-color: #2e7d4f; }
  #dt-reader-bar button.accent:hover { background: #3aa66a; }
  #dt-reader-bar .nav { display: flex; align-items: center; gap: 6px; }
  #dt-reader-bar .pageno { font-variant-numeric: tabular-nums; min-width: 74px; text-align: center; }
  #dt-reader-scroll { flex: 1; overflow-y: auto; padding: 30px; background: #d9d2c4; }
  .dt-page {
    background: #fbf8f1; margin: 0 auto 24px; padding: 46px 52px;
    max-width: 620px; box-shadow: 0 3px 14px rgba(0,0,0,0.18);
    line-height: 1.5; font-size: 15px;
  }
  .dt-page .l-h1 { font-size: 25px; font-weight: 700; line-height: 1.25; }
  .dt-page .l-meta { font-style: italic; color: #5a5346; font-size: 13.5px; }
  .dt-page .l-h2 { font-size: 17px; font-weight: 700; margin-top: 12px; }
  .dt-page .l-p { text-align: justify; }
  .dt-page .l-fig { text-align: center; font-style: italic; font-size: 13px; color: #5a5346; }
  .dt-page .l-figbox { height: 96px; border: 1px solid #b8b0a0; background: #efeae0; margin: 8px 0; }
  .dt-page .l-ref, .dt-page .l-refcont { font-size: 12.5px; color: #40392f; }
  .dt-page .l-refcont { padding-left: 18px; }
  .dt-page .l-gap { height: 8px; }
  .dt-page .foot { text-align: center; color: #9a9080; font-size: 12px; margin-top: 20px; }
  .dt-page mark { background: #ffe27a; color: inherit; padding: 0 1px; border-radius: 2px; }
  .dt-page mark.cur { background: #ff9f43; }
`;

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function createReader({ onClose } = {}) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "dt-reader";
  el.innerHTML = `
    <div id="dt-reader-frame">
      <div id="dt-reader-bar">
        <span class="title"></span>
        <input type="search" placeholder="search…" spellcheck="false" />
        <span class="count"></span>
        <span class="nav">
          <button data-act="prev">‹</button>
          <span class="pageno"></span>
          <button data-act="next">›</button>
        </span>
        <button data-act="open">open original ↗</button>
        <button class="accent" data-act="copy">take a copy ↓</button>
        <button data-act="close">✕</button>
      </div>
      <div id="dt-reader-scroll"></div>
    </div>`;
  document.body.appendChild(el);

  const bar = el.querySelector("#dt-reader-bar");
  const scroll = el.querySelector("#dt-reader-scroll");
  const titleEl = bar.querySelector(".title");
  const searchEl = bar.querySelector("input");
  const countEl = bar.querySelector(".count");
  const pagenoEl = bar.querySelector(".pageno");

  let state = null; // { paper, pages, matches, cur, term }

  function currentPageOfScroll() {
    // Which page is most in view (for the page indicator).
    const pageEls = [...scroll.querySelectorAll(".dt-page")];
    const mid = scroll.scrollTop + scroll.clientHeight / 2;
    let best = 0;
    pageEls.forEach((p, i) => {
      if (p.offsetTop <= mid) best = i;
    });
    return best;
  }

  function render() {
    const term = state.term;
    const matchesByLine = new Map(); // "p:l" -> occurrences
    state.matches = [];
    const lc = term.toLowerCase();

    scroll.innerHTML = state.pages
      .map((lines, pi) => {
        const body = lines
          .map((ln, li) => {
            if (ln.style === "figbox") return `<div class="l-figbox"></div>`;
            if (ln.style === "gap") return `<div class="l-gap"></div>`;
            let html = escapeHtml(ln.text);
            if (lc && ln.text) {
              const low = ln.text.toLowerCase();
              let idx = 0, from = 0, out = "";
              while ((idx = low.indexOf(lc, from)) !== -1) {
                state.matches.push({ page: pi, key: `${pi}:${li}:${idx}` });
                out += escapeHtml(ln.text.slice(from, idx)) +
                  `<mark data-m="${state.matches.length - 1}">` +
                  escapeHtml(ln.text.slice(idx, idx + lc.length)) + `</mark>`;
                from = idx + lc.length;
              }
              out += escapeHtml(ln.text.slice(from));
              html = out;
            }
            return `<div class="l-${ln.style}">${html}</div>`;
          })
          .join("");
        return `<div class="dt-page" data-page="${pi}">${body}<div class="foot">— ${pi + 1} —</div></div>`;
      })
      .join("");

    // mark the current match
    if (state.matches.length && state.cur >= 0) {
      const m = scroll.querySelector(`mark[data-m="${state.cur}"]`);
      if (m) m.classList.add("cur");
    }
    updateStatus();
  }

  function updateStatus() {
    const pageCount = state.pages.length;
    const pi = currentPageOfScroll();
    pagenoEl.textContent = `Page ${pi + 1} / ${pageCount}`;
    if (state.term) {
      countEl.textContent = state.matches.length
        ? `${Math.min(state.cur + 1, state.matches.length)}/${state.matches.length}`
        : "0/0";
    } else countEl.textContent = "";
  }

  function jumpToMatch(i) {
    if (!state.matches.length) return;
    state.cur = ((i % state.matches.length) + state.matches.length) % state.matches.length;
    scroll.querySelectorAll("mark.cur").forEach((m) => m.classList.remove("cur"));
    const m = scroll.querySelector(`mark[data-m="${state.cur}"]`);
    if (m) {
      m.classList.add("cur");
      m.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    updateStatus();
  }

  function goPage(pi) {
    const target = scroll.querySelector(`.dt-page[data-page="${pi}"]`);
    if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function open(paper) {
    const blocks = generateDocument(paper);
    const pages = paginate(blocks);
    state = { paper, pages, matches: [], cur: -1, term: "" };
    titleEl.textContent = paper.title;
    searchEl.value = "";
    el.classList.add("show"); // show first so layout (page offsets) is measurable
    render();
    scroll.scrollTop = 0;
    requestAnimationFrame(() => updateStatus());
  }

  function close() {
    if (!el.classList.contains("show")) return;
    el.classList.remove("show");
    state = null;
    onClose?.();
  }
  function isOpen() {
    return el.classList.contains("show");
  }

  // events
  searchEl.addEventListener("input", () => {
    if (!state) return;
    state.term = searchEl.value.trim();
    state.cur = state.term ? 0 : -1;
    render();
    if (state.matches.length) jumpToMatch(0);
  });
  searchEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      jumpToMatch(state.cur + (e.shiftKey ? -1 : 1));
    }
  });
  scroll.addEventListener("scroll", () => {
    if (state) updateStatus();
  });
  el.addEventListener("click", (e) => {
    if (e.target === el) close(); // click the dark backdrop to dismiss
  });
  bar.addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (!act || !state) return;
    const pi = currentPageOfScroll();
    if (act === "close") close();
    else if (act === "prev") goPage(Math.max(0, pi - 1));
    else if (act === "next") goPage(Math.min(state.pages.length - 1, pi + 1));
    else if (act === "open") {
      if (state.paper.url) window.open(state.paper.url, "_blank", "noopener");
    } else if (act === "copy") {
      const fn = state.paper.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
      downloadPdf(state.pages, fn, { title: state.paper.title });
    }
  });
  window.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    else if (e.key === "ArrowRight") goPage(Math.min(state.pages.length - 1, currentPageOfScroll() + 1));
    else if (e.key === "ArrowLeft") goPage(Math.max(0, currentPageOfScroll() - 1));
  }, true);

  return { open, close, isOpen, el };
}
