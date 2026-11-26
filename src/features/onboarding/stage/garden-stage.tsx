import { Image } from 'expo-image';
import { useEffect, useId, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Image as SvgImage, Path } from 'react-native-svg';

import { GARDEN_PICTURE_PIXELS, baseAsset, riseAsset, waterAsset } from '@/features/garden';
import {
  AppText,
  radius,
  useColorValues,
  useColors,
  useElevation,
  voiceStoryLayout as L,
} from '@/ui';

import { FOUNTAIN, REVIVAL_ELLIPSE, STORY_MOTION } from '../config';
import { crackGroups } from '../cracks';
import type { PreviewStage } from '../preview-stage';
import type { StageCaption, StageGarden } from '../pages';
import {
  captionOpacity,
  crackGroupOpacity,
  crackLook,
  easeOut,
  gardenLayerLook,
  gardenLook,
  gardenPresence,
  revivalLook,
  waterFlow,
} from '../story-math';
import { isNear, type StageProps } from './stage-props';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The pictures of each garden of the story (the prototype's `GS`): dry, still water, flowing. */
interface StagePictures {
  readonly base: string;
  readonly still?: string;
  readonly flowing?: string;
}

const STORY_PICTURES: Readonly<Record<Exclude<StageGarden, 'preview'>, StagePictures>> = {
  g0: { base: 'h00-f0' },
  g8: { base: 'h08-f0', still: 'h08-f0-w1', flowing: 'h08-f0-w2' },
  g20: { base: 'h20-f0', still: 'h20-f0-w1', flowing: 'h20-f0-w2' },
  g30: { base: 'h30-f0', still: 'h30-f0-w1', flowing: 'h30-f0-w2' },
  g40: { base: 'h40-f0', still: 'h40-f0-w1', flowing: 'h40-f0-w2' },
  g60: { base: 'h60-f0', still: 'h60-f0-w1', flowing: 'h60-f0-w2' },
  d3: { base: 'h60-f1', still: 'h60-f1-w1' },
  d6: { base: 'h60-f2' },
  d10: { base: 'h60-f3' },
  d14: { base: 'h00-f3' },
};

/** What a stage garden adds alone (tools/garden-pictures/rise-layers.py): its hizb. */
const RISE_HIZB: Readonly<Partial<Record<StageGarden, number>>> = {
  g8: 8,
  g20: 20,
  g30: 30,
  g40: 40,
  g60: 60,
};

/** The layers of the garden, bottom to top: each new stage lies over the one it grows from. */
const LAYER_ORDER = [
  'g0',
  'rise:g8',
  'g8',
  'rise:g20',
  'g20',
  'rise:g30',
  'g30',
  'rise:g40',
  'g40',
  'rise:g60',
  'g60',
  'd3',
  'd6',
  'd10',
  'd14',
  'revival',
  'preview',
] as const;

type LayerKey = (typeof LAYER_ORDER)[number];

/** The picture of the preview garden at a stage: the garden with its water flowing. */
function previewPictures(stage: PreviewStage): StagePictures {
  const base = `h${String(stage).padStart(2, '0')}-f0`;
  return stage === 0 ? { base } : { base, flowing: `${base}-w2` };
}

/** The layers the pages around `pageIndex` may show: nothing else is decoded (memory). */
function layersNear(gardens: readonly (StageGarden | null)[], pageIndex: number): Set<LayerKey> {
  const keys = new Set<LayerKey>();
  for (let page = pageIndex - 2; page <= pageIndex + 2; page += 1) {
    const garden = gardens[page];
    if (garden === undefined || garden === null) continue;
    keys.add(garden);
    if (RISE_HIZB[garden] !== undefined) keys.add(`rise:${garden}` as LayerKey);
  }
  if (keys.has('d14') && keys.has('g60')) keys.add('revival');
  return keys;
}

export interface GardenStageProps extends StageProps {
  /** The stage of the garden a month from now, from the chosen goal. */
  readonly previewStage: PreviewStage;
}

/**
 * The garden of the story (`#garden`): pictures of the shipped garden, laid one over the other and
 * shown, risen and faded by the position (pages.ts, story-math.ts). The whole garden moves and
 * turns a few degrees per page (the camera walking around it) with transforms only; the cracks of
 * the drought and the rings of the returning water are drawn on the picture, so they turn with it.
 * No GL in the pager (owner's decision): pictures only. Decorative: each page describes its garden
 * to screen readers.
 */
export function GardenStage(props: GardenStageProps) {
  const { position, engine, layout, pages, marks, pageIndex, reducedMotion, previewStage } = props;
  const gardens = useMemo(() => pages.map((page) => page.garden), [pages]);
  const preview = {
    lift: layout.previewLift,
    goalScale: layout.goalScale,
    remindersScale: layout.remindersScale,
  };
  const near = layersNear(gardens, pageIndex);
  const crackPages = pages.some((page, index) => page.isDry && isNear(pageIndex, index, 2));
  const box = layout.garden;
  const look = useAnimatedStyle(() => {
    const garden = gardenLook(position.get(), pages, marks, preview, reducedMotion);
    const arrival = reducedMotion ? 1 : easeOut(engine.introMs.get() / STORY_MOTION.introMs);
    return {
      opacity: garden.opacity * arrival,
      transform: [
        { translateY: garden.translateY },
        { scale: garden.scale },
        { perspective: STORY_MOTION.perspective },
        { rotateY: `${garden.turn}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.garden,
        { left: box.left, top: box.top, width: box.width, height: box.height },
        look,
      ]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="onboarding-garden"
    >
      {LAYER_ORDER.filter((key) => near.has(key) || key === 'preview').map((key) => (
        <GardenLayer
          key={key}
          layer={key}
          gardens={gardens}
          position={position}
          level={engine.level}
          reducedMotion={reducedMotion}
          previewStage={previewStage}
          showPreview={pageIndex >= marks.friends - 1}
        />
      ))}
      {crackPages || near.has('revival') ? (
        <EarthMarks gardens={gardens} position={position} reducedMotion={reducedMotion} />
      ) : null}
    </Animated.View>
  );
}

interface GardenLayerProps {
  readonly layer: LayerKey;
  readonly gardens: readonly (StageGarden | null)[];
  readonly position: SharedValue<number>;
  readonly level: SharedValue<number>;
  readonly reducedMotion: boolean;
  readonly previewStage: PreviewStage;
  readonly showPreview: boolean;
}

function GardenLayer({
  layer,
  gardens,
  position,
  level,
  reducedMotion,
  previewStage,
  showPreview,
}: GardenLayerProps) {
  const isRise = layer.startsWith('rise:');
  const style = useAnimatedStyle(() => {
    const look = gardenLayerLook(layer, gardens, position.get(), L.riseTravel, reducedMotion);
    return {
      opacity: look.opacity,
      transform: [{ translateY: look.translateY }, { scaleY: look.scaleY }],
    };
  });
  let content: React.ReactNode = null;
  if (layer === 'preview') {
    content = showPreview ? <PreviewPictures stage={previewStage} level={level} /> : null;
  } else if (layer === 'revival') {
    content = (
      <RevivalPictures
        gardens={gardens}
        position={position}
        level={level}
        reducedMotion={reducedMotion}
      />
    );
  } else if (isRise) {
    const hizb = RISE_HIZB[layer.slice('rise:'.length) as StageGarden];
    const asset = hizb === undefined ? undefined : riseAsset(hizb);
    content = asset === undefined ? null : <Picture asset={asset} />;
  } else {
    // The keys left once the preview, the revival and the rise layers are handled: story gardens.
    content = (
      <Pictures pictures={STORY_PICTURES[layer as Exclude<StageGarden, 'preview'>]} level={level} />
    );
  }
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, isRise && styles.fromGround, style]}
      testID={`onboarding-garden-${layer}`}
    >
      {content}
    </Animated.View>
  );
}

function Picture({ asset }: { asset: number }) {
  return (
    <Image
      source={asset}
      style={StyleSheet.absoluteFill}
      contentFit="fill"
      accessible={false}
      cachePolicy="memory"
      transition={null}
    />
  );
}

/** A garden picture with its water: still water always, flowing water as loud as the voice. */
function Pictures({
  pictures,
  level,
  isAlwaysFlowing = false,
}: {
  pictures: StagePictures;
  level: SharedValue<number>;
  /** The preview garden's water always flows: it is the garden as it will be (`pv`). */
  isAlwaysFlowing?: boolean;
}) {
  const flow = useAnimatedStyle(() => ({ opacity: isAlwaysFlowing ? 1 : waterFlow(level.get()) }));
  const base = baseAsset(pictures.base);
  const still = pictures.still === undefined ? undefined : waterAsset(pictures.still);
  const flowing = pictures.flowing === undefined ? undefined : waterAsset(pictures.flowing);
  return (
    <>
      {base === undefined ? null : <Picture asset={base} />}
      {still === undefined ? null : <Picture asset={still} />}
      {flowing === undefined ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, flow]}>
          <Picture asset={flowing} />
        </Animated.View>
      )}
    </>
  );
}

/**
 * The garden of the chosen goal: when the goal changes, the new garden fades in over the old one
 * (the prototype's two stacks, 450 ms), then the old one goes.
 */
function PreviewPictures({ stage, level }: { stage: PreviewStage; level: SharedValue<number> }) {
  const [shown, setShown] = useState<readonly PreviewStage[]>([stage]);
  // A new goal: its garden comes over the one shown (adjusting state as the prop changes).
  const latest = shown[shown.length - 1];
  if (latest !== stage) setShown(latest === undefined ? [stage] : [latest, stage]);
  useEffect(() => {
    if (shown.length < 2) return undefined;
    const timer = setTimeout(
      () => setShown((current) => current.slice(-1)),
      STORY_MOTION.previewFadeMs,
    );
    return () => clearTimeout(timer);
  }, [shown]);
  return (
    <>
      {shown.map((item, index) => (
        <FadingIn key={item} isNew={index > 0}>
          <Pictures pictures={previewPictures(item)} level={level} isAlwaysFlowing />
        </FadingIn>
      ))}
    </>
  );
}

function FadingIn({ isNew, children }: { isNew: boolean; children: React.ReactNode }) {
  const opacity = useSharedValue(isNew ? 0 : 1);
  useEffect(() => {
    opacity.set(
      withTiming(1, { duration: STORY_MOTION.previewFadeMs, easing: Easing.out(Easing.quad) }),
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

/**
 * The revival: the complete garden, cut to an ellipse that grows from the fountain, over the dead
 * earth (`clip-path: ellipse(…)`). An SVG clip, since a view cannot be cut to an ellipse.
 */
function RevivalPictures({
  gardens,
  position,
  level,
  reducedMotion,
}: {
  gardens: readonly (StageGarden | null)[];
  position: SharedValue<number>;
  level: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const id = `revival-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const { width, height } = GARDEN_PICTURE_PIXELS;
  const clip = useAnimatedProps(() => {
    const look = revivalLook(gardens, position.get(), reducedMotion);
    const reach = look === null ? 4 : look.reach;
    return {
      rx: width * REVIVAL_ELLIPSE.rxShare * reach,
      ry: height * REVIVAL_ELLIPSE.ryShare * reach,
    };
  });
  const flow = useAnimatedProps(() => ({ opacity: waterFlow(level.get()) }));
  const pictures = STORY_PICTURES.g60;
  const asset = (name: string | undefined, water: boolean) =>
    name === undefined ? undefined : water ? waterAsset(name) : baseAsset(name);
  const base = asset(pictures.base, false);
  const still = asset(pictures.still, true);
  const flowing = asset(pictures.flowing, true);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Defs>
        <ClipPath id={id}>
          <AnimatedEllipse
            cx={width * REVIVAL_ELLIPSE.cxShare}
            cy={height * REVIVAL_ELLIPSE.cyShare}
            animatedProps={clip}
          />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        {base === undefined ? null : <SvgImage href={base} width={width} height={height} />}
        {still === undefined ? null : <SvgImage href={still} width={width} height={height} />}
        {flowing === undefined ? null : (
          <AnimatedG animatedProps={flow}>
            <SvgImage href={flowing} width={width} height={height} />
          </AnimatedG>
        )}
      </G>
    </Svg>
  );
}

const AnimatedG = Animated.createAnimatedComponent(G);

/** The cracks of the drying earth and the two rings of the water's return, on the picture. */
function EarthMarks({
  gardens,
  position,
  reducedMotion,
}: {
  gardens: readonly (StageGarden | null)[];
  position: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const colors = useColorValues();
  const groups = useMemo(() => crackGroups(), []);
  const { width, height } = GARDEN_PICTURE_PIXELS;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      {groups.map((group) => (
        <Crack
          key={group.at}
          at={group.at}
          path={group.path}
          position={position}
          color={colors.crack}
          reducedMotion={reducedMotion}
        />
      ))}
      <Ring
        gardens={gardens}
        position={position}
        reducedMotion={reducedMotion}
        color={colors.revivalRing}
        which={1}
      />
      <Ring
        gardens={gardens}
        position={position}
        reducedMotion={reducedMotion}
        color={colors.revivalRingSoft}
        which={2}
      />
    </Svg>
  );
}

function Crack({
  at,
  path,
  position,
  color,
  reducedMotion,
}: {
  at: number;
  path: string;
  position: SharedValue<number>;
  color: string;
  reducedMotion: boolean;
}) {
  const props = useAnimatedProps(() => {
    const look = crackLook(position.get());
    return { strokeOpacity: look.opacity * crackGroupOpacity(at, look.progress, reducedMotion) };
  });
  return (
    <AnimatedPath
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={L.crackWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      animatedProps={props}
    />
  );
}

function Ring({
  gardens,
  position,
  reducedMotion,
  color,
  which,
}: {
  gardens: readonly (StageGarden | null)[];
  position: SharedValue<number>;
  reducedMotion: boolean;
  color: string;
  which: 1 | 2;
}) {
  const props = useAnimatedProps(() => {
    const look = revivalLook(gardens, position.get(), reducedMotion);
    if (look === null) return { rx: 0, ry: 0, strokeOpacity: 0 };
    const scale = which === 1 ? look.ring : look.ring2;
    return {
      rx: FOUNTAIN.rx * scale,
      ry: FOUNTAIN.ry * scale,
      strokeOpacity: which === 1 ? look.ringOpacity : look.ring2Opacity,
    };
  });
  return (
    <AnimatedEllipse
      cx={FOUNTAIN.cx}
      cy={FOUNTAIN.cy}
      fill="none"
      stroke={color}
      strokeWidth={which === 1 ? L.ringWidth : L.ringSoftWidth}
      animatedProps={props}
    />
  );
}

/** The caption over the garden (`.cap`), one per distinct words, fading as the pages pass. */
export function StageCaptions({
  position,
  layout,
  pages,
  marks,
  previewHizb,
}: StageProps & { previewHizb: number }) {
  const { t } = useTranslation('onboarding');
  const captions = useMemo(() => {
    const byWords = new Map<
      string,
      { words: string; pages: number[]; isDry: boolean; isPreview: boolean }
    >();
    pages.forEach((page, index) => {
      if (page.caption === null) return;
      const words = captionWords(page.caption, t, previewHizb);
      const entry = byWords.get(words) ?? {
        words,
        pages: [],
        isDry: page.isDry,
        isPreview: page.caption.kind === 'preview',
      };
      entry.pages.push(index);
      byWords.set(words, entry);
    });
    return [...byWords.values()];
  }, [pages, t, previewHizb]);
  return (
    <>
      {captions.map((caption) => (
        <Caption
          key={caption.words}
          words={caption.words}
          pagesOf={caption.pages}
          pageCount={pages.length}
          isDry={caption.isDry}
          top={layout.garden.top + L.captionTop + (caption.isPreview ? layout.previewLift - 2 : 0)}
          position={position}
          marks={marks}
        />
      ))}
    </>
  );
}

function captionWords(
  caption: StageCaption,
  t: TFunction<'onboarding'>,
  previewHizb: number,
): string {
  switch (caption.kind) {
    case 'hizb':
      return t('captions.hizb', { hizb: caption.hizb });
    case 'drought':
      return t('captions.drought', { count: caption.days });
    case 'revival':
      return t('captions.revival');
    case 'preview':
      return t('captions.preview', { hizb: previewHizb });
  }
}

function Caption({
  words,
  pagesOf,
  pageCount,
  isDry,
  top,
  position,
  marks,
}: {
  words: string;
  pagesOf: readonly number[];
  pageCount: number;
  isDry: boolean;
  top: number;
  position: SharedValue<number>;
  marks: StageProps['marks'];
}) {
  const colors = useColors();
  const shadow = useElevation('card');
  const style = useAnimatedStyle(() => ({
    opacity:
      captionOpacity(pagesOf, pageCount, position.get()) * gardenPresence(position.get(), marks),
  }));
  return (
    <Animated.View
      style={[
        styles.caption,
        { top, backgroundColor: colors.pillSurface, boxShadow: shadow },
        style,
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[styles.captionDot, { backgroundColor: isDry ? colors.thirstIcon : colors.water }]}
      />
      <AppText variant="subheadEmphasized" color="heading" numberOfLines={1}>
        {words}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  garden: { position: 'absolute', transformOrigin: 'top' },
  fromGround: { transformOrigin: 'bottom' },
  caption: {
    position: 'absolute',
    start: L.captionStart,
    minHeight: L.captionHeight,
    paddingHorizontal: L.captionPadding,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: L.captionGap,
  },
  captionDot: { width: L.captionDot, height: L.captionDot, borderRadius: L.captionDot / 2 },
});
