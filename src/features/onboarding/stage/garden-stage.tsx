import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

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
  crackLayerOpacity,
  gardenLayerLook,
  gardenLook,
  gardenPresence,
  revivalLook,
  springT,
  waterFlow,
} from '../story-math';
import { isNear, type StageProps } from './stage-props';


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
    // The first page arrives on the 0.9 s spring (motion spec §2): opacity, 14 points, 97 %.
    const arrival = reducedMotion
      ? 1
      : springT(engine.introMs.get() / 1000, STORY_MOTION.introResponseS);
    const translateY = garden.translateY + (1 - arrival) * L.introGardenRise;
    const scale = garden.scale * (L.introGardenScale + (1 - L.introGardenScale) * arrival);
    // A 3D transform makes the picture's mask expensive: dropped when the camera is straight
    // (the revival, the only page that masks the garden, is straight; motion spec §0.7).
    if (Math.abs(garden.turn) < 0.01) {
      return { opacity: garden.opacity * arrival, transform: [{ translateY }, { scale }] };
    }
    return {
      opacity: garden.opacity * arrival,
      transform: [
        { translateY },
        { scale },
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
          box={box}
          gardens={gardens}
          position={position}
          level={engine.level}
          reducedMotion={reducedMotion}
          previewStage={previewStage}
          showPreview={pageIndex >= marks.friends - 1}
        />
      ))}
      {crackPages ? <Cracks position={position} reducedMotion={reducedMotion} /> : null}
      {near.has('revival') && !reducedMotion ? (
        <RevivalRings gardens={gardens} position={position} box={box} />
      ) : null}
    </Animated.View>
  );
}

interface GardenLayerProps {
  readonly layer: LayerKey;
  readonly box: { readonly width: number; readonly height: number };
  readonly gardens: readonly (StageGarden | null)[];
  readonly position: SharedValue<number>;
  readonly level: SharedValue<number>;
  readonly reducedMotion: boolean;
  readonly previewStage: PreviewStage;
  readonly showPreview: boolean;
}

function GardenLayer({
  layer,
  box,
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
        box={box}
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

/** The revival's ellipse in the garden's box: its centre and its radii once it covers everything. */
function revivalEllipse(box: { width: number; height: number }) {
  const reach = STORY_MOTION.revivalReach * STORY_MOTION.revivalOvershoot;
  return {
    cx: box.width * REVIVAL_ELLIPSE.cxShare,
    cy: box.height * REVIVAL_ELLIPSE.cyShare,
    rx: box.width * REVIVAL_ELLIPSE.rxShare * reach,
    ry: box.height * REVIVAL_ELLIPSE.ryShare * reach,
  };
}

/**
 * The revival: the complete garden seen through an ellipse that grows from the fountain, over the
 * dead earth (motion spec §5). Transforms only: the mask is a round view squashed to the ellipse
 * and scaled up, and the picture inside it is scaled by the inverse, so it stays in place.
 */
function RevivalPictures({
  gardens,
  position,
  level,
  reducedMotion,
  box,
}: {
  gardens: readonly (StageGarden | null)[];
  position: SharedValue<number>;
  level: SharedValue<number>;
  reducedMotion: boolean;
  box: { width: number; height: number };
}) {
  const { cx, cy, rx, ry } = revivalEllipse(box);
  const squash = ry / rx;
  const reachOf = (pos: number) => {
    'worklet';
    const look = revivalLook(gardens, pos, reducedMotion);
    if (look === null) return null;
    return Math.max(0.02, look.reach / (STORY_MOTION.revivalReach * STORY_MOTION.revivalOvershoot));
  };
  const mask = useAnimatedStyle(() => {
    const scale = reachOf(position.get());
    if (scale === null) return { opacity: 0, transform: [{ scaleX: 1 }, { scaleY: squash }] };
    return { opacity: 1, transform: [{ scaleX: scale }, { scaleY: scale * squash }] };
  });
  const inner = useAnimatedStyle(() => {
    const scale = reachOf(position.get()) ?? 1;
    return { transform: [{ scaleX: 1 / scale }, { scaleY: 1 / (scale * squash) }] };
  });
  return (
    <Animated.View
      style={[
        styles.revivalMask,
        { left: cx - rx, top: cy - rx, width: 2 * rx, height: 2 * rx, borderRadius: rx },
        mask,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: rx - cx,
            top: rx - cy,
            width: box.width,
            height: box.height,
            transformOrigin: [cx, cy, 0],
          },
          inner,
        ]}
      >
        <Pictures pictures={STORY_PICTURES.g60} level={level} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The cracks of the drying earth, in the motion spec's eight layers (§5): each layer is drawn
 * once, on the picture so that it turns with it, and shown by its own opacity.
 */
function Cracks({
  position,
  reducedMotion,
}: {
  position: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const colors = useColorValues();
  const groups = useMemo(() => crackGroups(), []);
  return (
    <>
      {groups.map((group) => (
        <CrackLayer
          key={group.layer}
          layer={group.layer}
          path={group.path}
          position={position}
          color={colors.crack}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

function CrackLayer({
  layer,
  path,
  position,
  color,
  reducedMotion,
}: {
  layer: number;
  path: string;
  position: SharedValue<number>;
  color: string;
  reducedMotion: boolean;
}) {
  const { width, height } = GARDEN_PICTURE_PIXELS;
  const style = useAnimatedStyle(() => ({
    opacity: crackLayerOpacity(layer, position.get(), reducedMotion),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={L.crackWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The two rings of water that leave the fountain ahead of the green (motion spec §5): round views
 * squashed to the fountain's ellipse and scaled up, transform and opacity only.
 */
function RevivalRings({
  gardens,
  position,
  box,
}: {
  gardens: readonly (StageGarden | null)[];
  position: SharedValue<number>;
  box: { width: number; height: number };
}) {
  const colors = useColorValues();
  return (
    <>
      <Ring gardens={gardens} position={position} box={box} color={colors.revivalRing} which={1} />
      <Ring
        gardens={gardens}
        position={position}
        box={box}
        color={colors.revivalRingSoft}
        which={2}
      />
    </>
  );
}

function Ring({
  gardens,
  position,
  box,
  color,
  which,
}: {
  gardens: readonly (StageGarden | null)[];
  position: SharedValue<number>;
  box: { width: number; height: number };
  color: string;
  which: 1 | 2;
}) {
  const kx = box.width / GARDEN_PICTURE_PIXELS.width;
  const ky = box.height / GARDEN_PICTURE_PIXELS.height;
  const rx = FOUNTAIN.rx * kx;
  const squash = (FOUNTAIN.ry * ky) / rx;
  const style = useAnimatedStyle(() => {
    const look = revivalLook(gardens, position.get(), false);
    if (look === null) return { opacity: 0, transform: [{ scaleX: 0 }, { scaleY: 0 }] };
    const scale = which === 1 ? look.ring : look.ring2;
    return {
      opacity: which === 1 ? look.ringOpacity : look.ring2Opacity,
      transform: [{ scaleX: scale }, { scaleY: scale * squash }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.ring,
        {
          left: FOUNTAIN.cx * kx - rx,
          top: FOUNTAIN.cy * ky - rx,
          width: 2 * rx,
          height: 2 * rx,
          borderRadius: rx,
          borderWidth: (which === 1 ? L.ringWidth : L.ringSoftWidth) * kx,
          borderColor: color,
        },
        style,
      ]}
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
  revivalMask: { position: 'absolute', overflow: 'hidden' },
  ring: { position: 'absolute' },
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
