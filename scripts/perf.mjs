// Measures frame time in the lit blocking view at an iPad-like size on this
// machine's GPU, for a few rendering settings. Usage: node scripts/perf.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5198, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] });
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['', 'bloom=0', 'sm=1024', 'pr=1.5', 'pr=1', 'pr=1.5&bloom=0', 'pr=1.5&sm=1024'];
for (const v of variants) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  await page.goto(`${base}?${v}`);
  await page.waitForFunction(() => window.__omt, null, { timeout: 20000 });
  await page.click('#go');
  await page.waitForFunction(() => window.__omt.phase === 'block');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => new Promise(res => {
    const ts = []; let last = performance.now();
    const f = now => { ts.push(now - last); last = now; if (ts.length < 240) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); res({ median: ts[120], p90: ts[216], canvas: `${document.querySelector('canvas').width}x${document.querySelector('canvas').height}` }); } };
    requestAnimationFrame(f);
  }));
  console.log(`${(v || 'current').padEnd(18)} ${r.canvas.padEnd(10)} median ${r.median.toFixed(1)} ms (${(1000 / r.median).toFixed(0)} fps)  p90 ${r.p90.toFixed(1)} ms`);
  await page.close();
}
await browser.close();
await server.close();
