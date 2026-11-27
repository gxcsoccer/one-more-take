// Plays Scene 02 end to end with real pointer events in an iPad-sized Chrome
// window, checks the outcome and saves screenshots to qa-out/.
// Usage: npm run smoke   (starts its own dev server)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'qa-out';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('response', r => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
const fail = msg => { throw new Error(msg); };
const omt = expr => page.evaluate(`(() => { const o = window.__omt; return ${expr}; })()`);
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
const wait = ms => page.waitForTimeout(ms);

async function drag(from, to, steps = 14) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await page.mouse.up();
  await wait(120);
}
const lampAt = d => omt(`o.at(0, 4, ${d})`);
const duckAt = x => omt(`o.at(${x}, 5, o.level.rig.objD)`);
const moveLamp = async d => drag(await lampAt(await omt('o.lampD')), await lampAt(d));
const moveDuck = async x => drag(await duckAt(await omt('o.duckX')), await duckAt(x));
async function take() {
  await page.click('#btn-action', { force: true });
  await wait(900);
  await page.click('#btn-action', { force: true });
  await wait(700);
  await shot(`screening-${(await omt('o.takes')).length}`);
  await page.waitForFunction(() => window.__omt.phase === 'rehearse', null, { timeout: 15000 });
}

try {
  await page.goto(url + 'v1.html');
  await page.waitForFunction(() => window.__omt, null, { timeout: 15000 });
  await wait(400);
  await shot('01-intro');
  await page.click('#go');
  await wait(300);
  if ((await omt('o.phase')) !== 'predict') fail('shot A should open on the storyboard step');

  // Locked props must not move before the storyboard is set.
  const d0 = await omt('o.lampD');
  await moveLamp(70);
  if (Math.abs((await omt('o.lampD')) - d0) > 0.01) fail('lamp moved while clamped');

  // Storyboard: drag the chalk line up to about 30 cm.
  const m0 = await omt('o.marker.value');
  const wall = v => omt(`o.at(20, ${v}, 0)`);
  await drag(await wall(m0), await wall(30));
  const m1 = await omt('o.marker.value');
  if (Math.abs(m1 - 30) > 1.5) fail(`chalk line at ${m1}, wanted about 30`);
  await shot('02-storyboard-A');
  await page.click('#btn-lock');

  // A deliberately weak first take, then a keeper: gives a fair pair (only the lamp changed).
  await moveLamp(90);
  await shot('03-rehearse-A-far');
  await page.screenshot({ path: 'docs/art-reference/layout.png' });
  await take();
  if ((await omt('o.takes'))[0].win) fail('take 1 should be a blooper');
  await moveLamp(60);
  if (!(await omt('o.state.covered.every(Boolean)'))) fail('lamp at 60 should darken all three windows');
  if ((await omt('o.marker.actual')) == null) fail('storyboard was never checked against the real shadow');
  await shot('04-rehearse-A-win');
  await take();
  if (!(await omt('o.takes'))[1].win) fail('take 2 should be a keeper');

  await page.click('#btn-compare');
  await wait(300);
  await shot('05-compare-fair');
  if (!(await omt('o.stamps.fair'))) fail('comparing takes 1 and 2 should earn the fair-test stamp');
  await page.click('#x');

  await page.click('#btn-next');
  await wait(300);
  await shot('06-shotB-card');
  await page.click('#go');
  await wait(300);
  if (!(await omt('o.state.catBlocked'))) fail('shot B should open with the cat in the dark');
  const t0 = await omt('o.marker.value');
  const wallX = v => omt(`o.at(${v}, 40, 0)`);
  await drag(await wallX(t0), await wallX(t0 - 4));
  await shot('07-storyboard-B');
  await page.click('#btn-lock');

  // Search the set for a winning duck position the same way a child would: nudge and look.
  let won = false;
  for (const x of [-2.5, -3, -3.5, -4, -4.5, -2, -5]) {
    await moveDuck(x);
    const s = await omt('o.state');
    if (s.covered.every(Boolean) && s.catNear) { won = true; break; }
  }
  if (!won) {
    for (const d of [62, 64, 58]) {
      await moveLamp(d);
      for (const x of [-2, -3, -4, -5]) {
        await moveDuck(x);
        const s = await omt('o.state');
        if (s.covered.every(Boolean) && s.catNear) { won = true; break; }
      }
      if (won) break;
    }
  }
  if (!won) fail('could not find a winning set-up for shot B by dragging');
  await page.click('#btn-rays');
  await wait(200);
  await shot('08-rehearse-B-win');
  await take();
  await wait(400);
  await shot('09-wrap');
  if (!(await omt('o.stamps.shot'))) fail('shot B keeper should earn the got-the-shot stamp');
  await page.click('#go');

  // Draw-your-own cutout.
  await page.click('.pick[data-cutout="draw"]');
  await wait(200);
  const pad = await page.locator('#pad').boundingBox();
  for (let i = 0; i < 6; i++) await drag({ x: pad.x + pad.width * 0.3, y: pad.y + pad.height * (0.25 + i * 0.1) }, { x: pad.x + pad.width * 0.7, y: pad.y + pad.height * (0.25 + i * 0.1) }, 6);
  await shot('10-draw');
  await page.click('#ok');
  await wait(300);
  await shot('11-own-cutout');

  await page.click('#btn-lang');
  await wait(200);
  await shot('12-chinese');
  await page.click('#btn-compare');
  await wait(300);
  await page.click('#verdict .term');
  await wait(200);
  await shot('13-glossary');

  // Refresh the silhouette references the art brief points at.
  for (const [name, url] of Object.entries(await omt('o.refs'))) writeFileSync(`docs/art-reference/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));

  const evidence = await page.evaluate(() => JSON.parse(localStorage.getItem('omt.evidence.v1') || '[]').map(e => e.kind));
  for (const kind of ['predicted', 'observed', 'fair-pair', 'got-shot', 'retake', 'own-cutout']) if (!evidence.includes(kind)) fail(`no "${kind}" evidence was logged`);
  if (errors.length) fail(`page errors:\n${errors.join('\n')}`);
  console.log(`smoke ok: ${(await omt('o.takes')).length} takes, evidence kinds: ${[...new Set(evidence)].join(', ')}`);
} catch (e) {
  await shot('zz-failure').catch(() => {});
  console.error(String(e.message || e));
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
