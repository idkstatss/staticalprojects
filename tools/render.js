// Usage: node tools/render.js [page.html] [out.mp4] [--hold=3]
// Renders a Statical page to a 1920x1080 60fps MP4, frame by frame, using a fake browser clock.
// Requires: playwright (+ chromium) and ffmpeg on your PATH.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [file = "projects/collect-rare-pets/index.html", out = "out.mp4"] = args.filter((a) => !a.startsWith("--"));
const FPS = 60, W = 1920, H = 1080;
const HOLD_MS = Number(flags.hold ?? 3) * 1000; // seconds to hold on the final frame

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on("pageerror", (e) => console.error("\nPage error:", e.message));
  await page.clock.install({ time: 0 }); // fake timers, rAF and performance.now
  await page.goto("file://" + path.resolve(file), { waitUntil: "load" });

  const total = await page.evaluate(() => dates.length * DPMS); // ms of animation
  const frames = Math.ceil(((total + HOLD_MS) / 1000) * FPS);
  console.log(`Rendering ${frames} frames (~${Math.round(frames / FPS)}s) -> ${out}`);

  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((r) => ff.on("close", r));

  let t = 0;
  for (let i = 0; i < frames; i++) {
    const target = Math.round((i * 1000) / FPS);
    if (target > t) { await page.clock.runFor(target - t); t = target; }
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 60 === 0) process.stdout.write(`\r${i}/${frames}`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`\nDone: ${out}`);
})();
