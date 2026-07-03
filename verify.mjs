// Headless smoke test for Desktopper (dev server must be up: `node verify.mjs [port]`).
// Drives Playwright's bundled Chromium directly. Screenshots land in ./.verify.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const port = process.argv[2] ?? "5173";
const SHOT = "./.verify";
mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(5200); // let the async laptop model load
await page.screenshot({ path: `${SHOT}/01-hero.png` });

// Focus a paper → it's picked up into the full-screen reader.
await page.evaluate(() => window.__dt.focus("paper-1"));
await page.waitForTimeout(2200);
await page.screenshot({ path: `${SHOT}/03-reader.png` });
const pages = await page.locator("#dt-reader .dt-page").count();
if (pages < 2) errors.push(`FLOW: reader should have multiple pages, got ${pages}`);

// Search a common term and confirm matches highlight.
await page.fill("#dt-reader input", "the");
await page.waitForTimeout(400);
const matchCount = await page.locator("#dt-reader mark").count();
if (matchCount < 1) errors.push("FLOW: reader search produced no highlights");
await page.screenshot({ path: `${SHOT}/03b-reader-search.png` });

// "Take a copy" should trigger a real PDF download.
const dl = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
await page.click('#dt-reader button[data-act="copy"]');
const download = await dl;
if (!download) errors.push("FLOW: take-a-copy did not download a PDF");
else if (!download.suggestedFilename().endsWith(".pdf")) errors.push("FLOW: download is not a .pdf");

// Close the reader (flies home).
await page.click('#dt-reader button[data-act="close"]');
await page.waitForTimeout(1600);
await page.screenshot({ path: `${SHOT}/04-back-home.png` });

// Headphones: wear animation + now-playing toast, then take off.
// (Uses the DEV hook — a pixel click can land on the paper beneath them.)
await page.evaluate(() => window.__dt.wearPhones());
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOT}/06-headphones-on.png` });
const toastShown = await page.locator("#dt-toast.show").count();
if (toastShown < 1) errors.push("FLOW: headphones toast did not appear");
await page.evaluate(() => window.__dt.takeOffPhones());
await page.waitForTimeout(1500);

// Projects: floppy flies into the laptop drive, card lists projects.
await page.evaluate(() => window.__dt.focus("projects"));
await page.waitForTimeout(2600);
await page.screenshot({ path: `${SHOT}/07-floppy-inserted.png` });
const projCard = await page.locator("#dt-card li a").count();
if (projCard < 1) errors.push("FLOW: projects card missing links");
await page.evaluate(() => window.__dt.home());
await page.waitForTimeout(1800);

// Laptop focus: boots DESKTOPPER OS.
await page.evaluate(() => window.__dt.focus("laptop"));
await page.waitForTimeout(4200); // flight + boot sequence
await page.screenshot({ path: `${SHOT}/05-laptop-os.png` });
const osMode = await page.evaluate(() => window.__dt.os.mode);
if (osMode !== "on") errors.push(`FLOW: OS should be on after boot, got ${osMode}`);

// Terminal: type `ls` and check the fs listing renders.
await page.keyboard.type("ls");
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT}/05b-terminal-ls.png` });

// Open the papers folder via the OS desktop icon.
await page.evaluate(() => window.__dt.os.pointer(47, 42));
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT}/05c-os-papers.png` });

await page.keyboard.press("Escape");
await page.waitForTimeout(1600);

// ---- Edit mode (owner-only) on a fresh page with ?edit ----
const ep = await browser.newPage({ viewport: { width: 1440, height: 900 } });
ep.on("pageerror", (e) => errors.push("EDIT PAGEERR: " + e.message));
ep.on("console", (m) => m.type() === "error" && errors.push("EDIT: " + m.text()));
await ep.goto(`http://localhost:${port}/?edit`, { waitUntil: "networkidle" });
await ep.waitForTimeout(5500);
if ((await ep.locator("#dt-edit-toggle").count()) < 1) errors.push("EDIT: toggle missing");
await ep.click("#dt-edit-toggle");
await ep.waitForTimeout(250);
if ((await ep.locator("#dt-edit-panel.show").count()) < 1) errors.push("EDIT: panel didn't open");
await ep.click("#dt-edit-tabs button[data-tab=profile]");
await ep.waitForTimeout(120);
await ep.fill("#dt-edit-tabbody input", "Verify Name");
await ep.waitForTimeout(120);
const nm = await ep.evaluate(() => JSON.parse(localStorage.getItem("desktopper.config.v1")).name);
if (nm !== "Verify Name") errors.push("EDIT: text edit not persisted");
await ep.mouse.move(400, 560);
await ep.mouse.down();
await ep.mouse.move(520, 600, { steps: 6 });
await ep.mouse.up();
await ep.waitForTimeout(150);
const moved = await ep.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("desktopper.layout.v1") || "{}")).length);
if (moved < 1) errors.push("EDIT: drag did not persist a layout entry");
await ep.screenshot({ path: `${SHOT}/08-edit-mode.png` });

if (errors.length) {
  console.log("PROBLEMS:\n" + errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("OK — reader (pages+search+PDF), projects, laptop OS, and edit mode (panel+text+drag) all clean.");
}
await browser.close();
