import { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { GARDEN_PICTURE_PIXELS } from '@/features/garden';
import { droughtLeafColors, useColorValues, voiceStoryLayout as L } from '@/ui';

import { STORY_MOTION } from '../config';
import { earthPoint, seededRandom } from '../cracks';
import {
  barEnvelope,
  clamp,
  easeOut,
  followBarOffset,
  introArrival,
  mix,
  pageValue,
  presence,
  threadLook,
  type StoryMarks,
} from '../story-math';
import type { StageProps } from './stage-props';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Each bar's own swing: two slow sines with their own phase and speed (the prototype's `BARS`). */
interface BarSwing {
  readonly phase1: number[];
  readonly speed1: number[];
  readonly phase2: number[];
  readonly speed2: number[];
}

function barSwings(count: number): BarSwing {
  const random = seededRandom(11);
  const swing: BarSwing = { phase1: [], speed1: [], phase2: [], speed2: [] };
  for (let k = 0; k < count; k += 1) {
    swing.phase1.push(random() * Math.PI * 2);
    swing.speed1.push(5 + random() * 6);
    swing.phase2.push(random() * Math.PI * 2);
    swing.speed2.push(1.7 + random() * 2.6);
  }
  return swing;
}

/**
 * The thread of the voice (`canvas.voice`): 36 bars under the recited line that move with the
 * voice (the finger's speed, the simulated reciter, a breath at rest), water at the centre and
 * gold at the ends, grey and still as the garden dries. On the voice page it slides into the bar
 * under the mushaf page, rides in it, then wraps round the listening rosette and dissolves into
 * it (motion spec §7): the same 36 bars throughout. One path per colour, redrawn on the UI thread
 * (the spec's Skia canvas; react-native-svg, already in the app, draws it here).
 */
export function VoiceThread({
  followY,
  ...stage
}: StageProps & {
  /** The centre line of the bar under the mushaf page, once the page is measured. */
  followY: SharedValue<number>;
}) {
  const { position, engine, layout, pages, marks, reducedMotion } = stage;
  const colors = useColorValues();
  const id = `thread-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const voices = useMemo(() => pages.map((page) => page.voice), [pages]);
  const swing = useMemo(() => barSwings(L.waveBars), []);
  const middle = (L.waveBars - 1) / 2;
  const left = layout.width / 2 - middle * L.waveStep;
  const right = layout.width / 2 + middle * L.waveStep;
  const build = (pos: number, t: number, level: number, fy: number) => {
    'worklet';
    const m = STORY_MOTION;
    const thread = threadLook(pos, marks, reducedMotion);
    // The bar under the mushaf page moves with its page: the bars ride inside it (§7).
    const followCentre = fy + followBarOffset(pos, marks.voice, reducedMotion);
    // The ring round the rosette, which rises with its page.
    const ringRadius =
      layout.rosetteRadius * m.ringRadius * (0.86 + 0.14 * presence(pos, marks.recognition));
    const ringX = layout.width / 2;
    const ringY = layout.rosetteY - (reducedMotion ? 0 : m.ringRise * (pos - marks.recognition));
    let all = '';
    let even = '';
    let odd = '';
    for (let k = 0; k < L.waveBars; k += 1) {
      const envelope = barEnvelope(k, L.waveBars);
      // The line under the garden, then the bar under the mushaf page: vertical bars.
      let x = mix(
        layout.width / 2 + (k - middle) * L.waveStep,
        L.followInset + L.followWaveStart + k * L.followWaveStep,
        thread.inBar,
      );
      let y = mix(layout.waveY, followCentre, thread.inBar);
      let angle = Math.PI / 2;
      let reach = mix(L.waveReach, L.followWaveReach, thread.inBar) * envelope;
      if (thread.inRing > 0) {
        // Round the rosette: the left half of the line goes up its left side; each bar lies along
        // the radius, and turns the short way (a bar is a line: modulo π).
        const theta = Math.PI / 2 + ((k + 0.5) / L.waveBars) * Math.PI * 2;
        let turn = (theta - Math.PI / 2) % Math.PI;
        if (turn > Math.PI / 2) turn -= Math.PI;
        x = mix(x, ringX + ringRadius * Math.cos(theta), thread.inRing);
        y = mix(y, ringY + ringRadius * Math.sin(theta), thread.inRing);
        angle = Math.PI / 2 + turn * thread.inRing;
        reach = mix(reach, m.ringReach, thread.inRing);
      }
      const swingNow = reducedMotion
        ? 0.6
        : m.barRest +
          m.barSwing *
            Math.sin(t * (swing.speed1[k] ?? 0) + (swing.phase1[k] ?? 0)) *
            Math.sin(t * (swing.speed2[k] ?? 0) + (swing.phase2[k] ?? 0));
      const length = (m.barMin + reach * level * swingNow) * thread.shrink;
      const dx = (Math.cos(angle) * length) / 2;
      const dy = (Math.sin(angle) * length) / 2;
      const bar = `M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`;
      all += bar;
      if (k % 2 === 0) even += bar;
      else odd += bar;
    }
    const alpha = thread.opacity * m.barOpacity;
    const alive = pageValue(voices, pos);
    const inFollow = thread.inBar * (1 - thread.inRing);
    return {
      d: all === '' ? 'M0 0' : all,
      even: even === '' ? 'M0 0' : even,
      odd: odd === '' ? 'M0 0' : odd,
      strokeWidth: mix(
        mix(L.waveWidth, L.followWaveWidth, thread.inBar),
        L.ringBarWidth,
        thread.inRing,
      ),
      grey: alpha * (1 - thread.inBar),
      alive: alpha * alive * (1 - thread.inBar),
      white: alpha * inFollow,
      ring: alpha * thread.inRing,
    };
  };
  const shape = () => {
    'worklet';
    return build(position.get(), engine.clock.get(), engine.level.get(), followY.get());
  };
  const greyProps = useAnimatedProps(() => {
    const s = shape();
    return { d: s.d, strokeWidth: s.strokeWidth, strokeOpacity: s.grey };
  });
  const aliveProps = useAnimatedProps(() => {
    const s = shape();
    return { d: s.d, strokeWidth: s.strokeWidth, strokeOpacity: s.alive };
  });
  const whiteProps = useAnimatedProps(() => {
    const s = shape();
    return { d: s.d, strokeWidth: s.strokeWidth, strokeOpacity: s.white };
  });
  // Round the rosette the bars alternate water and gold.
  const ringWaterProps = useAnimatedProps(() => {
    const s = shape();
    return { d: s.even, strokeWidth: s.strokeWidth, strokeOpacity: s.ring };
  });
  const ringGoldProps = useAnimatedProps(() => {
    const s = shape();
    return { d: s.odd, strokeWidth: s.strokeWidth, strokeOpacity: s.ring };
  });
  // The whole thread also fades as a view: its opacity reaches every platform, the paths' own
  // props only where the platform redraws them on the UI thread.
  // The thread arrives 250 ms after the first frame (motion spec §2), as a view's opacity.
  const whole = useAnimatedStyle(() => ({
    opacity:
      threadLook(position.get(), marks, reducedMotion).opacity *
      introArrival(engine.introMs.get(), STORY_MOTION.introWaveDelayMs, reducedMotion),
  }));
  // The first frame, before the UI thread runs: the thread at rest on the page shown.
  const initial = build(
    stage.pageIndex,
    0,
    reducedMotion ? STORY_MOTION.reducedLevel : STORY_MOTION.idleLevel,
    0,
  );
  // Gold at the ends, water in the middle: the prototype mixes them by |d|^1.4 along the thread.
  const stops = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map((offset) => ({
    offset,
    gold: Math.pow(Math.abs(offset * 2 - 1), STORY_MOTION.goldCurve),
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="onboarding-voice-thread">
      <Animated.View style={[StyleSheet.absoluteFill, whole]}>
        <Svg width={layout.width} height={layout.height}>
          <Defs>
            <LinearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              x1={left}
              y1={0}
              x2={right}
              y2={0}
            >
              {stops.map(({ offset, gold }) => (
                <Stop
                  key={offset}
                  offset={offset}
                  stopColor={gold > 0.5 ? colors.voiceGold : colors.voiceWater}
                  stopOpacity={1}
                />
              ))}
            </LinearGradient>
          </Defs>
          <AnimatedPath
            d={initial.d}
            strokeWidth={initial.strokeWidth}
            strokeOpacity={initial.grey}
            stroke={colors.voiceGrey}
            strokeLinecap="round"
            fill="none"
            animatedProps={greyProps}
          />
          <AnimatedPath
            d={initial.d}
            strokeWidth={initial.strokeWidth}
            strokeOpacity={initial.alive}
            stroke={`url(#${id})`}
            strokeLinecap="round"
            fill="none"
            animatedProps={aliveProps}
          />
          <AnimatedPath
            d={initial.d}
            stroke={colors.onFollowBar}
            strokeLinecap="round"
            fill="none"
            animatedProps={whiteProps}
          />
          <AnimatedPath
            d={initial.even}
            strokeOpacity={initial.ring}
            stroke={colors.voiceWater}
            strokeLinecap="round"
            fill="none"
            animatedProps={ringWaterProps}
          />
          <AnimatedPath
            d={initial.odd}
            strokeOpacity={initial.ring}
            stroke={colors.voiceGold}
            strokeLinecap="round"
            fill="none"
            animatedProps={ringGoldProps}
          />
        </Svg>
      </Animated.View>
      {reducedMotion ? null : (
        <>
          <Droplets {...stage} />
          <Leaves {...stage} />
        </>
      )}
    </View>
  );
}

/** A number from 0 to 1 that depends only on its inputs: each droplet's path is fixed per cycle. */
function hash(a: number, b: number, salt: number): number {
  'worklet';
  const value = Math.sin(a * 12.9898 + b * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

/** True while the garden grows under the finger: over the five pages, and into the revival. */
function isGrowing(position: number, marks: StoryMarks): boolean {
  'worklet';
  const edge = STORY_MOTION.growingEdge;
  return (
    (position > 0 && position < marks.complete + edge) ||
    (position > marks.dead && position < marks.revival + edge)
  );
}

/**
 * Droplets of the recitation that rise from the thread into the garden while it grows, more of
 * them when the finger moves fast (`parts`). Each droplet follows its own arc, fixed per cycle,
 * so nothing is kept from frame to frame.
 */
function Droplets(stage: StageProps) {
  return (
    <>
      {Array.from({ length: STORY_MOTION.dropletCount }, (_, index) => (
        <Droplet key={index} index={index} {...stage} />
      ))}
    </>
  );
}

function Droplet({ index, position, engine, layout, marks }: StageProps & { index: number }) {
  const colors = useColorValues();
  const m = STORY_MOTION;
  const isGold = hash(index, 0, 9) < m.dropletGoldShare;
  const style = useAnimatedStyle(() => {
    const pos = position.get();
    if (!isGrowing(pos, marks)) return { opacity: 0 };
    const life = m.dropletLifeS + hash(index, 0, 1) * m.dropletLifeRangeS;
    const time = engine.clock.get() + hash(index, 0, 2) * life;
    const cycle = Math.floor(time / life);
    const t = time / life - cycle;
    // How many droplets the finger's speed keeps in the air (70 a second, `spawnAcc`).
    const alive = engine.speed.get() * 70 * (m.dropletLifeS + m.dropletLifeRangeS / 2);
    const shown = clamp(alive - index);
    const bar = Math.floor(hash(index, cycle, 3) * L.waveBars);
    const sx = layout.width / 2 + (bar - (L.waveBars - 1) / 2) * L.waveStep;
    const sy = layout.waveY - L.dropletRise;
    const tx = layout.width / 2 + (hash(index, cycle, 4) - 0.5) * layout.garden.width * 0.62;
    const ty = layout.garden.top + layout.garden.height * (0.3 + hash(index, cycle, 5) * 0.42);
    const cx = mix(sx, tx, 0.5) + (hash(index, cycle, 6) - 0.5) * m.dropletSpread;
    const cy = Math.min(sy, ty) - m.dropletArc - hash(index, cycle, 7) * m.dropletArcRange;
    const u = easeOut(t);
    const iu = 1 - u;
    const x = iu * iu * sx + 2 * iu * u * cx + u * u * tx;
    const y = iu * iu * sy + 2 * iu * u * cy + u * u * ty;
    const size = (L.dropletSize + hash(index, cycle, 8) * L.dropletSizeRange) * (1 - t * 0.4);
    return {
      opacity: Math.sin(Math.PI * t) * m.dropletOpacity * shown,
      transform: [
        { translateX: x - L.dropletBox / 2 },
        { translateY: y - L.dropletBox / 2 },
        { scale: (2 * size) / L.dropletBox },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.droplet,
        { backgroundColor: isGold ? colors.voiceGold : colors.waterFill },
        style,
      ]}
    />
  );
}

/**
 * Leaves that fall from the drying trees (`leaves`): a few at rest, more when the finger moves.
 * Each leaf starts over a planting bed of the earth's top, sways and turns as it falls.
 */
function Leaves(stage: StageProps) {
  return (
    <>
      {Array.from({ length: STORY_MOTION.leafCount }, (_, index) => (
        <Leaf key={index} index={index} {...stage} />
      ))}
    </>
  );
}

function Leaf({ index, position, engine, layout }: StageProps & { index: number }) {
  const m = STORY_MOTION;
  const color = droughtLeafColors[index % droughtLeafColors.length];
  const scale = layout.garden.width / GARDEN_PICTURE_PIXELS.width;
  const style = useAnimatedStyle(() => {
    const pos = position.get();
    if (pos <= m.leafFrom || pos >= m.leafTo) return { opacity: 0 };
    const life = m.leafLifeS + hash(index, 0, 11) * m.leafLifeRangeS;
    const time = engine.clock.get() + hash(index, 0, 12) * life;
    const cycle = Math.floor(time / life);
    const t = (time / life - cycle) * life;
    const steady = pos > m.leafSteadyFrom && pos < m.leafSteadyTo ? m.leafSteady * m.leafCount : 0;
    const alive = engine.speed.get() * 34 * life + steady;
    const shown = clamp(alive - index);
    const u = 0.08 + hash(index, cycle, 13) * 0.84;
    const v = 0.08 + hash(index, cycle, 14) * 0.84;
    const { top, right, left } = EARTH;
    const px = top[0] + u * (right[0] - top[0]) + v * (left[0] - top[0]);
    const py = top[1] + u * (right[1] - top[1]) + v * (left[1] - top[1]);
    const sway = 1.6 + hash(index, cycle, 15) * 1.8;
    const phase = hash(index, cycle, 16) * Math.PI * 2;
    const x = layout.garden.left + px * scale + Math.sin(t * sway + phase) * L.leafSway;
    const y =
      layout.garden.top +
      (py - m.leafStartAbove - hash(index, cycle, 17) * m.leafStartRange) * scale +
      (m.leafFall + hash(index, cycle, 18) * m.leafFallRange) * t;
    const turn =
      hash(index, cycle, 19) * Math.PI * 2 +
      (hash(index, cycle, 20) - 0.5) * 4 * t +
      Math.sin(t * sway) * 0.6;
    const size = L.leafSize + hash(index, cycle, 21) * L.leafSizeRange;
    const opacity = Math.min(1, t * 3) * (1 - Math.pow(t / life, 3)) * m.leafOpacity * shown;
    return {
      opacity,
      transform: [
        { translateX: x - L.leafBox / 2 },
        { translateY: y - L.leafBox / 4 },
        { rotate: `${turn}rad` },
        { scaleX: (2 * size) / L.leafBox },
        { scaleY: ((2 * size) / L.leafBox) * (0.55 + 0.45 * Math.abs(Math.cos(t * sway))) },
      ],
    };
  });
  return <Animated.View style={[styles.leaf, { backgroundColor: color }, style]} />;
}

/** The earth's top corners, as plain numbers for the UI thread (`earthPoint` reads the same). */
const EARTH = {
  top: earthPoint(0, 0),
  right: earthPoint(1, 0),
  left: earthPoint(0, 1),
};

const styles = StyleSheet.create({
  droplet: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: L.dropletBox,
    height: L.dropletBox,
    borderRadius: L.dropletBox / 2,
  },
  leaf: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: L.leafBox,
    height: L.leafBox / 2,
    borderRadius: L.leafBox / 2,
  },
});
