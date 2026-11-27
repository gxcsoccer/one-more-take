/**
 * "Press questions": exam-style items asked right after a keeper, about what
 * the child has just done on set.
 *
 * Format follows the Singapore Primary 4 paper: Booklet A items are
 * four-option multiple choice worth 2 marks each. Every item here is
 * original, written for this game against the MOE 2023 Primary Science
 * syllabus (Light, P4). None is copied from a school's paper.
 */
import { maskTop } from '../sim/light';
import { GRID, maskOf, scene02 as S } from './scene02';
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

export interface Question {
  id: string;
  /** Beat after which this item fits best. */
  beat: 'play' | 'dark' | 'cat';
  /** Curriculum rows it tests. */
  objectives: string[];
  ask: Text;
  /** First option is the correct one; they are shuffled when shown. */
  options: Text[];
  why: Text;
}

/** Shadow height for a lamp-to-duck distance, straight from the simulation. */
const top = (gap: number) => Math.round(maskTop(maskOf({ lampZ: S.duck.z + gap, markX: 0 }), GRID));
const h = { g50: top(50), g40: top(40), g30: top(30), g20: top(20) };

export const QUESTIONS: Question[] = [
  {
    id: 'L-size-lamp', beat: 'play', objectives: ['L04'],
    ask: { en: 'Which change will make the duck’s shadow on the wall bigger?', zh: '下面哪种做法会让鸭子在墙上的影子变大？' },
    options: [
      { en: 'Move the lamp closer to the duck.', zh: '把灯移近鸭子。' },
      { en: 'Move the lamp further from the duck.', zh: '把灯移远鸭子。' },
      { en: 'Use a brighter lamp in the same place.', zh: '在原位置换一盏更亮的灯。' },
      { en: 'Move the duck closer to the wall.', zh: '把鸭子移近墙壁。' },
    ],
    why: { en: 'When the light source is closer to the object, the object blocks more of the light, so the shadow is bigger.', zh: '光源离物体越近，物体挡住的光越多，影子就越大。' },
  },
  {
    id: 'L-table', beat: 'play', objectives: ['L04', 'I03'],
    ask: {
      en: `A director measured the shadow for three lamp positions.\nLamp to duck 50 cm → shadow ${h.g50} cm tall\nLamp to duck 40 cm → shadow ${h.g40} cm tall\nLamp to duck 30 cm → shadow ${h.g30} cm tall\nHow tall is the shadow most likely to be when the lamp is 20 cm from the duck?`,
      zh: `导演在三个灯位量了影子的高度。\n灯到鸭 50 厘米 → 影子高 ${h.g50} 厘米\n灯到鸭 40 厘米 → 影子高 ${h.g40} 厘米\n灯到鸭 30 厘米 → 影子高 ${h.g30} 厘米\n灯离鸭子 20 厘米时，影子最可能有多高？`,
    },
    options: [`${h.g20} cm`, `${h.g30} cm`, `${h.g40} cm`, `${h.g50} cm`].map(v => ({ en: v, zh: v.replace('cm', '厘米') })),
    why: { en: 'The table shows a pattern: the shorter the distance from lamp to duck, the taller the shadow. At 20 cm it must be taller than at 30 cm.', zh: '表格里有规律：灯到鸭子的距离越短，影子越高。20 厘米时一定比 30 厘米时更高。' },
  },
  {
    id: 'L-why-shadow', beat: 'play', objectives: ['L02'],
    ask: { en: 'Why does the duck make a shadow on the wall?', zh: '鸭子为什么会在墙上留下影子？' },
    options: [
      { en: 'Light travels in straight lines and cannot pass through the duck.', zh: '光沿直线传播，无法穿过鸭子。' },
      { en: 'Light bends around the duck.', zh: '光绕过了鸭子。' },
      { en: 'The duck gives out darkness.', zh: '鸭子发出了黑暗。' },
      { en: 'The wall takes in all the light.', zh: '墙把光都吸走了。' },
    ],
    why: { en: 'A shadow forms where light is blocked. Light travels in straight lines, so it cannot reach the wall behind the duck.', zh: '光被挡住的地方就形成影子。光沿直线传播，所以到不了鸭子背后的墙面。' },
  },
  {
    id: 'L-fair', beat: 'dark', objectives: ['I01', 'L04'],
    ask: { en: 'Mei wants to find out whether the distance between the lamp and the duck affects the size of the shadow. Which should she change?', zh: '小美想知道灯和鸭子之间的距离会不会影响影子的大小。她应该改变哪一项？' },
    options: [
      { en: 'Only the distance between the lamp and the duck.', zh: '只改变灯和鸭子之间的距离。' },
      { en: 'The lamp’s distance and the duck’s size.', zh: '同时改变灯的距离和鸭子的大小。' },
      { en: 'Only the distance between the duck and the wall.', zh: '只改变鸭子和墙之间的距离。' },
      { en: 'The lamp, the duck and the wall.', zh: '灯、鸭子和墙都改变。' },
    ],
    why: { en: 'In a fair test only one thing is changed. Everything else stays the same, so any change in the shadow comes from that one thing.', zh: '公平测试只改变一样东西，其余保持不变，这样影子的变化才能确定是它造成的。' },
  },
  {
    id: 'L-brighter', beat: 'dark', objectives: ['L04', 'L05'],
    ask: { en: 'The lamp is swapped for a brighter one in exactly the same place. What happens to the size of the duck’s shadow?', zh: '在完全相同的位置换上一盏更亮的灯。鸭子影子的大小会怎样？' },
    options: [
      { en: 'It stays the same.', zh: '保持不变。' },
      { en: 'It becomes bigger.', zh: '变大。' },
      { en: 'It becomes smaller.', zh: '变小。' },
      { en: 'It disappears.', zh: '消失。' },
    ],
    why: { en: 'The size of a shadow depends on where the light source, the object and the screen are, not on how bright the light is.', zh: '影子的大小取决于光源、物体和屏幕的位置，和光有多亮无关。' },
  },
  {
    id: 'L-object-screen', beat: 'dark', objectives: ['L04'],
    ask: { en: 'The lamp stays where it is. The duck is moved closer to the wall. What happens to its shadow?', zh: '灯不动，把鸭子移近墙壁。它的影子会怎样？' },
    options: [
      { en: 'It becomes smaller.', zh: '变小。' },
      { en: 'It becomes bigger.', zh: '变大。' },
      { en: 'It stays the same size.', zh: '大小不变。' },
      { en: 'It turns upside down.', zh: '上下颠倒。' },
    ],
    why: { en: 'Moving the object towards the screen also moves it away from the light source, so it blocks less light and the shadow is smaller.', zh: '物体靠近屏幕的同时也远离了光源，挡住的光变少，影子就变小。' },
  },
  {
    id: 'L-see', beat: 'cat', objectives: ['L01'],
    ask: { en: 'When the lamp is on, we can see the duck. Why?', zh: '灯亮着的时候，我们能看见鸭子。为什么？' },
    options: [
      { en: 'The duck reflects light from the lamp into our eyes.', zh: '鸭子把灯光反射进我们的眼睛。' },
      { en: 'The duck is a source of light.', zh: '鸭子是光源。' },
      { en: 'Our eyes send out light to the duck.', zh: '我们的眼睛向鸭子发出光。' },
      { en: 'The lamp makes the duck give out its own light.', zh: '灯让鸭子自己发光。' },
    ],
    why: { en: 'We see an object when light from it enters our eyes. The duck does not give out light; it reflects the lamp’s light.', zh: '物体的光进入眼睛，我们才看得见它。鸭子自己不发光，它反射灯的光。' },
  },
  {
    id: 'L-source', beat: 'cat', objectives: ['L01'],
    ask: { en: 'Which of these is a source of light?', zh: '下面哪一个是光源？' },
    options: [
      { en: 'The lit lamp', zh: '亮着的灯' },
      { en: 'The Moon', zh: '月亮' },
      { en: 'The duck’s shiny key', zh: '鸭子闪亮的发条钥匙' },
      { en: 'A mirror', zh: '镜子' },
    ],
    why: { en: 'A light source gives out its own light. The Moon, the shiny key and a mirror only reflect light from something else.', zh: '光源自己会发光。月亮、发亮的钥匙和镜子都只是反射别处来的光。' },
  },
  {
    id: 'L-position', beat: 'cat', objectives: ['L03'],
    ask: { en: 'The cat is in the duck’s shadow. The lamp must not move. What can the director do to put the cat back in the light?', zh: '猫被鸭子的影子盖住了，而灯不能动。导演怎样做才能让猫回到亮处？' },
    options: [
      { en: 'Move the duck sideways, away from the line between the lamp and the cat.', zh: '把鸭子横向挪开，离开灯和猫之间的连线。' },
      { en: 'Use a bigger duck in the same place.', zh: '在原位换一只更大的鸭子。' },
      { en: 'Paint the duck a lighter colour.', zh: '把鸭子漆成浅一点的颜色。' },
      { en: 'Turn off the lamp.', zh: '把灯关掉。' },
    ],
    why: { en: 'The cat is dark because the duck is on the straight line between the lamp and the cat. Move the duck off that line and the light reaches the cat.', zh: '猫变暗是因为鸭子正好在灯和猫之间的直线上。把鸭子挪开，光就能照到猫。' },
  },
];

const SEEN = 'omt.quiz.seen.v1';

/** Next unseen item for this beat; once all are seen the cycle restarts. */
export function nextQuestion(beat: Question['beat']): Question {
  const pool = QUESTIONS.filter(q => q.beat === beat);
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(SEEN) ?? '[]'); } catch { /* ignore */ }
  let fresh = pool.filter(q => !seen.includes(q.id));
  if (!fresh.length) { seen = seen.filter(id => !pool.some(q => q.id === id)); fresh = pool; }
  const q = fresh[0];
  try { localStorage.setItem(SEEN, JSON.stringify([...seen, q.id])); } catch { /* ignore */ }
  return q;
}

/**
 * Booklet B style: a structured question in parts, answered by completing a
 * sentence. Each blank is one mark, the way school marking looks for key
 * ideas. `text` uses {0}, {1}… for the blanks; in each blank the first option
 * is the correct one and they are shuffled when shown.
 */
export interface OpenPart {
  ask: Text;
  text: Text;
  blanks: Text[][];
}
export interface OpenQuestion {
  id: string;
  objectives: string[];
  stem: Text;
  parts: OpenPart[];
}

const opt = (...pairs: [string, string][]): Text[] => pairs.map(([en, zh]) => ({ en, zh }));

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: 'O-bigger', objectives: ['L02', 'L04'],
    stem: { en: 'In the dark, the second chalk outline was bigger than the first. The director moved only the lamp to fill it.', zh: '关灯以后，第二个粉笔轮廓比第一个大。导演只移动了灯，就把它填满了。' },
    parts: [
      {
        ask: { en: '(a) What did the director do with the lamp?', zh: '(a) 导演对灯做了什么？' },
        text: { en: 'The lamp was moved {0} the duck.', zh: '导演把灯移到了{0}鸭子的位置。' },
        blanks: [opt(['closer to', '更靠近'], ['further from', '更远离'], ['higher above', '更高于'])],
      },
      {
        ask: { en: '(b) Explain why the shadow became bigger.', zh: '(b) 解释影子为什么变大了。' },
        text: { en: 'Light travels in {0}. With the lamp closer, the duck blocks {1} light, so the shadow on the wall is bigger.', zh: '光沿{0}传播。灯靠近以后，鸭子挡住了{1}的光，所以墙上的影子变大。' },
        blanks: [opt(['straight lines', '直线'], ['curved lines', '曲线'], ['circles', '圆圈']), opt(['more', '更多'], ['less', '更少'], ['the same amount of', '同样多'])],
      },
    ],
  },
  {
    id: 'O-cat', objectives: ['L02', 'L03'],
    stem: { en: 'After one take, the cat on the sign was sitting in the dark even though the lamp was on.', zh: '有一条拍完以后，灯明明亮着，招牌上的猫却坐在黑暗里。' },
    parts: [
      {
        ask: { en: '(a) Explain why the cat was in the dark.', zh: '(a) 解释猫为什么在黑暗里。' },
        text: { en: 'The duck was {0}. Light {1} the duck, so it did not reach the cat.', zh: '鸭子正好在{0}。光{1}鸭子，所以照不到猫。' },
        blanks: [opt(['between the lamp and the cat', '灯和猫之间'], ['behind the cat', '猫的后面'], ['beside the lamp', '灯的旁边']), opt(['could not pass through', '无法穿过'], ['bent around', '绕过了'], ['was made by', '来自'])],
      },
      {
        ask: { en: '(b) The lamp stays where it is. What should the director do?', zh: '(b) 灯不能动。导演应该怎么做？' },
        text: { en: 'Move the duck {0}, so that it no longer blocks the light going to the cat.', zh: '把鸭子{0}，让它不再挡住照向猫的光。' },
        blanks: [opt(['sideways', '横向挪开'], ['closer to the lamp', '移近灯'], ['up on a box', '垫高'])],
      },
    ],
  },
  {
    id: 'O-fair', objectives: ['I01', 'L03', 'L04'],
    stem: { en: 'Ali thinks a bigger toy always makes a bigger shadow. He puts a small duck 20 cm from the lamp and a big duck 50 cm from the lamp, and compares their shadows.', zh: '阿里认为玩具越大，影子一定越大。他把小鸭放在离灯 20 厘米处，把大鸭放在离灯 50 厘米处，然后比较两个影子。' },
    parts: [
      {
        ask: { en: '(a) Is Ali’s test fair?', zh: '(a) 阿里的测试公平吗？' },
        text: { en: 'It is {0}, because he changed {1}.', zh: '这{0}，因为他改变了{1}。' },
        blanks: [opt(['not a fair test', '不是公平测试'], ['a fair test', '是公平测试'], ['half a fair test', '算半个公平测试']), opt(['two things at once', '两样东西'], ['only one thing', '只有一样东西'], ['nothing', '什么都没改'])],
      },
      {
        ask: { en: '(b) What must Ali keep the same?', zh: '(b) 阿里必须让什么保持不变？' },
        text: { en: 'He must keep the distance from the {0} the same, and change only the size of the toy.', zh: '他必须让{0}的距离保持不变，只改变玩具的大小。' },
        blanks: [opt(['lamp to the toy', '灯到玩具'], ['toy to the floor', '玩具到地板'], ['lamp to the ceiling', '灯到天花板'])],
      },
    ],
  },
];

const SEEN_OPEN = 'omt.open.seen.v1';
export function nextOpenQuestion(): OpenQuestion {
  let n = 0;
  try { n = Number(localStorage.getItem(SEEN_OPEN) ?? 0) || 0; } catch { /* ignore */ }
  try { localStorage.setItem(SEEN_OPEN, String(n + 1)); } catch { /* ignore */ }
  return OPEN_QUESTIONS[n % OPEN_QUESTIONS.length];
}
