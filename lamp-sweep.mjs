// Sweep lamp yaw values and screenshot crops to find the pose where the
// shade faces the desk. node lamp-sweep.mjs [port]
import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--use-gl=angle"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://localhost:${process.argv[2] ?? 5173}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__lamp, null, { timeout: 15000 });
await page.waitForTimeout(600);
for (const y of [0, 1.13, 2.2, 3.14, -1.0, -2.2]) {
  await page.evaluate((yaw) => {
    const { lampG } = window.__lamp;
    lampG.rotation.y = yaw;
  }, y);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `.verify/lamp-y${y}.png`,
    clip: { x: 250, y: 120, width: 450, height: 400 },
  });
}
await browser.close();
console.log("done");
