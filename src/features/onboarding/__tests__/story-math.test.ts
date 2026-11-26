import { STORY_MOTION } from '../config';
import { ONBOARDING_PAGES } from '../pages';
import {
  captionOpacity,
  copyBlockLook,
  copyLook,
  crackLayerOpacity,
  crackLook,
  dotShape,
  easeOut,
  gardenLayerLook,
  gardenLook,
  gardenPresence,
  followBarOffset,
  heartProgress,
  introArrival,
  litWords,
  nightLook,
  presence,
  recognitionLook,
  revivalLook,
  segmentAt,
  skyAt,
  smooth,
  springT,
  storyMarks,
  threadLook,
  verseLineLook,
  versePillLook,
  voiceLevel,
} from '../story-math';

const pages = ONBOARDING_PAGES;
const marks = storyMarks(pages);
const gardens = pages.map((page) => page.garden);
const preview = { lift: -100, goalScale: 0.7, remindersScale: 0.55 };

describe('from the finger’s position to what the stage shows', () => {
  it('reads the two pages around a position and how far along, eased at both ends', () => {
    expect(segmentAt(2.25, 16)).toEqual({ from: 2, to: 3, along: 0.25, eased: smooth(0.25) });
    // Past the last page (the rubber band), the last segment, whole.
    expect(segmentAt(15.2, 16)).toMatchObject({ from: 14, to: 15, along: 1 });
    expect(segmentAt(-0.2, 16)).toMatchObject({ from: 0, along: 0 });
  });

  it('names the pages the stage depends on', () => {
    expect(marks).toEqual({
      complete: 5,
      dead: 9,
      revival: 10,
      voice: 11,
      recognition: 12,
      friends: 13,
      goal: 14,
      reminders: 15,
    });
  });

  it('lets a page’s visual leave before the next arrives (presence)', () => {
    expect(presence(11, 11)).toBe(1);
    expect(presence(11 + 1 / STORY_MOTION.presenceRate, 11)).toBeCloseTo(0);
    expect(presence(11.6, 11)).toBe(0);
  });

  it('fades the words in place and drifts them 56 points, both ways, and only fades them with reduce motion', () => {
    expect(copyLook(3, 3, 56, false)).toEqual({ opacity: 1, translateY: -0 });
    expect(copyLook(3.25, 3, 56, false).translateY).toBeCloseTo(-14);
    expect(copyLook(2.75, 3, 56, false).translateY).toBeCloseTo(14);
    expect(copyLook(3.5, 3, 56, false).opacity).toBe(0);
    expect(copyLook(3.25, 3, 56, true)).toMatchObject({ translateY: 0 });
    // Scrubbing back gives back exactly the same look.
    expect(copyLook(3.1, 3, 56, false)).toEqual(copyLook(3.1, 3, 56, false));
  });

  it('greys the sky little by little as the garden dries', () => {
    const skies = pages.map((page) => page.sky);
    expect(skyAt(skies, 6).grey).toBe(0.4);
    expect(skyAt(skies, 6.5).grey).toBeCloseTo((0.4 + 0.65) / 2);
    expect(skyAt(skies, 11).dusk).toBe(1);
  });

  it('raises a new stage’s element from the ground, then settles the whole picture over the last 28 %', () => {
    const rise = (along: number) => gardenLayerLook('rise:g20', gardens, 1 + along, 26, false);
    expect(rise(0)).toEqual({ opacity: 0, translateY: 26, scaleY: 0.9 });
    expect(rise(STORY_MOTION.riseFade).opacity).toBe(1);
    expect(rise(STORY_MOTION.riseSpan)).toMatchObject({ translateY: 0, scaleY: 1 });
    // The earlier stage stays whole underneath; the new picture only settles at the end.
    expect(gardenLayerLook('g8', gardens, 1.5, 26, false).opacity).toBe(1);
    expect(gardenLayerLook('g20', gardens, 1.5, 26, false).opacity).toBe(0);
    expect(gardenLayerLook('g20', gardens, 2, 26, false).opacity).toBe(1);
  });

  it('crossfades only, with reduce motion: no rise, no spreading water', () => {
    expect(gardenLayerLook('rise:g20', gardens, 1.5, 26, true).opacity).toBe(0);
    expect(gardenLayerLook('g20', gardens, 1.5, 26, true).opacity).toBe(1);
    expect(gardenLayerLook('g8', gardens, 1.75, 26, true).opacity).toBeLessThan(1);
    expect(revivalLook(gardens, 9.5, true)).toBeNull();
    expect(gardenLayerLook('g60', gardens, 9.5, 26, true).opacity).toBe(1);
  });

  it('brings the water back from the fountain on the revival, then shows the complete garden', () => {
    expect(gardenLayerLook('revival', gardens, 9.4, 26, false).opacity).toBe(1);
    expect(gardenLayerLook('g60', gardens, 9.4, 26, false).opacity).toBe(0);
    const start = revivalLook(gardens, 9.05, false);
    const later = revivalLook(gardens, 9.6, false);
    expect(start?.reach).toBeLessThan(later?.reach ?? 0);
    // At the end the green covers the picture, and the plain picture takes over.
    expect(revivalLook(gardens, 9.999, false)?.reach).toBeGreaterThan(2);
    expect(gardenLayerLook('g60', gardens, 10, 26, false).opacity).toBe(1);
    expect(revivalLook(gardens, 10.2, false)).toBeNull();
  });

  it('cracks the earth from page 7.35 and lets the cracks go after the dead page', () => {
    expect(crackLook(7)).toEqual({ progress: 0, opacity: 1 });
    expect(crackLook(8.9).progress).toBe(1);
    expect(crackLook(9.6).opacity).toBe(0);
    // Eight layers, each over its own part of the cracking (cp = ramp(p, 7.35, 8.9)).
    const cpAt = (cp: number) => 7.35 + cp * 1.55;
    expect(crackLayerOpacity(0, cpAt(0), false)).toBeCloseTo(0.125);
    expect(crackLayerOpacity(0, cpAt(0.14), false)).toBeCloseTo(1);
    expect(crackLayerOpacity(7, cpAt(0.8), false)).toBe(0);
    expect(crackLayerOpacity(7, cpAt(0.99), false)).toBeCloseTo(1);
    // All of them leave after the dead page.
    expect(crackLayerOpacity(0, 9.6, false)).toBe(0);
    // Reduce motion: one crossfade at the middle of the cracking.
    expect(crackLayerOpacity(7, cpAt(0.3), true)).toBe(0);
    expect(crackLayerOpacity(7, cpAt(0.7), true)).toBe(1);
  });

  it('hides the garden over the voice pages and friends, and shows it smaller above the settings', () => {
    expect(gardenPresence(10, marks)).toBe(1);
    expect(gardenPresence(11.5, marks)).toBe(0);
    expect(gardenPresence(13.2, marks)).toBe(0);
    expect(gardenPresence(14, marks)).toBe(1);
    const goal = gardenLook(14, pages, marks, preview, false);
    expect(goal).toMatchObject({ translateY: -100, scale: 0.7, turn: 0 });
    // With reduce motion it does not travel: it fades out, jumps, fades in.
    const mid = gardenLook(13.5, pages, marks, preview, true);
    expect(mid.opacity).toBe(0);
    expect(gardenLook(14.4, pages, marks, preview, true)).toMatchObject({ scale: 0.7, turn: 0 });
  });

  it('turns the camera around the garden with the finger', () => {
    expect(gardenLook(0, pages, marks, preview, false).turn).toBe(-5);
    expect(gardenLook(5, pages, marks, preview, false).turn).toBe(5);
    expect(gardenLook(2.5, pages, marks, preview, false).turn).toBeCloseTo(0);
    // Straight from the dead page on: the revival masks the garden.
    expect(gardenLook(9.5, pages, marks, preview, false).turn).toBe(0);
  });

  it('never shows two captions at once', () => {
    for (const position of [1.2, 1.49, 1.51, 1.8]) {
      const a = captionOpacity([1], 16, position);
      const b = captionOpacity([2], 16, position);
      expect(Math.min(a, b)).toBe(0);
    }
    // The goal and the reminders share one caption: it stays.
    expect(captionOpacity([14, 15], 16, 14.5)).toBe(1);
  });

  it('lights Al-Fatiha word by word over the five growing pages, each page resting mid-line', () => {
    [0, 5.8, 11.5, 15, 22.2, 29].forEach((words, page) => {
      expect(litWords(page, 29)).toBeCloseTo(words);
    });
    expect(litWords(2.5, 29)).toBeCloseTo(13.25);
    expect(litWords(7, 29)).toBe(29);
    // The first line is there from the start; a later line comes as the voice reaches it.
    expect(verseLineLook(0, 0, 4, true, false, false).opacity).toBe(1);
    expect(verseLineLook(2, 4, 4, false, false, false).opacity).toBe(0);
    expect(verseLineLook(5, 4, 4, false, false, false).opacity).toBe(1);
    expect(verseLineLook(9, 4, 4, false, false, false).opacity).toBe(0);
    const boxes = [
      [200, 40],
      [140, 50],
    ] as const;
    expect(versePillLook(0.3, 0, boxes, 1, 5)).toMatchObject({ x: 195, width: 50 });
    // Over the last 45 % of a word, the pill moves on to the next.
    expect(versePillLook(1, 0, boxes, 1, 5).x).toBeCloseTo(135);
  });

  it('slides the thread of the voice into the bar under the mushaf page, then round the rosette', () => {
    expect(threadLook(5, marks, false)).toEqual({ inBar: 0, inRing: 0, shrink: 1, opacity: 1 });
    // 10 → 11: inOutCubic over [0.08, 0.85] of the way.
    expect(threadLook(10.08, marks, false).inBar).toBeCloseTo(0);
    expect(threadLook(10.465, marks, false).inBar).toBeCloseTo(0.5);
    expect(threadLook(10.85, marks, false).inBar).toBeCloseTo(1);
    expect(threadLook(11, marks, false)).toEqual({ inBar: 1, inRing: 0, shrink: 1, opacity: 1 });
    // 11 → 12: the same bars wrap the rosette over [0.04, 0.72], shrink and fade into it.
    expect(threadLook(11.38, marks, false).inRing).toBeCloseTo(0.5);
    expect(threadLook(11.72, marks, false).inRing).toBeCloseTo(1);
    expect(threadLook(11.5, marks, false).opacity).toBe(1);
    expect(threadLook(11.92, marks, false)).toMatchObject({ opacity: 0 });
    expect(threadLook(11.92, marks, false).shrink).toBeCloseTo(0.15);
    expect(threadLook(12.5, marks, false).opacity).toBe(0);
    // Reduce motion: crossfades at the middle of the way, no morph.
    expect(threadLook(10.4, marks, true).inBar).toBe(0);
    expect(threadLook(11.3, marks, true).inRing).toBe(0);
    // The bar under the mushaf page trails its page in and leaves upwards.
    expect(followBarOffset(10.5, marks.voice, false)).toBe(55);
    expect(followBarOffset(11.5, marks.voice, false)).toBe(-30);
    expect(followBarOffset(10.5, marks.voice, true)).toBe(0);
  });

  it('brings the night down as a curtain and takes it up like dawn', () => {
    expect(nightLook(10, marks).visible).toBe(false);
    expect(nightLook(10.5, marks)).toEqual({ offset: -0.25, night: 0.5, visible: true });
    expect(nightLook(11.5, marks)).toEqual({ offset: 0, night: 1, visible: true });
    expect(nightLook(12.5, marks)).toEqual({ offset: -0.75, night: 0.5, visible: true });
    expect(nightLook(13, marks).visible).toBe(false);
  });

  it('leads with the title and lets the sentence follow, then they leave as one', () => {
    const travel = { title: 56, text: 76 };
    const title = copyBlockLook(2.7, 3, 'title', travel, false);
    const text = copyBlockLook(2.7, 3, 'text', travel, false);
    expect(title.opacity).toBeGreaterThan(text.opacity);
    expect(title.translateY).toBeCloseTo(56 * 0.3);
    expect(text.translateY).toBeCloseTo(76 * 0.3);
    expect(copyBlockLook(3, 3, 'title', travel, false)).toEqual({ opacity: 1, translateY: -0 });
    expect(copyBlockLook(3.2, 3, 'text', travel, false)).toEqual(
      copyBlockLook(3.2, 3, 'title', travel, false),
    );
    expect(copyBlockLook(3.6, 3, 'title', travel, false).opacity).toBe(0);
    expect(copyBlockLook(2.7, 3, 'text', travel, true).translateY).toBe(0);
  });

  it('springs the first page in, then finds the passage rosette first and the card 80 ms later', () => {
    expect(springT(0, 0.9)).toBe(0);
    expect(springT(3, 0.9)).toBeCloseTo(1, 4);
    expect(introArrival(320, 320, false)).toBe(0);
    expect(introArrival(0, 320, true)).toBe(1);
    expect(recognitionLook(2000, false)).toEqual({ rosette: 0, card: 0 });
    const early = recognitionLook(2760, false);
    expect(early.rosette).toBeGreaterThan(0);
    expect(early.card).toBe(0);
    const found = recognitionLook(5000, false);
    expect(found.rosette).toBeCloseTo(1, 3);
    expect(found.card).toBeCloseTo(1, 3);
    expect(recognitionLook(8750, false).card).toBeCloseTo(0, 5);
    expect(recognitionLook(100, true)).toEqual({ rosette: 1, card: 1 });
  });

  it('gives the voice a still level with reduce motion, and silence on a dry page', () => {
    expect(voiceLevel(0.9, 0, 0, 1, 1, true)).toBe(STORY_MOTION.reducedLevel);
    expect(voiceLevel(0.9, 0, 0, 9, 0, false)).toBe(0);
    expect(voiceLevel(0.8, 0, 0, 1, 1, false)).toBe(0.8);
    expect(voiceLevel(0, 0, 0, 1, 1, false)).toBeCloseTo(STORY_MOTION.idleLevel);
  });

  it('flies the heart over [12.4, 12.88]: it lands at 88 % of the way', () => {
    expect(heartProgress(12.4, marks.friends)).toBe(-1);
    expect(heartProgress(12.64, marks.friends)).toBeCloseTo(0.5);
    expect(heartProgress(12.88, marks.friends)).toBeCloseTo(1);
    expect(heartProgress(13, marks.friends)).toBe(1);
  });

  it('draws the current dot long, its neighbours plain, then smaller, then none', () => {
    const sizes = { dot: 4, small: 3, smaller: 2, current: 14, gap: 6 };
    expect(dotShape(5, 5, sizes)).toMatchObject({ length: 14, width: 4, current: 1 });
    expect(dotShape(7, 5, sizes)).toMatchObject({ length: 4, width: 4 });
    expect(dotShape(8, 5, sizes).width).toBe(3);
    expect(dotShape(9, 5, sizes).width).toBe(2);
    expect(dotShape(10, 5, sizes)).toMatchObject({ width: 0, room: 0 });
    // Halfway between two pages, both dots are half long.
    expect(dotShape(5, 5.5, sizes).length).toBe(9);
  });

  it('eases out strongly, as the prototype’s cubic', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(0.5)).toBe(0.875);
    expect(easeOut(2)).toBe(1);
  });
});
