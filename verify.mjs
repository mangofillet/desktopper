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
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOT}/01-hero.png` });

// Hover the big left paper: it should lift + glow, cursor becomes pointer.
await page.mouse.move(400, 560);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT}/02-hover-paper.png` });

// Click it: cinematic flight (~1.2s), then the reading card with "read →".
await page.mouse.click(400, 560);
await page.waitForTimeout(2600);
await page.screenshot({ path: `${SHOT}/03-paper-focus.png` });
const readBtn = await page.locator("#dt-card a.btn").count();
if (readBtn < 1) errors.push("FLOW: paper focus card missing read button");

// Esc flies home and re-enables orbit.
await page.keyboard.press("Escape");
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
  console.log("OK — hero, hover, paper focus (card+link), home, laptop focus all clean.");
}
await browser.close();
