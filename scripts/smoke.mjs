// Plays Scene 02 end to end with real pointer drags in an iPad-sized Chrome
// window, checks each beat's outcome and saves screenshots to qa-out/.
// Usage: npm run smoke   (starts its own dev server)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

const out = 'qa-out';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
// CI machines have no GPU: render in software, at 1x, and allow far more time,
// because the game then runs in slow motion.
const CI = !!process.env.CI, SLOW = CI ? 8 : 1;
const gpu = process.platform === 'darwin' && !CI ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpu, '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: CI ? { width: 1024, height: 768 } : { width: 1180, height: 820 }, deviceScaleFactor: CI ? 1 : 2, hasTouch: true });
page.setDefaultTimeout(30000 * SLOW);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('response', r => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
const fail = msg => { throw new Error(msg); };
const omt = expr => page.evaluate(`(() => { const o = window.__omt; return ${expr}; })()`);
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
const wait = ms => page.waitForTimeout(ms);
const phase = (p, timeout = 20000) => page.waitForFunction(want => window.__omt.phase === want, p, { timeout: timeout * SLOW });

async function drag(from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await page.mouse.up();
  await wait(80);
}
// Drag like a person would: aim, look, correct.
async function setLamp(z) {
  for (let i = 0; i < 5 && Math.abs((await omt('o.setup.lampZ')) - z) > 0.6; i++) await drag(await omt('o.handles.lamp'), await omt(`o.lampAt(${z})`));
  if (Math.abs((await omt('o.setup.lampZ')) - z) > 1) fail(`could not drag the lamp to ${z}`);
}
async function setMark(x) {
  for (let i = 0; i < 5 && Math.abs((await omt('o.setup.markX')) - x) > 0.3; i++) await drag(await omt('o.handles.mark'), await omt(`o.markAt(${x})`));
  if (Math.abs((await omt('o.setup.markX')) - x) > 0.6) fail(`could not drag the mark to ${x}`);
}
async function take(name) {
  const c = await omt('o.handles.clapper');
  await page.mouse.click(c.x, c.y);
  await phase('take', 3000);
  await page.waitForFunction(n => window.__omt.verdict && window.__omt.takeNo === n && document.getElementById('burst').hidden === false, await omt('o.takeNo'), { timeout: 15000 * SLOW });
  await wait(500);
  await shot(name);
  return omt('o.verdict');
}

// After a keeper a reporter asks one exam-style question.
async function pressQuestion(name, answerRight) {
  await phase('quiz');
  await wait(400);
  const right = await omt('o.quizAnswer');
  await page.click(`.opts button[data-i="${answerRight ? right : (right + 1) % 4}"]`);
  await wait(300);
  await shot(name);
  await page.click('#go');
}

try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__omt, null, { timeout: 20000 * SLOW });
  await wait(1200);
  await shot('01-intro');
  await page.click('#go');
  await phase('block');
  await wait(900);
  await shot('02-play-start');

  // Beat 1, lamp lit: a set-up that does not fit is a CUT, the fitting one is a keeper.
  let v = await take('03-play-cut');
  if (v.keeper) fail('the opening set-up should not be a keeper');
  await phase('block');
  await setLamp((await omt('o.target')).lampZ);
  await wait(500);
  await shot('04-play-fits');
  v = await take('05-play-keeper');
  if (!v.keeper) fail(`beat play: expected a keeper, match ${v.match}`);
  await pressQuestion('05b-question-right', true);

  // Beat 2, lamp off while blocking.
  await page.waitForFunction(() => window.__omt.beat === 'dark' && window.__omt.phase === 'block', null, { timeout: 20000 * SLOW });

  // Close and reopen the game: it must offer to continue from this beat, with the take count intact.
  const before = await omt('o.takeNo');
  await page.reload();
  await page.waitForFunction(() => window.__omt, null, { timeout: 20000 * SLOW });
  await wait(800);
  await shot('05c-resume-card');
  if (!(await page.$('#over'))) fail('after a reload mid-scene the intro should offer Start over next to Continue');
  await page.click('#go');
  await phase('block');
  if ((await omt('o.beat')) !== 'dark') fail(`resume should land on the dark beat, got ${await omt('o.beat')}`);
  if ((await omt('o.takeNo')) !== before) fail('resume lost the take count');
  await wait(1200);
  await shot('06-dark-block');
  await setLamp(80);
  v = await take('07-dark-cut');
  if (v.keeper) fail('lamp at 80 should be too small for the dark beat');
  await phase('block');
  await wait(900);
  await shot('08-dark-trace');
  await setLamp((await omt('o.target')).lampZ);
  v = await take('09-dark-keeper');
  if (!v.keeper) fail(`beat dark: expected a keeper, match ${v.match}`);
  await pressQuestion('09b-question-wrong', false);
  await phase('cameo');
  await wait(1500);
  await shot('10-cat-cameo');

  // Beat 3: two things to set, and a cat to keep in the light.
  await page.waitForFunction(() => window.__omt.beat === 'cat' && window.__omt.phase === 'block', null, { timeout: 20000 * SLOW });
  await wait(1000);
  await shot('11-cat-block');
  const target = await omt('o.target');
  await setLamp(target.lampZ);
  await setMark(target.markX);
  v = await take('12-cat-keeper');
  if (!v.keeper) fail(`beat cat: expected a keeper, match ${v.match}, catDark ${v.catDark}`);
  await pressQuestion('12b-question', true);
  // Then the structured question: fill every blank, one of them wrongly, and hand in.
  await page.waitForSelector('#hand', { timeout: 5000 * SLOW });
  await shot('12c-interview');
  if (!(await page.isDisabled('#hand'))) fail('Hand in should be disabled until every blank is filled');
  const key = await omt('o.openKey');
  for (let b = 0; b < key.length; b++) await page.click(`.blank[data-b="${b}"] button[data-o="${b === 0 ? (key[b] + 1) % 3 : key[b]}"]`);
  await page.click('#hand');
  await wait(300);
  await shot('12d-interview-marked');
  const mark = await page.textContent('#mark');
  if (!mark.startsWith(`${key.length - 1} / ${key.length}`)) fail(`one wrong blank should score ${key.length - 1} / ${key.length}, got "${mark}"`);
  await page.click('#go');
  await phase('wrap');
  await wait(600);
  await shot('13-wrap');
  await page.click('#btn-lang');
  await wait(300);
  await shot('14-wrap-zh');

  // A finished scene starts fresh next time, keeps its keepers, and remembers the language.
  const sv = await omt('o.saved');
  if (sv.completed !== 1 || sv.beat !== 0 || sv.takeNo !== 0) fail(`after the wrap the save should be reset and counted once: ${JSON.stringify(sv)}`);
  if (sv.keepers.length !== 3) fail(`expected 3 saved keepers, got ${sv.keepers.length}`);
  await page.reload();
  await page.waitForFunction(() => window.__omt, null, { timeout: 20000 * SLOW });
  await wait(600);
  if (await page.$('#over')) fail('a finished scene should not offer to continue');
  if ((await page.textContent('#btn-lang')) !== 'English') fail('the language choice was not remembered');
  await shot('15-fresh-after-wrap');

  const kinds = await page.evaluate(() => JSON.parse(localStorage.getItem('omt.evidence.v2') || '[]').map(e => `${e.shot}:${e.kind}`));
  for (const k of ['play:take', 'dark:take', 'cat:take', 'play:got-shot', 'dark:got-shot', 'cat:got-shot', 'play:quiz', 'dark:quiz', 'cat:quiz']) if (!kinds.includes(k)) fail(`no "${k}" evidence was logged`);
  if (errors.length) fail(`page errors:\n${errors.join('\n')}`);
  console.log(`smoke ok: 3 beats, ${sv.keepers.length} keepers saved, resume and fresh start checked`);
} catch (e) {
  await shot('zz-failure').catch(() => {});
  console.error(String(e.message || e));
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
