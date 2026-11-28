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
  await page.goto(`${server.resolvedUrls.local[0]}?scene=02`);
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
  await lame.goto(`${server.resolvedUrls.local[0]}?scene=02`, { waitUntil: 'commit' });
  await lame.waitForFunction(() => window.__omt && window.__omt.art.ready, null, { timeout: 30000 * SLOW });
  const some = await lame.evaluate(() => window.__omt.art.loaded.sort());
  await lame.close();
  const missing = all.filter(n => !some.includes(n));
  if (missing.join() !== 'floor') fail(`with only floor.png missing, these failed to load: ${missing.join(', ') || '(nothing, not even floor)'}`);

  // ---------- Scene 01, reached the way a child reaches it: from the list of scenes ----------
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForSelector('.slate-card');
  await wait(300);
  await shot('20-lot');
  const cards = await page.$$eval('.slate-card', els => els.map(e => e.textContent));
  if (cards.length !== 3 || !/✓/.test(cards[1])) fail(`the list of scenes should show two scenes and the two-player try-out, the second scene wrapped: ${JSON.stringify(cards)}`);
  await page.click('.slate-card[data-scene="01"]');
  await page.waitForFunction(() => window.__omt?.scene === '01' && window.__omt.art.ready, null, { timeout: 30000 * SLOW });
  await wait(600);
  await shot('21-s01-intro');
  await page.click('#go');
  await phase('block');
  await wait(1200);
  await shot('22-s01-spot');
  const tap = async p => { await page.mouse.click(p.x, p.y); await wait(200); };
  const tapProp = async id => tap((await omt('o.handles')).props[id]);
  const setMarks = async ids => { for (const id of await omt('o.candidates')) if ((await omt('o.marked')).includes(id) !== ids.includes(id)) await tapProp(id); };
  const shoot = async name => {
    const n = await omt('o.takeNo');
    await tap((await omt('o.handles')).clapper);
    await page.waitForFunction(k => window.__omt.takeNo === k + 1 && window.__omt.blackout === 1, n, { timeout: 15000 * SLOW });
    await wait(1300);
    await shot(`${name}-dark`);
    await page.waitForFunction(() => document.getElementById('burst').hidden === false, null, { timeout: 15000 * SLOW });
    await wait(500);
    await shot(name);
    return omt('o.verdict');
  };
  const answer = async () => { await phase('quiz'); await wait(400); await page.click(`.opts button[data-i="${await omt('o.quizAnswer')}"]`); await wait(300); await page.click('#go'); };
  // Everything on the bench, the switch and the clapperboard must be on screen.
  for (const [name, p] of Object.entries({ ...(await omt('o.handles')).props, switch: (await omt('o.handles')).switch, clapper: (await omt('o.handles')).clapper })) {
    const { width, height } = page.viewportSize();
    if (p.x < 20 || p.x > width - 20 || p.y < 60 || p.y > height - 20) fail(`scene 01: "${name}" is off screen at ${Math.round(p.x)},${Math.round(p.y)}`);
  }
  // Nothing ticked: the clapperboard does nothing.
  await tap((await omt('o.handles')).clapper);
  if ((await omt('o.phase')) !== 'block' || (await omt('o.takeNo')) !== 0) fail('scene 01: a take started with nothing ticked');
  // The switch puts the studio in the dark, and it comes back by itself.
  await tap((await omt('o.handles')).switch);
  if ((await omt('o.blackout')) !== 1) fail('scene 01: the switch did not black out the studio');
  await wait(900);
  await shot('23-s01-switch');
  await page.waitForFunction(() => window.__omt.blackout === 0, null, { timeout: 8000 * SLOW });
  // A wrong set of ticks is a CUT that says what was wrong.
  await setMarks(['exit', 'moon']);
  let w = await shoot('24-s01-spot-cut');
  if (w.keeper || w.wrong.join() !== 'moon' || w.missed.join() !== 'lantern') fail(`scene 01: ticking the EXIT sign and the moon should be cut for the moon and the lantern: ${JSON.stringify(w)}`);
  await phase('block');
  await wait(600);
  await setMarks(await omt('o.sources'));
  w = await shoot('25-s01-spot-keeper');
  if (!w.keeper) fail(`scene 01 spot: expected a keeper: ${JSON.stringify(w)}`);
  await answer();
  // Beat 2: the switch is taped over, so the ticks are a prediction.
  await page.waitForFunction(() => window.__omt.beat === 'guess' && window.__omt.phase === 'block', null, { timeout: 20000 * SLOW });
  await wait(1000);
  await shot('26-s01-guess');
  await tap((await omt('o.handles')).switch);
  if ((await omt('o.blackout')) !== 0) fail('scene 01: the taped-over switch still worked');
  // Shiny and white things are not sources, and neither is the duck.
  await setMarks(['torch', 'ball', 'sheet', 'duck']);
  w = await shoot('27-s01-guess-cut');
  if (w.keeper || w.wrong.sort().join() !== 'ball,duck,sheet') fail(`scene 01 guess: the mirror ball, the sheet and the duck should be marked wrong: ${JSON.stringify(w)}`);
  await phase('block');
  await wait(600);
  await setMarks(await omt('o.sources'));
  w = await shoot('28-s01-guess-keeper');
  if (!w.keeper) fail(`scene 01 guess: expected a keeper: ${JSON.stringify(w)}`);
  await phase('quiz');
  await wait(400);
  await page.click(`.opts button[data-i="${await omt('o.quizAnswer')}"]`);
  await wait(300);
  // Reload after answering: the game must come back at the third beat, not ask again.
  await page.reload();
  await page.waitForFunction(() => window.__omt?.scene === '01', null, { timeout: 20000 * SLOW });
  await wait(600);
  if (!(await page.$('#over'))) fail('scene 01: a reload mid-scene should offer Continue and Start over');
  await page.click('#go');
  await page.waitForFunction(() => window.__omt.beat === 'star' && window.__omt.phase === 'block', null, { timeout: 20000 * SLOW });
  await wait(1000);
  await shot('29-s01-star');
  // Beat 3: a mirror beside the duck lights nothing.
  await tapProp('mirror');
  await wait(500);
  if ((await omt('o.placed')) !== 'mirror') fail('scene 01: tapping the mirror should stand it beside the duck');
  w = await shoot('30-s01-star-cut');
  if (w.keeper) fail('scene 01 star: a mirror beside the duck should not light it');
  await phase('block');
  await wait(600);
  // Drag the candle to the stand with a finger.
  for (let i = 0; i < 4 && (await omt('o.placed')) !== 'candle'; i++) await drag((await omt('o.handles')).props.candle, (await omt('o.handles')).stand);
  await wait(500);
  if ((await omt('o.placed')) !== 'candle') fail(`scene 01: dragging the candle to the stand left "${await omt('o.placed')}" there`);
  w = await shoot('31-s01-star-keeper');
  if (!w.keeper) fail(`scene 01 star: the candle beside the duck should be a keeper: ${JSON.stringify(w)}`);
  await answer();
  await page.waitForSelector('#hand', { timeout: 10000 * SLOW });
  const key01 = await omt('o.openKey');
  for (let b = 0; b < key01.length; b++) await page.click(`.blank[data-b="${b}"] button[data-o="${key01[b]}"]`);
  await page.click('#hand');
  await wait(300);
  await shot('32-s01-interview');
  if (!(await page.textContent('#mark')).startsWith(`${key01.length} / ${key01.length}`)) fail('scene 01: a fully right interview should score full marks');
  await page.click('#go');
  await phase('wrap');
  await wait(500);
  await shot('33-s01-wrap');
  const sv01 = await omt('o.saved');
  if (sv01.completed !== 1 || sv01.keepers.length !== 3) fail(`scene 01: after the wrap the save should count it once with three keepers: ${JSON.stringify(sv01)}`);
  // Scene 02's record must have survived Scene 01 saving its own.
  const both = await page.evaluate(() => JSON.parse(localStorage.getItem('omt.save.v1')).scenes);
  if (both['02']?.completed !== 1 || both['02'].keepers.length !== 3) fail(`scene 02's record was lost while playing scene 01: ${JSON.stringify(both['02'])}`);

  // ---------- Shadow Monster: the two-player try-out ----------
  await page.goto(server.resolvedUrls.local[0]);
  await page.click('.slate-card[data-scene="duo"]');
  await page.waitForFunction(() => window.__omt?.wave && window.__omt.art.ready, null, { timeout: 30000 * SLOW });
  await page.click('#go');
  await phase('live');
  // Scared, and the cheer over: the next neighbour is at their window.
  const scaredIs = n => page.waitForFunction(k => window.__omt.stats.scared === k && window.__omt.phase === 'live', n, { timeout: 20000 * SLOW });
  // Lamp first, then the duck: the take is only good once both are right.
  // Drag like a person would: aim, look, correct.
  const put = async (what, v) => {
    for (let i = 0; i < 4; i++) {
      await drag((await omt('o.handles'))[what], await omt(what === 'lamp' ? `o.lampAt(${v})` : `o.duckAt(${v})`));
      await wait(250 * SLOW);
      if (Math.abs((await omt(what === 'lamp' ? 'o.pair.lampZ' : 'o.pair.duckX')) - v) < 0.4) return;
    }
    fail(`try-out: could not drag the ${what} to ${v}: ${JSON.stringify(await omt('o.pair'))}`);
  };
  const aim = async to => { await put('lamp', to.lampZ); await put('duck', to.duckX); };
  for (let n = 1; n <= 4; n++) {
    const home = await omt('o.targetHome');
    if (Math.abs(home.spot.x - home.window.x) > 0.01 || Math.abs(home.spot.y - home.window.y) > 0.01) fail(`try-out: the neighbour to scare is not in the glowing window: ${JSON.stringify(home)}`);
    const to = await omt('o.answer');
    await put('lamp', to.lampZ);
    await wait(700 * SLOW);
    if (n === 4 && (await omt('o.stats.scared')) !== 3) fail('try-out: the lamp alone should not scare the top-floor neighbour');
    await put('duck', to.duckX);
    await page.waitForFunction(k => window.__omt.stats.scared === k, n, { timeout: 20000 * SLOW });
    if (n === 3) await shot('40-duo-scared');
    await scaredIs(n);
  }
  await page.waitForFunction(() => window.__omt.wave === 'hush' && window.__omt.phase === 'live', null, { timeout: 20000 * SLOW });
  await aim(await omt('o.wakeSpot'));
  await page.waitForFunction(() => window.__omt.stats.woke >= 1, null, { timeout: 20000 * SLOW });
  await shot('41-duo-woke');
  if ((await omt('o.stats.scared')) !== 4) fail('try-out: waking a sleeper must not count as a scare');
  await aim(await omt('o.answer'));
  await scaredIs(5);

  const kinds = await page.evaluate(() => JSON.parse(localStorage.getItem('omt.evidence.v2') || '[]').map(e => `${e.shot}:${e.kind}`));
  for (const k of ['play:take', 'dark:take', 'cat:take', 'play:got-shot', 'dark:got-shot', 'cat:got-shot', 'play:quiz', 'dark:quiz', 'cat:quiz', 'spot:take', 'guess:take', 'star:take', 'spot:got-shot', 'guess:got-shot', 'star:got-shot', 'spot:quiz', 'guess:quiz', 'star:quiz', 'duo-big:take', 'duo-big:got-shot', 'duo-hush:take']) if (!kinds.includes(k)) fail(`no "${k}" evidence was logged`);
  if (errors.length) fail(`page errors:\n${errors.join('\n')}`);
  console.log(`smoke ok: scene 02 (3 beats, ${sv.keepers.length} keepers, resume and fresh start) and scene 01 (3 beats, ${sv01.keepers.length} keepers, resume) played from the list of scenes; two-player try-out: first wave, a woken sleeper`);
} catch (e) {
  await shot('zz-failure').catch(() => {});
  console.error(String(e.message || e));
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
