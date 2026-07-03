// Generate the placeholder public/cv.pdf from a tiny HTML page.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync("./portfolio.json", "utf8"));
const html = `<!doctype html><meta charset="utf-8"><style>
  body { font-family: Georgia, serif; margin: 56px; color: #222; }
  h1 { margin: 0; } .tag { color: #666; font-style: italic; }
  h2 { border-bottom: 1px solid #999; padding-bottom: 4px; margin-top: 28px; }
  li { margin-bottom: 6px; }
</style>
<h1>${cfg.name}</h1><div class="tag">${cfg.tagline}</div>
<p>${cfg.bio}</p>
<h2>Publications</h2><ul>
${cfg.papers.map((p) => `<li>${p.authors} (${p.year}). <b>${p.title}</b>. <i>${p.venue}</i>.</li>`).join("")}
</ul>
<h2>Projects</h2><ul>
${cfg.projects.map((p) => `<li><b>${p.name}</b> — ${p.blurb}</li>`).join("")}
</ul>
<p class="tag">Placeholder CV — swap in the real one at public/cv.pdf.</p>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.pdf({ path: "public/cv.pdf", format: "A4" });
await browser.close();
console.log("public/cv.pdf written");
