/**
 * The arithmetic of the first launch: what each piece of the stage looks like at a position of the
 * pager, as the owner's chosen prototype computes it in its `frame()`
 * (docs/design/premier-lancement-voix/index.html). Pure functions, marked as worklets so that the
 * stage computes them on the UI thread at every frame, and plain functions in the tests.
 *
 * Everything is a function of the position (and, for the two demonstrations, of their own clock):
 * nothing is remembered from one frame to the next here, so scrubbing back with the finger plays
 * every change backwards, exactly (gestures skill, "Linked values").
 */

import { EASE_OUT_POWER, STORY_MOTION } from './config';
import { GROWS_FROM, type OnboardingPage, type StageGarden, type StageSky } from './pages';

export function clamp(value: number, min = 0, max = 1): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

/** The prototype's `smooth`: slow at both ends, so a page rests clean. */
export function smooth(value: number): number {
  'worklet';
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

export function mix(from: number, to: number, amount: number): number {
  'worklet';
  return from + (to - from) * amount;
}

/** The strong ease-out (`--ease-out`), as the prototype computes it: `1 − (1 − t)³`. */
export function easeOut(value: number): number {
  'worklet';
  return 1 - Math.pow(1 - clamp(value), EASE_OUT_POWER);
}

/** The two pages around a position, how far along (`f`), and the eased amount (`s`). */
export interface Segment {
  readonly from: number;
  readonly to: number;
  readonly along: number;
  readonly eased: number;
}

export function segmentAt(position: number, pageCount: number): Segment {
  'worklet';
  const last = pageCount - 1;
  const clamped = clamp(position, 0, last);
  const from = clamp(Math.floor(clamped), 0, Math.max(0, last - 1));
  const to = Math.min(from + 1, last);
  const along = clamped - from;
  return { from, to, along, eased: smooth(along) };
}

/** How present a page's own visual is: it leaves before the next arrives (`presence`). */
export function presence(position: number, page: number): number {
  'worklet';
  return smooth(1 - Math.abs(position - page) * STORY_MOTION.presenceRate);
}

/** How visible a page's words are, and how far they have drifted (`pins`). */
export function copyLook(
  position: number,
  page: number,
  travel: number,
  reducedMotion: boolean,
): { opacity: number; translateY: number } {
  'worklet';
  const distance = position - page;
  return {
    opacity: smooth(1 - Math.abs(distance) * STORY_MOTION.copyRate),
    translateY: reducedMotion ? 0 : -distance * travel,
  };
}

/** A value of each page, mixed between the two pages around the position with the eased amount. */
export function pageValue(values: readonly number[], position: number): number {
  'worklet';
  const { from, to, eased } = segmentAt(position, values.length);
  return mix(values[from] ?? 0, values[to] ?? 0, eased);
}

/** The sky at a position: how grey, how dusky, how plain (`bg`). */
export function skyAt(skies: readonly StageSky[], position: number): StageSky {
  'worklet';
  const { from, to, eased } = segmentAt(position, skies.length);
  const a = skies[from] ?? { grey: 0, dusk: 0, plain: 0 };
  const b = skies[to] ?? a;
  return {
    grey: mix(a.grey, b.grey, eased),
    dusk: mix(a.dusk, b.dusk, eased),
    plain: mix(a.plain, b.plain, eased),
  };
}

/** Where the story's pages stand: the indices the stage needs, read once from the pages. */
export interface StoryMarks {
  /** The complete garden, the dead one, and the page of the revival. */
  readonly complete: number;
  readonly dead: number;
  readonly revival: number;
  readonly voice: number;
  readonly recognition: number;
  readonly friends: number;
  readonly goal: number;
  readonly reminders: number;
}

export function storyMarks(pages: readonly OnboardingPage[]): StoryMarks {
  const at = (kind: OnboardingPage['kind'], id?: string) => {
    const index = pages.findIndex((p) => p.kind === kind && (id === undefined || p.id === id));
    if (index < 0) throw new RangeError(`The first launch has no ${id ?? kind} page.`);
    return index;
  };
  return {
    complete: at('story', 'hizb60'),
    dead: at('story', 'dead'),
    revival: at('story', 'revival'),
    voice: at('voice'),
    recognition: at('recognition'),
    friends: at('friends'),
    goal: at('goal'),
    reminders: at('reminders'),
  };
}

/**
 * How visible the garden is (`gPres`): whole over the story, gone over the two voice pages and
 * friends, back over the second half of the way to the goal.
 */
export function gardenPresence(position: number, marks: StoryMarks): number {
  'worklet';
  const { revival, voice, friends, goal } = marks;
  if (position <= revival) return 1;
  if (position < voice) return 1 - smooth((position - revival) * STORY_MOTION.presenceRate);
  if (position < friends) return 0;
  if (position < goal) {
    return smooth(
      (position - friends) * STORY_MOTION.presenceRate - STORY_MOTION.previewReturnShift,
    );
  }
  return 1;
}

/** The garden's place on a page: how far it is moved down and how much it is scaled (`GT`). */
export interface GardenPlace {
  readonly translateY: number;
  readonly scale: number;
}

/** The two places of the garden over the settings, from the stage layout. */
export interface PreviewPlaces {
  /** From the garden's place on the story pages to its place above the settings. */
  readonly lift: number;
  readonly goalScale: number;
  readonly remindersScale: number;
}

export function gardenPlaceOf(
  page: number,
  marks: StoryMarks,
  preview: PreviewPlaces,
): GardenPlace {
  'worklet';
  if (page <= marks.revival) return { translateY: 0, scale: 1 };
  if (page < marks.friends) {
    return { translateY: STORY_MOTION.featureLift, scale: STORY_MOTION.featureScale };
  }
  if (page === marks.friends) {
    return {
      translateY: preview.lift + STORY_MOTION.friendsPreviewDrop,
      scale: preview.goalScale * STORY_MOTION.friendsPreviewScale,
    };
  }
  if (page === marks.goal) return { translateY: preview.lift, scale: preview.goalScale };
  return { translateY: preview.lift, scale: preview.remindersScale };
}

/**
 * The garden's transform and opacity at a position. With "reduce motion" it does not travel:
 * it fades out, jumps, and fades in (the prototype's reduced branch).
 */
export function gardenLook(
  position: number,
  pages: readonly OnboardingPage[],
  marks: StoryMarks,
  preview: PreviewPlaces,
  reducedMotion: boolean,
): { translateY: number; scale: number; turn: number; opacity: number } {
  'worklet';
  const { from, to, along, eased } = segmentAt(position, pages.length);
  const a = gardenPlaceOf(from, marks, preview);
  const b = gardenPlaceOf(to, marks, preview);
  const moves = a.translateY !== b.translateY || a.scale !== b.scale;
  let translateY = mix(a.translateY, b.translateY, eased);
  let scale = mix(a.scale, b.scale, eased);
  let opacity = gardenPresence(position, marks);
  if (reducedMotion && moves) {
    translateY = along < 0.5 ? a.translateY : b.translateY;
    scale = along < 0.5 ? a.scale : b.scale;
    opacity *= Math.abs(1 - 2 * along);
  }
  const turnA = pages[from]?.turn ?? 0;
  const turnB = pages[to]?.turn ?? 0;
  return { translateY, scale, turn: reducedMotion ? 0 : mix(turnA, turnB, eased), opacity };
}

/** What a layer of the garden shows at a position: its opacity, and for a rising layer its lift. */
export interface LayerLook {
  readonly opacity: number;
  readonly translateY: number;
  readonly scaleY: number;
}

const HIDDEN: LayerLook = { opacity: 0, translateY: 0, scaleY: 1 };
const SHOWN: LayerLook = { opacity: 1, translateY: 0, scaleY: 1 };

/**
 * One garden layer of the stage (`gardenShow`). `layer` is a stage garden, or `rise:<garden>` for
 * what that garden adds, or `revival` for the green that spreads from the fountain.
 *
 * - The same garden on both pages: shown.
 * - A garden that grows from the one before: the earlier one stays whole, what the new one adds
 *   rises from the ground (26 points, from 90 % of its height), then the whole picture settles
 *   over the last 28 % of the way.
 * - The dead garden to the complete one: the green spreads from the fountain (`revival`).
 * - Anything else: the earlier picture stays whole while the next one arrives, no see-through dip.
 *
 * With "reduce motion", only crossfades.
 */
export function gardenLayerLook(
  layer: string,
  gardens: readonly (StageGarden | null)[],
  position: number,
  riseTravel: number,
  reducedMotion: boolean,
): LayerLook {
  'worklet';
  const { from, to, along, eased } = segmentAt(position, gardens.length);
  const a = gardens[from] ?? null;
  const b = gardens[to] ?? null;
  if (b === null || a === b) return layer === (a ?? b) ? SHOWN : HIDDEN;
  if (a === null) return layer === b ? SHOWN : HIDDEN;
  if (!reducedMotion && GROWS_FROM[b] === a) {
    if (layer === a) return SHOWN;
    if (layer === b) {
      return {
        opacity: smooth((along - STORY_MOTION.settleFrom) / (1 - STORY_MOTION.settleFrom)),
        translateY: 0,
        scaleY: 1,
      };
    }
    if (layer === `rise:${b}`) {
      const rise = easeOut(clamp(along / STORY_MOTION.riseSpan));
      return {
        opacity: smooth(along / STORY_MOTION.riseFade),
        translateY: (1 - rise) * riseTravel,
        scaleY: STORY_MOTION.riseScaleFrom + (1 - STORY_MOTION.riseScaleFrom) * rise,
      };
    }
    return HIDDEN;
  }
  if (!reducedMotion && a === 'd14' && b === 'g60') {
    if (layer === 'd14' || layer === 'revival') return SHOWN;
    return HIDDEN;
  }
  if (layer === a) return { opacity: eased < 0.5 ? 1 : 2 * (1 - eased), translateY: 0, scaleY: 1 };
  if (layer === b) return { opacity: eased < 0.5 ? 2 * eased : 1, translateY: 0, scaleY: 1 };
  return HIDDEN;
}

/**
 * The revival at a position: how far the green has spread (a share of the picture's own ellipse,
 * past 1 it covers it), and the two rings of water that leave the fountain. Null outside it.
 */
export function revivalLook(
  gardens: readonly (StageGarden | null)[],
  position: number,
  reducedMotion: boolean,
): {
  reach: number;
  ring: number;
  ringOpacity: number;
  ring2: number;
  ring2Opacity: number;
} | null {
  'worklet';
  if (reducedMotion) return null;
  const { from, to, along } = segmentAt(position, gardens.length);
  if (gardens[from] !== 'd14' || gardens[to] !== 'g60') return null;
  const m = STORY_MOTION;
  const reach = m.revivalReach * smooth(along * 0.5 + 0.5) * along * m.revivalOvershoot;
  const second = clamp((along - m.ringSecondDelay) / (1 - m.ringSecondDelay));
  return {
    reach,
    ring: m.ringStart + m.ringGrowth * along,
    ringOpacity: Math.sin(Math.PI * clamp(along)) * m.ringOpacity,
    ring2: m.ringStart + m.ringSecondGrowth * easeOut(second),
    ring2Opacity: Math.sin(Math.PI * second) * m.ringSecondOpacity,
  };
}

/** How far the earth has cracked (0 to 1) and how visible the cracks still are. */
export function crackLook(position: number): { progress: number; opacity: number } {
  'worklet';
  const m = STORY_MOTION;
  const progress = clamp((position - m.crackFrom) / m.crackSpan);
  const opacity =
    position > m.crackLeaveFrom ? 1 - smooth((position - m.crackLeaveFrom) * m.crackLeaveRate) : 1;
  return { progress, opacity };
}

/** A group of cracks, which appear together once the earth has cracked past `at`. */
export function crackGroupOpacity(at: number, progress: number, reducedMotion: boolean): number {
  'worklet';
  if (reducedMotion) return progress > 0.5 ? 1 : 0;
  return clamp((progress - at) * STORY_MOTION.crackSharpness);
}

/**
 * The caption of a set of pages (pages that share the same words share one caption): how visible
 * it is. The words of one page fade out over the first half of the way and the next page's fade in
 * over the second, so two captions never overlap (`.cap`).
 */
export function captionOpacity(
  pages: readonly number[],
  pageCount: number,
  position: number,
): number {
  'worklet';
  const { from, to, eased } = segmentAt(position, pageCount);
  const inA = pages.includes(from);
  const inB = pages.includes(to);
  if (inA && inB) return 1;
  if (inA) return eased < 0.5 ? 1 - 2 * eased : 0;
  if (inB) return eased < 0.5 ? 0 : 2 * eased - 1;
  return 0;
}

/** How many words of Al-Fatiha are lit at a position: all 29 over the five growing pages. */
export function litWords(position: number, total: number): number {
  'worklet';
  return clamp(position / STORY_MOTION.lineOverPages) * total;
}

/**
 * One line of the recited verse under the garden (one verse, or half of the long seventh): its
 * opacity and drift as the lit words reach it, then leave it for the next line.
 */
export function verseLineLook(
  lit: number,
  start: number,
  count: number,
  isFirst: boolean,
  isLast: boolean,
  reducedMotion: boolean,
): { opacity: number; translateY: number } {
  'worklet';
  const m = STORY_MOTION;
  const shown = isFirst ? 1 : clamp((lit - (start - 0.1)) / m.lineFadeIn);
  const gone = isLast ? 0 : clamp((lit - (start + count - 0.1)) / m.lineFadeIn);
  return {
    opacity: shown * (1 - gone),
    translateY: reducedMotion ? 0 : (1 - shown) * m.lineDrift - gone * m.lineDrift,
  };
}

/** A word of the recited line: faint until it is reached, lit as the voice reaches it. */
export function verseWordOpacity(lit: number, index: number, voice: number): number {
  'worklet';
  return STORY_MOTION.wordFloor + (1 - STORY_MOTION.wordFloor) * clamp(lit - index) * voice;
}

/**
 * The gold pill behind the word being recited on a line: which word it sits on (fractional while
 * it moves to the next), and how visible it is. `boxes` are the words' [x, width] on the line.
 */
export function versePillLook(
  lit: number,
  start: number,
  boxes: readonly (readonly [number, number])[],
  voice: number,
  pad: number,
): { x: number; width: number; opacity: number } {
  'worklet';
  const count = boxes.length;
  const along = lit - start;
  if (count === 0 || along <= 0 || along >= count + 0.5) return { x: 0, width: 0, opacity: 0 };
  const word = Math.min(count - 1, Math.floor(clamp(along, 0, count - 0.001)));
  const within = along - word;
  const moving =
    word < count - 1
      ? smooth((within - STORY_MOTION.pillMoveFrom) / (1 - STORY_MOTION.pillMoveFrom))
      : 0;
  const here = boxes[word] ?? [0, 0];
  const next = boxes[Math.min(count - 1, word + 1)] ?? here;
  return {
    x: mix(here[0], next[0], moving) - pad,
    width: mix(here[1], next[1], moving) + 2 * pad,
    opacity: clamp(along * 4) * clamp((count - along) * 3 + (word < count - 1 ? 1 : 0)) * voice,
  };
}

/**
 * The level the voice shows: the loudest of the finger's speed, the simulated reciter and the
 * breath at rest, times how alive the page's voice is. A still line with "reduce motion".
 */
export function voiceLevel(
  speed: number,
  pulse: number,
  clockS: number,
  position: number,
  alive: number,
  reducedMotion: boolean,
): number {
  'worklet';
  const m = STORY_MOTION;
  if (reducedMotion) return m.reducedLevel * alive;
  const idle =
    (m.idleLevel + m.idleSwing * Math.sin(clockS * m.idleRate)) *
    (position < m.idleQuietFrom ? 1 : m.idleQuiet);
  return clamp(Math.max(speed, pulse, idle) * alive);
}

/** The water flows with the voice (`flow`). */
export function waterFlow(level: number): number {
  'worklet';
  return clamp(STORY_MOTION.flowBase + level * STORY_MOTION.flowGain);
}

/**
 * Where the thread of the voice is: 0 under the garden, 1 inside the bar under the mushaf page,
 * and how visible it is (it leaves with the bar).
 */
export function threadLook(
  position: number,
  marks: StoryMarks,
  reducedMotion: boolean,
): { inBar: number; opacity: number } {
  'worklet';
  const { revival, voice } = marks;
  const page = Math.floor(clamp(position, 0, voice + 1));
  const along = position - page;
  let inBar = 0;
  if (page >= voice) inBar = 1;
  else if (page === revival) inBar = reducedMotion ? (along < 0.5 ? 0 : 1) : smooth(along);
  let opacity = 1;
  if (page === voice) opacity = 1 - smooth(along * STORY_MOTION.threadLeaveRate);
  else if (page > voice) opacity = 0;
  return { inBar, opacity };
}

/** The envelope of the thread: tall in the middle, low at its ends. */
export function barEnvelope(index: number, count: number): number {
  'worklet';
  const middle = (count - 1) / 2;
  const d = (index - middle) / middle;
  return (
    STORY_MOTION.envelopeFloor +
    (1 - STORY_MOTION.envelopeFloor) * Math.exp(-(d * d) / STORY_MOTION.envelopeWidth)
  );
}

/**
 * The heart that leaves the friend who recites and lands on the thirsty friend: how far along its
 * arc it is (0 to 1), or -1 before it leaves.
 */
export function heartProgress(position: number, friendsPage: number): number {
  'worklet';
  const from = friendsPage - STORY_MOTION.heartLead;
  const progress = clamp((position - from) / STORY_MOTION.heartSpan);
  return position <= from ? -1 : progress;
}

/** A point on the heart's arc: a quadratic curve from `start` to `end`, rising over both. */
export function heartPoint(
  progress: number,
  start: readonly [number, number],
  end: readonly [number, number],
  arc: number,
  reducedMotion: boolean,
): { x: number; y: number; scale: number; rotate: number } {
  'worklet';
  const m = STORY_MOTION;
  const u = reducedMotion ? 1 : easeOut(progress);
  const cx = (start[0] + end[0]) / 2;
  const cy = Math.min(start[1], end[1]) - arc;
  const iu = 1 - u;
  const x = iu * iu * start[0] + 2 * iu * u * cx + u * u * end[0];
  const y = iu * iu * start[1] + 2 * iu * u * cy + u * u * end[1];
  const pop = progress < 1 ? 1 + m.heartPop * Math.sin(Math.PI * progress) : 1;
  return { x, y, scale: pop * (progress >= 1 ? m.heartRest : 1), rotate: (1 - u) * -m.heartTilt };
}

/**
 * One dot of the page dots, as the prototype's classes make it at a position: the current dot a
 * long capsule, its two neighbours either side plain, then smaller, then gone. Continuous in the
 * position, so the dots change with the finger. Returns its length along the column, its width,
 * and the room it takes (its length and the gap after it, nothing once gone).
 */
export function dotShape(
  index: number,
  position: number,
  sizes: { dot: number; small: number; smaller: number; current: number; gap: number },
): { length: number; width: number; room: number; current: number } {
  'worklet';
  const distance = Math.abs(index - position);
  const current = clamp(1 - distance);
  const near = STORY_MOTION.dotsNear;
  let width = sizes.dot;
  if (distance >= near + 3) width = 0;
  else if (distance > near + 2) width = mix(sizes.smaller, 0, distance - near - 2);
  else if (distance > near + 1) width = mix(sizes.small, sizes.smaller, distance - near - 1);
  else if (distance > near) width = mix(sizes.dot, sizes.small, distance - near);
  const length = width + (sizes.current - sizes.dot) * current;
  const visible = clamp(near + 3 - distance);
  return { length, width, room: length + sizes.gap * visible, current };
}
