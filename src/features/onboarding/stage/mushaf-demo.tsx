import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { quranStructure } from '@/data/quran';
import type { MushafPage } from '@/domain/quran';
import { verseMarkText } from '@/features/listening/passage-words';
import { starPath } from '@/features/listening/rosette/rosette-geometry';
import {
  fontFamily,
  textStyles,
  useColorValues,
  voiceStoryLayout as L,
  voiceStoryDetails as D,
  voiceStoryShadows,
} from '@/ui';

import { STORY_MOTION } from '../config';
import {
  RECITED_SURAH,
  currentWord,
  fixedAmount,
  pageLines,
  readPillLook,
  rereadAmount,
  stillMoment,
  wordLook,
  type Recitation,
  type WordBox,
} from '../recitation';
import { presence } from '../story-math';
import type { StageProps } from './stage-props';

/**
 * The voice page (page 11 of the prototype, `.mushaf` and `.follow`): Al-Fatiha on its mushaf
 * page, at night, as page 1 of the data lays it out; its words light one by one as a voice
 * recites them, one word read wrong turns red while the bar says "Relis ce mot", then it is read
 * again. The bar under the page is where the thread of the voice comes to rest. No play button:
 * the app has no licensed recitation audio yet, and the owner forbids shipping an unfinished
 * feature (TODO in docs/specs/ui-lot1.md, A.3): the words light up silently.
 *
 * The demonstration runs on the UI thread from its own clock (`recitationMs`), only near its page;
 * with "reduce motion" it stays on the word to read again.
 */
export function MushafDemo({
  fatiha,
  recitation,
  followY,
  ...stage
}: StageProps & {
  fatiha: MushafPage | null;
  recitation: Recitation | null;
  followY: SharedValue<number>;
}) {
  const { position, engine, layout, marks, reducedMotion } = stage;
  const { t } = useTranslation(['onboarding', 'reader']);
  const colors = useColorValues();
  const id = `page-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const lines = useMemo(() => (fatiha === null ? [] : pageLines(fatiha)), [fatiha]);
  const [cardHeight, setCardHeight] = useState(0);
  const boxes = useSharedValue<WordBox[]>([]);
  const rows = useRef<{ x: number; y: number }[]>([]);
  const words = useRef<{ row: number; x: number; y: number; width: number; height: number }[]>([]);
  /** Where each word's group (the word and the verse mark after it) sits on its row. */
  const groups = useRef<number[]>([]);
  const wordCount = lines.reduce((sum, line) => sum + line.words.length, 0);
  const publishBoxes = () => {
    const all = words.current;
    if (
      all.filter(Boolean).length !== wordCount ||
      rows.current.filter(Boolean).length !== lines.length
    )
      return;
    boxes.set(
      all.map((word) => {
        const row = rows.current[word.row] ?? { x: 0, y: 0 };
        const group = groups.current[all.indexOf(word)] ?? 0;
        return {
          x: row.x + group + word.x,
          y: row.y + word.y,
          width: word.width,
          height: word.height,
        };
      }),
    );
  };
  const onCardLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setCardHeight(height);
    followY.set(layout.pageTop + height);
  };
  const still = recitation === null ? 0 : stillMoment(recitation);
  const clockOf = (ms: number) => {
    'worklet';
    return reducedMotion ? still : ms;
  };
  const card = useAnimatedStyle(() => {
    const d = position.get() - marks.voice;
    const shown = presence(position.get(), marks.voice);
    const m = STORY_MOTION;
    return {
      opacity: shown,
      transform: reducedMotion
        ? []
        : d < 0
          ? [{ translateY: -d * m.pageEnterTravel }, { scale: 1 + d * m.pageEnterScale }]
          : [{ translateY: -d * m.pageLeaveTravel }, { scale: 1 - d * m.pageLeaveScale }],
    };
  });
  const bar = useAnimatedStyle(() => {
    const d = position.get() - marks.voice;
    const m = STORY_MOTION;
    return {
      opacity: presence(position.get(), marks.voice),
      transform: [
        {
          translateY: reducedMotion ? 0 : -d * (d < 0 ? m.followEnterTravel : m.followLeaveTravel),
        },
      ],
    };
  });
  if (recitation === null) return null;
  const surah = quranStructure.surah(RECITED_SURAH);
  const textStyle = {
    fontFamily: fontFamily.quran,
    fontSize: layout.pageTextSize,
    lineHeight: layout.pageLineHeight,
  };
  return (
    <>
      <Animated.View
        style={[styles.card, { top: layout.pageTop, boxShadow: voiceStoryShadows.page }, card]}
        onLayout={onCardLayout}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="onboarding-mushaf"
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.nightPageTop} />
              <Stop offset="1" stopColor={colors.nightPageBottom} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={L.pageRadius} fill={`url(#${id})`} />
        </Svg>
        <View style={[styles.frame, { borderColor: colors.nightPageRule }]}>
          <View style={[styles.frameInner, { borderColor: colors.nightPageRuleSoft }]} />
        </View>
        <Corner place={styles.cornerTopStart} colors={colors} />
        <Corner place={styles.cornerTopEnd} colors={colors} />
        <Corner place={styles.cornerBottomStart} colors={colors} />
        <Corner place={styles.cornerBottomEnd} colors={colors} />
        <View style={styles.head}>
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 300 46"
            preserveAspectRatio="none"
          >
            <Path
              d={CARTOUCHE_OUTER}
              fill={colors.nightPillRead}
              fillOpacity={0.27}
              stroke={colors.nightPageGold}
              strokeWidth={D.pageRuleWidth}
              vectorEffect="non-scaling-stroke"
            />
            <Path
              d={CARTOUCHE_INNER}
              fill="none"
              stroke={colors.nightPageRule}
              strokeWidth={D.pageRuleSoftWidth}
              vectorEffect="non-scaling-stroke"
            />
          </Svg>
          <Text
            style={[styles.headText, { color: colors.nightPageInk }]}
            accessibilityLanguage="ar"
          >
            {t('reader:page.surahTitle', { name: surah.nameArabic })}
          </Text>
        </View>
        <View style={styles.lines}>
          <ReadPill
            boxes={boxes}
            recitation={recitation}
            clock={engine.recitationMs}
            toClock={clockOf}
            color={colors.nightPillRead}
          />
          <StatePill
            boxes={boxes}
            recitation={recitation}
            clock={engine.recitationMs}
            toClock={clockOf}
            kind="reread"
            color={colors.nightPillReread}
            edge={colors.nightPillRereadEdge}
          />
          <StatePill
            boxes={boxes}
            recitation={recitation}
            clock={engine.recitationMs}
            toClock={clockOf}
            kind="fixed"
            color={colors.nightPillFixed}
          />
          {lines.map((line, row) => (
            <View
              key={row}
              style={[styles.row, { gap: layout.pageTextSize * L.verseWordGapEm }]}
              onLayout={(event) => {
                const { x, y } = event.nativeEvent.layout;
                rows.current[row] = { x, y };
                publishBoxes();
              }}
            >
              {line.words.map((word, position) => {
                const end = line.verseEnds.find((verseEnd) => verseEnd.afterWordIndex === position);
                return (
                  <View
                    key={word.index}
                    style={styles.wordGroup}
                    onLayout={(event) => {
                      groups.current[word.index] = event.nativeEvent.layout.x;
                      publishBoxes();
                    }}
                  >
                    <MushafWord
                      text={word.text}
                      index={word.index}
                      recitation={recitation}
                      clock={engine.recitationMs}
                      toClock={clockOf}
                      textStyle={textStyle}
                      colors={colors}
                      onLayout={(event) => {
                        const { x, y, width, height } = event.nativeEvent.layout;
                        words.current[word.index] = { row, x, y, width, height };
                        publishBoxes();
                      }}
                    />
                    {end === undefined ? null : (
                      <Text
                        style={[
                          textStyle,
                          {
                            color: colors.nightPageGold,
                            fontSize: layout.pageTextSize * (L.verseMarkSize / L.verseTextSize),
                          },
                        ]}
                      >
                        {verseMarkText(end.verse)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </Animated.View>
      {cardHeight > 0 ? (
        <Animated.View
          style={[
            styles.follow,
            {
              top: layout.pageTop + cardHeight - L.followOverlap,
              boxShadow: voiceStoryShadows.follow,
            },
            bar,
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="onboarding-follow-bar"
        >
          <FollowBarSurface />
          <View style={styles.followText}>
            <Text
              style={[textStyles.callout, styles.followTitle, { color: colors.onFollowBar }]}
              numberOfLines={1}
            >
              {t('recitation.listening')}
            </Text>
            <View style={styles.followSub}>
              {Array.from({ length: surah.verseCount }, (_, verse) => (
                <VerseSubtitle
                  key={verse}
                  verse={verse + 1}
                  text={t('recitation.verse', {
                    surah: surah.nameTransliterated,
                    verse: verse + 1,
                  })}
                  recitation={recitation}
                  clock={engine.recitationMs}
                  toClock={clockOf}
                  color={colors.onFollowBarSecondary}
                />
              ))}
              <RereadSubtitle
                label={t('recitation.reread')}
                word={lines.flatMap((line) => line.words)[recitation.reread]?.text ?? ''}
                recitation={recitation}
                clock={engine.recitationMs}
                toClock={clockOf}
                colors={colors}
              />
            </View>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

type ColorValues = ReturnType<typeof useColorValues>;
type ToClock = (ms: number) => number;

/** The cartouche of the surah's name, drawn in the 300 × 46 box it is stretched to (`.mhead`). */
const CARTOUCHE_OUTER = 'M14 23 L30 4 H270 L286 23 L270 42 H30 Z';
const CARTOUCHE_INNER = 'M22 23 L34 8 H266 L278 23 L266 38 H34 Z';

/** A corner of the page: the eight-pointed star of the hizb quarters, in gold, and its heart. */
function Corner({ place, colors }: { place: object; colors: ColorValues }) {
  const half = L.pageCorner / 2;
  return (
    <View style={[styles.corner, place]}>
      <Svg width={L.pageCorner} height={L.pageCorner}>
        <Path
          d={starPath(half, half, half * D.pageStarShare)}
          fill={colors.nightPageTop}
          stroke={colors.nightPageGold}
          strokeWidth={D.pageStarWidth}
        />
        <Circle cx={half} cy={half} r={D.pageStarHeart} fill={colors.nightPageGold} />
      </Svg>
    </View>
  );
}

function FollowBarSurface() {
  const colors = useColorValues();
  const id = `follow-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.followBarStart} />
          <Stop offset="1" stopColor={colors.followBarEnd} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={L.followHeight / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

interface ClockProps {
  readonly recitation: Recitation;
  readonly clock: SharedValue<number>;
  readonly toClock: ToClock;
}

function MushafWord({
  text,
  index,
  recitation,
  clock,
  toClock,
  textStyle,
  colors,
  onLayout,
}: ClockProps & {
  text: string;
  index: number;
  textStyle: object;
  colors: ColorValues;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const base = useAnimatedStyle(() => {
    const look = wordLook(recitation, index, toClock(clock.get()));
    return {
      opacity: look.ink,
      color: interpolateColor(look.gold, [0, 1], [colors.nightPageInk, colors.nightPageCurrent]),
    };
  });
  const red = useAnimatedStyle(() => ({
    opacity: wordLook(recitation, index, toClock(clock.get())).red,
  }));
  return (
    <View onLayout={onLayout}>
      <Animated.Text style={[textStyle, base]} accessibilityLanguage="ar">
        {text}
      </Animated.Text>
      {index === recitation.reread ? (
        <Animated.Text style={[textStyle, styles.overlay, { color: colors.nightPageReread }, red]}>
          {text}
        </Animated.Text>
      ) : null}
    </View>
  );
}

function pillTransform(box: WordBox) {
  'worklet';
  return [
    { translateX: box.x - L.pagePillPad },
    { translateY: box.y + (box.height - L.pagePillHeight) / 2 },
    { scaleX: (box.width + 2 * L.pagePillPad) / L.pillBaseWidth },
  ];
}

function ReadPill({
  boxes,
  color,
  ...clock
}: ClockProps & { boxes: SharedValue<WordBox[]>; color: string }) {
  const { recitation, clock: ms, toClock } = clock;
  const style = useAnimatedStyle(() => {
    const look = readPillLook(recitation, boxes.get(), toClock(ms.get()));
    return {
      opacity: boxes.get().length === 0 ? 0 : look.opacity,
      transform: pillTransform(look.box),
    };
  });
  return <Animated.View style={[styles.pill, { backgroundColor: color }, style]} />;
}

function StatePill({
  boxes,
  kind,
  color,
  edge,
  ...clock
}: ClockProps & {
  boxes: SharedValue<WordBox[]>;
  kind: 'reread' | 'fixed';
  color: string;
  edge?: string;
}) {
  const { recitation, clock: ms, toClock } = clock;
  const style = useAnimatedStyle(() => {
    const t = toClock(ms.get());
    const box = boxes.get()[recitation.reread];
    if (box === undefined) return { opacity: 0 };
    return {
      opacity: kind === 'reread' ? rereadAmount(recitation, t) : fixedAmount(recitation, t),
      transform: pillTransform(box),
    };
  });
  return (
    <Animated.View
      style={[
        styles.pill,
        { backgroundColor: color },
        edge === undefined
          ? null
          : { borderBottomWidth: D.pageRereadEdge, borderBottomColor: edge },
        style,
      ]}
    />
  );
}

function VerseSubtitle({
  verse,
  text,
  color,
  ...clock
}: ClockProps & { verse: number; text: string; color: string }) {
  const { recitation, clock: ms, toClock } = clock;
  const style = useAnimatedStyle(() => {
    const t = toClock(ms.get());
    const current = recitation.verses[currentWord(recitation, t)] ?? 1;
    const reread = rereadAmount(recitation, t);
    return {
      opacity: (current === verse ? 1 : 0) * (1 - reread),
      transform: [{ translateY: -L.subtitleTravel * reread }],
    };
  });
  return (
    <Animated.Text
      style={[textStyles.subhead, styles.subtitle, { color }, style]}
      numberOfLines={1}
    >
      {text}
    </Animated.Text>
  );
}

function RereadSubtitle({
  label,
  word,
  colors,
  ...clock
}: ClockProps & { label: string; word: string; colors: ColorValues }) {
  const { recitation, clock: ms, toClock } = clock;
  const style = useAnimatedStyle(() => {
    const reread = rereadAmount(recitation, toClock(ms.get()));
    return { opacity: reread, transform: [{ translateY: L.subtitleTravel * (1 - reread) }] };
  });
  return (
    <Animated.View style={[styles.subtitle, styles.rereadRow, style]}>
      <Text style={[textStyles.subhead, { color: colors.onFollowBarSecondary }]}>{label} </Text>
      <Text style={[styles.rereadWord, { color: colors.onFollowBar }]} accessibilityLanguage="ar">
        {word}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    start: L.pageInset,
    end: L.pageInset,
    borderRadius: L.pageRadius,
    paddingBottom: L.pageBottomPad,
    transformOrigin: '50% 40%',
  },
  frame: {
    position: 'absolute',
    top: L.pageFrameInset,
    bottom: L.pageFrameInset,
    start: L.pageFrameInset,
    end: L.pageFrameInset,
    borderWidth: 1,
    borderRadius: L.pageFrameRadius,
  },
  frameInner: {
    position: 'absolute',
    top: L.pageFrameGap,
    bottom: L.pageFrameGap,
    start: L.pageFrameGap,
    end: L.pageFrameGap,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: D.pageFrameInnerRadius,
  },
  corner: { position: 'absolute', width: L.pageCorner, height: L.pageCorner },
  cornerTopStart: { top: D.pageCornerOffset, start: D.pageCornerOffset },
  cornerTopEnd: { top: D.pageCornerOffset, end: D.pageCornerOffset },
  cornerBottomStart: { bottom: D.pageCornerOffset, start: D.pageCornerOffset },
  cornerBottomEnd: { bottom: D.pageCornerOffset, end: D.pageCornerOffset },
  head: {
    marginTop: L.pageHeadTop,
    marginBottom: D.pageHeadBottom,
    alignSelf: 'center',
    width: `${L.pageHeadWidthShare * 100}%`,
    height: L.pageHeadHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { fontFamily: fontFamily.quranTitle, fontSize: L.pageHeadTextSize },
  lines: { paddingHorizontal: L.pagePadding, paddingTop: D.pageLinesTop },
  // A line of the mushaf reads right to left in every interface.
  row: { flexDirection: 'row', direction: 'rtl', justifyContent: 'center' },
  wordGroup: { flexDirection: 'row', direction: 'rtl', alignItems: 'center', gap: D.pageMarkGap },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: L.pillBaseWidth,
    height: L.pagePillHeight,
    borderRadius: L.pagePillRadius,
    transformOrigin: 'left',
  },
  follow: {
    position: 'absolute',
    start: L.followInset,
    end: L.followInset,
    height: L.followHeight,
    borderRadius: L.followHeight / 2,
  },
  followText: {
    position: 'absolute',
    start: L.followTextStart,
    end: L.followTextEnd,
    top: D.followTextTop,
  },
  followTitle: { lineHeight: D.followLineHeight },
  followSub: { height: D.followLineHeight },
  subtitle: { position: 'absolute', start: 0, top: 0, lineHeight: D.followLineHeight },
  rereadRow: { flexDirection: 'row', alignItems: 'center' },
  rereadWord: {
    fontFamily: fontFamily.quran,
    fontSize: D.followWordSize,
    lineHeight: D.followLineHeight,
  },
});
