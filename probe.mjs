// One-off probe: prints [dt] console lines (model dimensions) and grabs a shot.
import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--use-gl=angle"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => {
  if (m.text().startsWith("[dt]")) console.log(m.text());
  if (m.type() === "error") console.log("ERR:", m.text());
});
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`http://localhost:${process.argv[2] ?? 5173}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: ".verify/probe.png" });
await browser.close();
