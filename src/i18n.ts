/**
 * All player-facing words. English is primary (the language of the Singapore
 * science classroom); Chinese is a full alternative. [[term]] marks a science
 * word the child can tap to see and hear it in the other language.
 */
export type Lang = 'en' | 'zh';

export const terms: Record<string, { en: string; zh: string; defEn: string; defZh: string }> = {
  'light source': { en: 'light source', zh: '光源', defEn: 'Something that gives out its own light, like this lamp.', defZh: '自己会发光的东西，比如这盏灯。' },
  shadow: { en: 'shadow', zh: '影子', defEn: 'The dark shape made when an object blocks light.', defZh: '物体挡住光时出现的暗影。' },
  reflect: { en: 'reflect', zh: '反射', defEn: 'To bounce light off. We see a thing when it reflects light into our eyes.', defZh: '把光弹回去。物体把光反射进我们的眼睛，我们才看得见它。' },
  distance: { en: 'distance', zh: '距离', defEn: 'How far apart two things are.', defZh: '两样东西之间有多远。' },
};

type Dict = Record<string, string>;

const en: Dict = {
  title: 'One More Take!',
  scene: 'Scene 02 · Three Storeys, One Cat',
  'intro.h': 'Three Storeys, One Cat',
  'intro.p': 'Our star is a wind-up duck the size of your hand. The script says GIANT MONSTER. Use the [[light source]] to make its [[shadow]] fill the chalk outline.',
  go: 'Let’s shoot',
  resume: 'Continue · take {n}',
  restart: 'Start over',
  'play.block': 'Drag the lamp along its track. Fill the chalk outline with the duck’s [[shadow]].',
  'play.ready': 'That fits! Tap the clapperboard.',
  'dark.block': 'Lights out! The outline is bigger now. Put the lamp where you think it must go, then tap the clapperboard.',
  'cat.block': 'New outline, and the [[shadow]] must not touch the cat. Move the lamp, and the orange flag that marks where the duck stops. Then tap the clapperboard.',
  'cat.again': 'The [[shadow]] touched the cat. Move the lamp or the orange flag so the [[shadow]] misses it.',
  'cat.cameo': 'Uh-oh. The duck’s only fan hates the dark.',
  again: 'Blue chalk: where the [[shadow]] fell. White chalk: where it should be.',
  cut: 'CUT!',
  keeper: 'KEEPER!',
  'cut.sub': 'Match {p}% · one more take!',
  'cut.cat': 'The shadow touched the cat · one more take!',
  'keeper.sub': 'Take {n} · match {p}%',
  'wrap.h': 'That’s a wrap!',
  'wrap.p': 'You turned a hand-sized duck into a three-storey monster, and kept its only fan happy.',
  'wrap.play': 'Lights on',
  'wrap.dark': 'Lights out',
  'wrap.cat': 'Save the cat',
  take1: '1 take',
  takes: '{n} takes',
  replay: 'Play again',
  sound: 'Sound',
  press: 'Press question · 2 marks',
  right: 'Correct!',
  wrong: 'Not quite.',
  next: 'Back to the set',
  interview: 'Feature interview · {n} marks',
  hand: 'Hand in',
  marks: '{m} / {n} marks',
  model: 'Full-mark answer',
  'score.open': 'Interview: {m} / {n} marks',
  score: 'Press questions: {r} of {n} correct',
  'lot.h': 'Pick a scene',
  'lot.done': 'Wrapped ✓',
  'lot.going': 'Take {n}',
  'lot.new': 'Not shot yet',
  's01.scene': 'Scene 01 · Lights Out',
  's01.name': 'Lights Out',
  's02.name': 'Three Storeys, One Cat',
  's01.intro.p': 'Tonight we shoot in the dark. First the director must know: when every lamp is off, what can the camera still see? Find each [[light source]].',
  's01.spot.block': 'Tap the big switch to see the studio in the dark. Tap every [[light source]] to tick it, then tap the clapperboard.',
  's01.guess.block': 'New props, and the switch is taped over. Which ones will the camera still see in the dark? Tick them, then tap the clapperboard.',
  's01.star.block': 'The duck gives out no light, but it must be seen in the dark. Drag one prop to the stand beside it, then tap the clapperboard.',
  's01.again.mark': 'Green tick: it gives out its own light. Blue cross: it does not. Yellow ring: you missed one.',
  's01.again.place': 'No light reached the duck, so there was none for it to [[reflect]]. Which prop gives out its own light?',
  's01.cut.mark': '{r} of {n} found · {w} ticked by mistake · one more take!',
  's01.cut.place': 'The duck stayed dark · one more take!',
  's01.keeper.mark': 'Take {n} · every light source found',
  's01.keeper.place': 'Take {n} · the duck reflects the candle’s light',
  's01.wrap.p': 'You found what gives out its own light, and used it to make the star seen in the dark.',
  'wrap.spot': 'Lights on and off',
  'wrap.guess': 'Predict the dark',
  'wrap.star': 'Light the star',
  'prop.exit': 'EXIT sign', 'prop.lantern': 'lantern', 'prop.moon': 'paper moon', 'prop.mirror': 'mirror', 'prop.torch': 'torch, on', 'prop.tablet': 'tablet, on',
  'prop.candle': 'candle', 'prop.trophy': 'gold trophy', 'prop.ball': 'mirror ball', 'prop.sheet': 'white sheet',
  lot: 'All scenes',
};

const zh: Dict = {
  title: '再拍一条！',
  scene: '第 02 场 · 三层楼，一只猫',
  'intro.h': '三层楼，一只猫',
  'intro.p': '主演是一只巴掌大的发条鸭，剧本却写着“巨型怪兽”。用[[light source]]让它的[[shadow]]填满墙上的粉笔轮廓。',
  go: '开工',
  resume: '继续拍 · 第 {n} 条',
  restart: '从头开始',
  'play.block': '沿着轨道拖动灯，让鸭子的[[shadow]]填满粉笔轮廓。',
  'play.ready': '对上了！点一下场记板。',
  'dark.block': '关灯了！这次的轮廓更大。把灯放到你认为对的位置，再点场记板。',
  'cat.block': '新的轮廓，而且[[shadow]]不能碰到猫。移动灯，还有那面橙色小旗（鸭子停下的位置），再点场记板。',
  'cat.again': '[[shadow]]碰到猫了。移动灯或橙色小旗，让[[shadow]]避开它。',
  'cat.cameo': '糟了。鸭子唯一的粉丝怕黑。',
  again: '蓝色粉笔：[[shadow]]刚才落下的位置。白色粉笔：它应该在的位置。',
  cut: '停！',
  keeper: '过了！',
  'cut.sub': '吻合 {p}% · 再拍一条！',
  'cut.cat': '影子碰到猫了 · 再拍一条！',
  'keeper.sub': '第 {n} 条 · 吻合 {p}%',
  'wrap.h': '杀青！',
  'wrap.p': '你把一只巴掌大的鸭子拍成了三层楼高的怪兽，还哄好了它唯一的粉丝。',
  'wrap.play': '开灯排练',
  'wrap.dark': '关灯预测',
  'wrap.cat': '保住猫',
  take1: '1 条',
  takes: '{n} 条',
  replay: '再玩一次',
  sound: '声音',
  press: '记者提问 · 2 分',
  right: '答对了！',
  wrong: '还差一点。',
  next: '回到片场',
  interview: '专访 · {n} 分',
  hand: '交卷',
  marks: '{m} / {n} 分',
  model: '满分答案',
  'score.open': '专访：{m} / {n} 分',
  score: '记者提问：答对 {r} / {n}',
  'lot.h': '选一场戏',
  'lot.done': '已杀青 ✓',
  'lot.going': '拍到第 {n} 条',
  'lot.new': '还没拍',
  's01.scene': '第 01 场 · 关灯',
  's01.name': '关灯',
  's02.name': '三层楼，一只猫',
  's01.intro.p': '今晚要摸黑拍戏。导演得先弄清楚：所有的灯都关掉以后，摄影机还能拍到什么？把每一个[[light source]]找出来。',
  's01.spot.block': '点一下大开关，看看关灯后的片场。点每一个[[light source]]给它打勾，再点场记板。',
  's01.guess.block': '换了一批道具，开关也被胶带封住了。关灯以后摄影机还能拍到哪些？给它们打勾，再点场记板。',
  's01.star.block': '鸭子自己不发光，可是关灯后也得拍到它。拖一件道具到它旁边的架子上，再点场记板。',
  's01.again.mark': '绿勾：它自己发光。蓝叉：它不发光。黄圈：漏掉了一个。',
  's01.again.place': '没有光照到鸭子，它就没有光可以[[reflect]]。哪件道具自己会发光？',
  's01.cut.mark': '找到 {r} / {n} · 错勾 {w} 个 · 再拍一条！',
  's01.cut.place': '鸭子还是黑的 · 再拍一条！',
  's01.keeper.mark': '第 {n} 条 · 光源全部找到',
  's01.keeper.place': '第 {n} 条 · 鸭子反射了蜡烛的光',
  's01.wrap.p': '你找出了自己发光的东西，还用它让主角在黑暗里被看见。',
  'wrap.spot': '开灯关灯',
  'wrap.guess': '预测黑暗',
  'wrap.star': '照亮主角',
  'prop.exit': '出口灯', 'prop.lantern': '灯笼', 'prop.moon': '纸月亮', 'prop.mirror': '镜子', 'prop.torch': '手电筒（开着）', 'prop.tablet': '平板（开着）',
  'prop.candle': '蜡烛', 'prop.trophy': '金奖杯', 'prop.ball': '镜面球', 'prop.sheet': '白布',
  lot: '全部场次',
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
