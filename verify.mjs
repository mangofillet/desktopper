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

if (errors.length) {
  console.log("PROBLEMS:\n" + errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("OK — hero, reader (pages+search+PDF download), home, projects, laptop OS all clean.");
}
await browser.close();
