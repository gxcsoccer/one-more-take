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
// Without a usable GPU (CI, and any machine that is not a Mac) the game is
// rendered in software and runs in slow motion: use 1x and allow far more time.
const SOFT = !!process.env.CI || process.platform !== 'darwin', SLOW = SOFT ? 8 : 1;
const gpu = SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--enable-gpu'];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [...gpu, '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: SOFT ? { width: 1024, height: 768 } : { width: 1180, height: 820 }, deviceScaleFactor: SOFT ? 1 : 2, hasTouch: true });
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

// Close and reopen the game, then take the Continue button.
const ratios = [];
async function reopen(name) {
  // A reload builds a new stage, so note how low this one went before it is gone.
  ratios.push(await omt('o.lowestPixelRatio'));
  await page.reload();
  await page.waitForFunction(() => window.__omt, null, { timeout: 20000 * SLOW });
  await wait(700);
  if (name) await shot(name);
  if (!(await page.$('#over'))) fail('after a reload mid-scene the intro should offer Start over next to Continue');
  await page.click('#go');
  await wait(400);
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

  // Whatever the window shape, the lamp and the clapperboard must be on screen and clear of the HUD,
  // and an idle player must be shown what to drag.
  const home = page.viewportSize();
  for (const [w, h] of [[1024, 768], [1180, 820], [1600, 900], [2000, 1100], [1366, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    // Read positions only once the game has refitted its camera to this size; a fixed pause is not
    // enough on a slow machine.
    await page.waitForFunction(size => window.__omt.fitted === size, `${w}x${h}`, { timeout: 15000 * SLOW });
    await wait(150);
    const hs = await omt('o.handles');
    const cap = await page.evaluate(() => document.getElementById('caption').getBoundingClientRect().toJSON());
    const top = await page.evaluate(() => document.getElementById('top-right').getBoundingClientRect().toJSON());
    for (const [name, p] of Object.entries({ lamp: hs.lamp, clapper: hs.clapper })) {
      if (p.x < 30 || p.x > w - 30 || p.y < top.bottom + 10 || p.y > cap.top - 20) fail(`${w}x${h}: the ${name} is off screen or under the HUD at (${Math.round(p.x)}, ${Math.round(p.y)}); caption starts at ${Math.round(cap.top)}`);
    }
    if (w === 2000) await shot('02b-wide-window');
  }
  await page.setViewportSize(home);
  await page.waitForFunction(size => window.__omt.fitted === size, `${home.width}x${home.height}`, { timeout: 15000 * SLOW });
  await page.waitForFunction(() => window.__omt.hint, null, { timeout: 8000 * SLOW });
  await shot('02c-hint');

  // Move the lamp before any take, then reload: even that much is offered back, with the lamp where it was put.
  await setLamp(90);
  await reopen();
  await phase('block');
  if ((await omt('o.beat')) !== 'play' || Math.abs((await omt('o.setup.lampZ')) - 90) > 1 || (await omt('o.takeNo')) !== 0) fail(`a moved lamp before the first take was not kept: lamp ${await omt('o.setup.lampZ')}`);
  await setLamp(118);

  // Beat 1, lamp lit: a set-up that does not fit is a CUT, the fitting one is a keeper.
  let v = await take('03-play-cut');
  if (v.keeper) fail('the opening set-up should not be a keeper');
  await phase('block');
  await setLamp((await omt('o.target')).lampZ);
  await wait(500);
  await shot('04-play-fits');
  v = await take('05-play-keeper');
  if (!v.keeper) fail(`beat play: expected a keeper, match ${v.match}`);

  // Reload while the press question is waiting: the keeper must not be re-shot or stored twice.
  await phase('quiz');
  let n = await omt('o.takeNo');
  await reopen('05a-resume-card');
  if ((await omt('o.phase')) !== 'quiz') fail(`reload before answering should come back to the question, got phase ${await omt('o.phase')}`);
  if ((await omt('o.takeNo')) !== n || (await omt('o.saved.keepers.length')) !== 1) fail('reload before answering repeated the take or the keeper');
  // Answer it, then reload before pressing on: the question must not be asked or counted again.
  await page.click(`.opts button[data-i="${await omt('o.quizAnswer')}"]`);
  await wait(300);
  await shot('05b-question-right');
  await reopen();
  await phase('block');
  if ((await omt('o.beat')) !== 'dark') fail(`reload after answering should go on to the dark beat, got ${await omt('o.beat')}`);
  let sv0 = await omt('o.saved');
  if (sv0.quiz.asked !== 1 || sv0.quiz.right !== 1 || sv0.keepers.length !== 1 || sv0.takeNo !== n) fail(`reload after answering changed the record: ${JSON.stringify(sv0)}`);

  // Beat 2, lamp off while blocking.
  await page.waitForFunction(() => window.__omt.beat === 'dark' && window.__omt.phase === 'block', null, { timeout: 20000 * SLOW });

  await wait(1200);
  await shot('06-dark-block');
  // With the lamp off the hand may only show that the lamp can be dragged. Sample it over a cycle:
  // it must travel to both sides of the lamp, not towards the answer.
  await page.waitForFunction(() => window.__omt.hint, null, { timeout: 8000 * SLOW });
  const lampX = (await omt('o.handles.lamp')).x, xs = [];
  for (let i = 0; i < 24; i++) { const r = await omt('o.hint'); if (r) xs.push(r.x + r.width / 2); await wait(110 * (SLOW > 1 ? 3 : 1)); }
  if (!(Math.min(...xs) < lampX - 8 && Math.max(...xs) > lampX + 8)) fail(`in the dark the hint should rock both ways around the lamp at x=${Math.round(lampX)}, saw ${Math.round(Math.min(...xs))}..${Math.round(Math.max(...xs))}`);
  await shot('06b-dark-hint');
  // Move the lamp in the dark, reload: it must still be where the child left it, not back at the far end.
  await setLamp(80);
  await reopen();
  await phase('block');
  if ((await omt('o.beat')) !== 'dark' || Math.abs((await omt('o.setup.lampZ')) - 80) > 1) fail(`the lamp position was not kept across a reload: beat ${await omt('o.beat')}, lamp ${await omt('o.setup.lampZ')}`);
  v = await take('07-dark-cut');
  if (v.keeper) fail('lamp at 80 should be too small for the dark beat');
  // After a blind miss the camera stays on the wall to show where the shadow fell.
  await phase('review');
  await wait(1400);
  await shot('07b-dark-review');
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
  // Answer the last press question, then reload: the game must come back to the closing question,
  // not to the cat beat.
  await phase('quiz');
  await wait(400);
  await page.click(`.opts button[data-i="${await omt('o.quizAnswer')}"]`);
  await wait(300);
  await shot('12b-question');
  await reopen();
  if ((await omt('o.phase')) !== 'quiz' || (await omt('o.saved.keepers.length')) !== 3) fail('reload before the closing question should return to it with all three keepers');
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
  ratios.push(await omt('o.lowestPixelRatio'));
  await page.reload();
  await page.waitForFunction(() => window.__omt, null, { timeout: 20000 * SLOW });
  await wait(600);
  if (await page.$('#over')) fail('a finished scene should not offer to continue');
  if ((await page.textContent('#btn-lang')) !== 'English') fail('the language choice was not remembered');
  await shot('15-fresh-after-wrap');

  // A machine with a real GPU must not have been dropped to a lower resolution.
  ratios.push(await omt('o.lowestPixelRatio'));
  if (!SOFT && Math.min(...ratios) !== 2) fail(`resolution was reduced on a fast machine: lowest ratios per page load were ${ratios.join(', ')}`);

  // One missing texture must cost only itself. Serve a 404 for the table top on a second page:
  // the sky, the residents, the blocks and the clapperboard must all still load.
  await page.waitForFunction(() => window.__omt?.art.ready, null, { timeout: 30000 * SLOW });
  const all = (await omt('o.art.loaded')).sort();
  // The spotlight model: its lens must sit exactly at the height of the simulated light source,
  // and it must be the size of a toy, not a prop that swallows the track.
  const lampModel = (await omt('o.models')).lamp;
  if (!lampModel) fail('the spotlight model did not load');
  // Checked by rendering this file from both ends: the lens is at the model's −x end, the dome at +x.
  if ((await omt('o.lampLens')) !== '-x') fail(`the lens end of the spotlight was taken to be ${await omt('o.lampLens')}; in lamp.glb it is -x`);
  if (Math.abs(lampModel.lensHeight - 4) > 0.05) fail(`spotlight lens is ${lampModel.lensHeight} cm above the table, must be 4`);
  // Its wheels must stand on the rails. Measured from the meshes as they stand in the scene:
  // each of the four wheels has part of itself over a rail, resting on the rail top.
  const onRails = c => c.length === 4 && c.every(w => w.over > 0 && Math.abs(w.gap) < 0.08);
  const contact = await omt('o.lampContact()');
  if (!onRails(contact)) fail(`spotlight wheels are not on the rails: ${JSON.stringify(contact)}`);
  // And the check must be able to fail: with the rails 1 cm further out, no wheel reaches them.
  if (onRails(await omt('o.lampContact(1)'))) fail('the wheel-on-rail check still passes with the rails moved 1 cm out');
  if (lampModel.height < 6 || lampModel.height > 10 || lampModel.depth > 13 || lampModel.width > 10) fail(`spotlight size is off: ${JSON.stringify(lampModel)}`);
  console.log(`spotlight model: ${JSON.stringify(Object.fromEntries(Object.entries(lampModel).map(([k, v]) => [k, +v.toFixed(2)])))}`);
  // The cat model: the keeper rule judges a head and a body (CAT in scene02.ts). Looking at the cat
  // from the front, nearly every point the rule samples must land on the model, close to its surface,
  // or the picture and the verdict part ways. It must also face the audience: found from its eyes.
  const catModel = (await omt('o.models')).cat;
  if (!catModel) fail('the cat model did not load');
  if (catModel.eyeVerts < 8) fail(`the cat's eyes were not found in its texture (${catModel.eyeVerts} yellow points on the head), so its facing is a guess`);
  if (catModel.covered < 0.92) fail(`only ${Math.round(catModel.covered * 100)}% of the judged cat lies on the cat model`);
  if (catModel.surfaceGap > 0.35) fail(`the judged cat surface is ${catModel.surfaceGap.toFixed(2)} cm from the model's on average`);
  if (catModel.height < 7 || catModel.height > 9.5 || catModel.width > 6 || catModel.depth > 5.4) fail(`cat size is off: ${JSON.stringify(catModel)}`);
  console.log(`cat model: ${JSON.stringify(Object.fromEntries(Object.entries(catModel).map(([k, v]) => [k, +v.toFixed(2)])))}`);
  for (const want of ['facade', 'floor', 'sky', 'resident-1-idle', 'resident-3-raised', 'block-a-front', 'block-b-side', 'clapper-board', 'model:lamp', 'model:cat']) if (!all.includes(want)) fail(`"${want}" did not load on a normal run; loaded: ${all.join(', ')}`);
  const lame = await browser.newPage({ viewport: page.viewportSize() });
  await lame.route('**/assets/floor.png', r => r.fulfill({ status: 404, body: '' }));
  // A second 3D page next to the first is slow under software rendering: allow for it, and do not
  // wait for the load event, only for the game to report that its art has finished loading.
  lame.setDefaultTimeout(30000 * SLOW);
  await lame.goto(server.resolvedUrls.local[0], { waitUntil: 'commit' });
  await lame.waitForFunction(() => window.__omt && window.__omt.art.ready, null, { timeout: 30000 * SLOW });
  const some = await lame.evaluate(() => window.__omt.art.loaded.sort());
  await lame.close();
  const missing = all.filter(n => !some.includes(n));
  if (missing.join() !== 'floor') fail(`with only floor.png missing, these failed to load: ${missing.join(', ') || '(nothing, not even floor)'}`);

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
