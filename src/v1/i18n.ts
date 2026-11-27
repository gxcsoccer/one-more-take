/**
 * All player-facing words. English is the primary language (it is the language
 * of the Singapore science classroom); Chinese is a full alternative.
 * [[term]] marks a science word the child can tap for the other language.
 */
export type Lang = 'en' | 'zh';

export const terms: Record<string, { en: string; zh: string; defEn: string; defZh: string }> = {
  'light source': { en: 'light source', zh: '光源', defEn: 'Something that gives out its own light, like this lamp.', defZh: '自己会发光的东西，比如这盏灯。' },
  shadow: { en: 'shadow', zh: '影子', defEn: 'The dark shape made when an object blocks light.', defZh: '物体挡住光时出现的暗影。' },
  storyboard: { en: 'storyboard', zh: '分镜', defEn: 'A sketch of the shot you plan, made before filming.', defZh: '开拍前画下的镜头计划。' },
  'fair test': { en: 'fair test', zh: '公平测试', defEn: 'Change only one thing. Keep everything else the same.', defZh: '只改变一样东西，其他都保持不变。' },
  distance: { en: 'distance', zh: '距离', defEn: 'How far apart two things are.', defZh: '两样东西之间有多远。' },
};

type Dict = Record<string, string>;

const en: Dict = {
  title: 'One More Take!',
  scene: 'Scene 02 · Three Storeys, One Cat',
  shotA: 'Shot A · Giant Duck',
  shotB: 'Shot B · Save the Cat',
  free: 'Free shoot',
  'intro.h': 'Three Storeys, One Cat',
  'intro.p': 'Our star is a wind-up duck the size of your hand. The script says GIANT MONSTER. You are the director. Use the [[light source]] to make its [[shadow]] three storeys tall.',
  'intro.go': 'Let’s shoot',
  'a.predict': '[[storyboard]] first. The lamp will roll to the ghost lamp. Drag the chalk line to where the top of the [[shadow]] will reach.',
  'b.predict': '[[storyboard]] first. The duck will step 3 cm left, to the ghost duck. Drag the chalk line to where the beak’s [[shadow]] will land.',
  lock: 'Lock my storyboard',
  'a.do': 'Roll the lamp along its track. Darken all 3 marked windows.',
  'a.ready': 'All three windows are dark. Shout ACTION!',
  'b.do': 'Keep 3 windows dark and the cat in the light. Make the beak’s shadow tickle its paw.',
  'b.sulk': 'The cat is in the dark, and sulking. Get the shadow off it.',
  'b.windows': 'The cat is swiping! Now check the 3 marked windows.',
  'b.cat': 'Windows done. Bring the beak’s shadow next to the cat.',
  'b.ready': 'That’s the shot. Shout ACTION!',
  'locked.lamp': 'The lamp is clamped for this step.',
  'locked.duck': 'The duck is clamped for this shot.',
  rolling: 'Camera rolling. You can still move things. Tap CUT to end the take.',
  screening: 'Screening take {n}',
  keeper: 'Take {n} is a keeper!',
  blooper: 'Take {n} goes in the blooper reel. Change one thing and go again.',
  'pa.result': 'Storyboard: {p} cm. Real shadow: {a} cm.',
  'pb.result': 'The duck moved 3 cm. Its shadow moved {a} cm.',
  'p.close': 'Great eye!',
  'pa.far': 'Surprised? Watch how fast it grows when the lamp is close.',
  'pb.far': 'The shadow travels further than the duck does.',
  mine: 'My storyboard: {p} cm',
  real: 'Real: {a} cm',
  mineB: 'My storyboard',
  realB: 'Real',
  action: 'ACTION!',
  cut: 'CUT',
  replay: 'Replay',
  compare: 'Compare takes',
  rays: 'Light rays',
  next: 'Next shot',
  notebook: 'Director’s notebook',
  'col.take': 'Take',
  'col.gap': 'Lamp to duck',
  'col.top': 'Shadow height',
  empty: 'Your takes will be listed here.',
  cutout: 'Cutout',
  side: 'Side',
  front: 'Front',
  draw: 'Draw',
  'draw.h': 'Draw your own cutout',
  'draw.p': 'Whatever you draw will block the light. Gaps let light through.',
  'draw.small': 'Draw something bigger first.',
  use: 'Use it',
  clear: 'Clear',
  close: 'Close',
  'cmp.h': 'Compare two takes',
  'cmp.pick': 'Tap two takes.',
  'cmp.fair': 'Only the {v} changed. That is a [[fair test]]: the difference in the shadow came from it.',
  'cmp.unfair': '{n} things changed. It is hard to tell which one made the difference. Try changing just one.',
  'cmp.same': 'Nothing changed between these two takes.',
  'v.lamp': 'lamp distance',
  'v.duck': 'duck position',
  'v.cutout': 'cutout shape',
  'b.h': 'Director! We have a problem.',
  'b.p': 'A cat has moved in. It is the duck’s only fan. With your last set-up it sits in the dark. New shot: 3 windows dark, the cat in the light, and the beak’s shadow close enough to tickle its paw.',
  'b.go': 'Fix the shot',
  'wrap.h': 'That’s a wrap!',
  'wrap.p': 'You made a hand-sized duck three storeys tall, and kept its only fan.',
  'wrap.go': 'Keep shooting',
  's.shot': 'Got the shot',
  's.board': 'Storyboard artist',
  's.fair': 'Fair test',
  sound: 'Sound',
  cm: 'cm',
};

const zh: Dict = {
  title: '再拍一条！',
  scene: '第 02 场 · 三层楼，一只猫',
  shotA: '镜头 A · 巨鸭',
  shotB: '镜头 B · 保住猫',
  free: '自由拍摄',
  'intro.h': '三层楼，一只猫',
  'intro.p': '主演是一只巴掌大的发条鸭，剧本却写着“巨型怪兽”。你是导演。用[[light source]]把它的[[shadow]]变成三层楼高。',
  'intro.go': '开工',
  'a.predict': '先画[[storyboard]]。灯会推到虚影的位置。把粉笔线拖到你认为[[shadow]]顶端会到的地方。',
  'b.predict': '先画[[storyboard]]。鸭子会向左走 3 厘米，到虚影的位置。把粉笔线拖到鸭嘴[[shadow]]会落下的地方。',
  lock: '定下分镜',
  'a.do': '沿着轨道推灯，让 3 扇标记的窗都变暗。',
  'a.ready': '三扇窗都暗了。喊“开拍”！',
  'b.do': '3 扇窗保持暗，猫留在亮处，让鸭嘴的影子挠到它的爪子。',
  'b.sulk': '猫被影子盖住了，正在生闷气。把影子从它身上挪开。',
  'b.windows': '猫伸爪了！再看看 3 扇标记的窗。',
  'b.cat': '窗户搞定了。把鸭嘴的影子挪到猫旁边。',
  'b.ready': '就是这个镜头。喊“开拍”！',
  'locked.lamp': '这一步灯被固定住了。',
  'locked.duck': '这个镜头鸭子被固定住了。',
  rolling: '摄影机在转，你还可以移动道具。点“停”结束这一条。',
  screening: '放映第 {n} 条',
  keeper: '第 {n} 条过了！',
  blooper: '第 {n} 条收进花絮。只改一样，再拍一条。',
  'pa.result': '分镜：{p} 厘米。实际影子：{a} 厘米。',
  'pb.result': '鸭子走了 3 厘米，影子走了 {a} 厘米。',
  'p.close': '眼力真准！',
  'pa.far': '没想到吧？灯离得越近，影子长得越快。',
  'pb.far': '影子走得比鸭子远。',
  mine: '我的分镜：{p} 厘米',
  real: '实际：{a} 厘米',
  mineB: '我的分镜',
  realB: '实际',
  action: '开拍！',
  cut: '停',
  replay: '回放',
  compare: '对比两条',
  rays: '光线',
  next: '下一个镜头',
  notebook: '导演笔记',
  'col.take': '条',
  'col.gap': '灯到鸭',
  'col.top': '影子高度',
  empty: '拍过的每一条会记在这里。',
  cutout: '剪影',
  side: '侧面',
  front: '正面',
  draw: '自己画',
  'draw.h': '画一个你自己的剪影',
  'draw.p': '你画的地方会挡住光，留空的地方光会穿过去。',
  'draw.small': '先画大一点。',
  use: '就用它',
  clear: '清空',
  close: '关闭',
  'cmp.h': '对比两条',
  'cmp.pick': '点选两条。',
  'cmp.fair': '只有{v}变了。这是一次[[fair test]]：影子的差别就是它造成的。',
  'cmp.unfair': '有 {n} 样东西变了，很难说是哪一样造成的差别。试试只改一样。',
  'cmp.same': '这两条之间什么都没变。',
  'v.lamp': '灯的距离',
  'v.duck': '鸭子的位置',
  'v.cutout': '剪影的形状',
  'b.h': '导演！出状况了。',
  'b.p': '搬来了一只猫，它是鸭子唯一的粉丝。按你刚才的布景，它正坐在黑暗里。新镜头：3 扇窗要暗，猫要在亮处，鸭嘴的影子要近到能挠它的爪子。',
  'b.go': '补救这个镜头',
  'wrap.h': '杀青！',
  'wrap.p': '你把一只巴掌大的鸭子拍成了三层楼高，还保住了它唯一的粉丝。',
  'wrap.go': '继续拍',
  's.shot': '拍到了',
  's.board': '分镜师',
  's.fair': '公平测试',
  sound: '声音',
  cm: '厘米',
};

const dicts: Record<Lang, Dict> = { en, zh };
export let lang: Lang = 'en';

export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  let s = dicts[lang][key] ?? en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Like t(), but returns HTML with tappable science terms. */
export function rich(key: string, vars: Record<string, string | number> = {}): string {
  return esc(t(key, vars)).replace(/\[\[(.+?)\]\]/g, (_, id: string) => {
    const term = terms[id];
    return term ? `<button class="term" data-term="${esc(id)}">${esc(term[lang])}</button>` : esc(id);
  });
}
