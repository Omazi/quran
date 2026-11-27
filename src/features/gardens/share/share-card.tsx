import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colorValuesFor, fontFamily, shareCardShape } from '@/ui';

import { KhatmaBadge } from '../khatma-badge';
import type { ShareCardContent } from './share-card-content';

/** The icon of the app, as the home screen shows it. */
const APP_ICON: number = require('../../../../assets/images/icon.png');

export interface ShareCardProps {
  content: ShareCardContent;
  /** Points per design unit (`cardUnit`): the card is `shareCardShape.width` units wide. */
  unit: number;
  /** The app icon has been decoded: with the card laid out, the picture can be taken. */
  onIconLoad?: () => void;
  /** The icon could not be decoded: the card goes without it rather than not at all. */
  onIconError?: () => void;
}

const SHAPE = shareCardShape;

/**
 * The picture a person shares of a badge: portrait 1080 × 1350, light, on the warm paper of the
 * mushaf. The gold eight-pointed star with the garden inside and the number of the khatma, then
 * "Khatma n°3 terminée", the date, the three figures, the invocation, and the app. Always light
 * and never scaled by the text size: it is an image people post, not a screen they read in the
 * app (see `shareCardShape`). It follows the direction of the app's language, so the three figures
 * and the footer read from the right in Arabic. It is the only thing drawn here: capture is
 * `use-badge-share.tsx`'s job.
 */
export function ShareCard({ content, unit, onIconLoad, onIconError }: ShareCardProps) {
  const colors = colorValuesFor('light');
  const px = (units: number) => units * unit;
  const styles = useMemo(() => cardStyles(unit, colors), [unit, colors]);
  return (
    <View
      collapsable={false}
      style={styles.card}
      accessible
      accessibilityRole="image"
      accessibilityLabel={content.label}
      testID="share-card"
    >
      <Frame unit={unit} />
      <View style={styles.body}>
        <View style={styles.badge}>
          <Glow unit={unit} />
          <KhatmaBadge
            view={{
              kind: 'earned',
              khatm: content.khatm,
              styleId: content.styleId,
              completedOn: content.completedOn,
            }}
            size={px(SHAPE.badgeSize)}
            appearance="light"
          />
        </View>
        <Text allowFontScaling={false} style={styles.garden}>
          {content.garden}
        </Text>
        <Text allowFontScaling={false} style={styles.title}>
          {content.title}
        </Text>
        {content.name === null ? null : (
          <Text allowFontScaling={false} style={styles.name} testID="share-card-name">
            {content.name}
          </Text>
        )}
        <Text allowFontScaling={false} style={styles.date}>
          {content.date}
        </Text>
        <View style={styles.figures}>
          {content.figures.map((figure, index) => (
            <View key={figure.label} style={styles.figureCell}>
              {index === 0 ? null : <View style={styles.figureDivider} />}
              <View style={styles.figure}>
                <Text allowFontScaling={false} style={styles.figureValue}>
                  {figure.value}
                </Text>
                <Text allowFontScaling={false} style={styles.figureLabel}>
                  {figure.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
        {content.dua === null ? null : (
          <Text
            allowFontScaling={false}
            accessibilityLanguage="ar"
            style={styles.dua}
            testID="share-card-dua"
          >
            {content.dua}
          </Text>
        )}
      </View>
      <View style={styles.footer}>
        <Image
          source={APP_ICON}
          style={styles.icon}
          contentFit="cover"
          cachePolicy="memory"
          onLoad={onIconLoad}
          onError={onIconError}
          testID="share-card-icon"
          accessible={false}
        />
        <Text allowFontScaling={false} style={styles.appName}>
          {content.appName}
        </Text>
      </View>
    </View>
  );
}

/** The two gold rules of the frame, as the mushaf's page has them. */
function Frame({ unit }: { unit: number }) {
  const colors = colorValuesFor('light');
  const { width, height } = SHAPE;
  const outer = SHAPE.frameOuterInset;
  const inner = SHAPE.frameInnerInset;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Svg width={width * unit} height={height * unit} viewBox={`0 0 ${width} ${height}`}>
        <Rect
          x={outer}
          y={outer}
          width={width - 2 * outer}
          height={height - 2 * outer}
          fill="none"
          stroke={colors.ornamentLine}
          strokeWidth={SHAPE.frameOuterWidth}
        />
        <Rect
          x={inner}
          y={inner}
          width={width - 2 * inner}
          height={height - 2 * inner}
          fill="none"
          stroke={colors.ornamentLine}
          strokeWidth={SHAPE.frameInnerWidth}
        />
      </Svg>
    </View>
  );
}

/** A soft gold glow, centred on the badge it sits in and spilling past its box. */
function Glow({ unit }: { unit: number }) {
  const colors = colorValuesFor('light');
  const diameter = SHAPE.glowRadius * 2;
  const offset = (SHAPE.badgeSize - diameter) / 2;
  return (
    <View
      style={{
        position: 'absolute',
        width: diameter * unit,
        height: diameter * unit,
        top: offset * unit,
        start: offset * unit,
      }}
      pointerEvents="none"
      accessible={false}
    >
      <Svg width={diameter * unit} height={diameter * unit} viewBox={`0 0 ${diameter} ${diameter}`}>
        <Defs>
          <RadialGradient
            id="share-glow"
            cx={diameter / 2}
            cy={diameter / 2}
            r={diameter / 2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.goldLight} stopOpacity={0.55} />
            <Stop offset="0.55" stopColor={colors.goldLight} stopOpacity={0.18} />
            <Stop offset="1" stopColor={colors.goldLight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2} fill="url(#share-glow)" />
      </Svg>
    </View>
  );
}

function cardStyles(unit: number, colors: ReturnType<typeof colorValuesFor>) {
  const px = (units: number) => units * unit;
  return StyleSheet.create({
    card: {
      width: px(SHAPE.width),
      height: px(SHAPE.height),
      backgroundColor: colors.paper,
      alignItems: 'center',
      overflow: 'hidden',
    },
    body: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: px(SHAPE.bodyPaddingTop),
      paddingBottom: px(SHAPE.bodyPaddingBottom),
    },
    badge: { width: px(SHAPE.badgeSize), height: px(SHAPE.badgeSize) },
    garden: {
      marginTop: px(SHAPE.gapBadgeToGarden),
      fontFamily: fontFamily.display,
      fontWeight: '600',
      fontSize: px(SHAPE.gardenSize),
      lineHeight: px(SHAPE.gardenLineHeight),
      color: colors.ornament,
      textAlign: 'center',
    },
    title: {
      marginTop: px(SHAPE.gapGardenToTitle),
      fontFamily: fontFamily.display,
      fontWeight: '600',
      fontSize: px(SHAPE.titleSize),
      lineHeight: px(SHAPE.titleLineHeight),
      color: colors.heading,
      textAlign: 'center',
    },
    name: {
      marginTop: px(SHAPE.gapTitleToDate),
      fontFamily: fontFamily.display,
      fontWeight: '600',
      fontSize: px(SHAPE.nameSize),
      lineHeight: px(SHAPE.nameLineHeight),
      color: colors.heading,
      textAlign: 'center',
    },
    date: {
      marginTop: px(SHAPE.gapTitleToDate),
      fontSize: px(SHAPE.dateSize),
      lineHeight: px(SHAPE.dateLineHeight),
      color: colors.muted,
      textAlign: 'center',
    },
    figures: {
      marginTop: px(SHAPE.gapDateToFigures),
      width: px(SHAPE.figuresWidth),
      flexDirection: 'row',
      alignItems: 'center',
    },
    figureCell: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    figure: { flex: 1, alignItems: 'center' },
    figureDivider: {
      width: px(SHAPE.figureDividerWidth),
      height: px(SHAPE.figureDividerHeight),
      backgroundColor: colors.ornamentLine,
    },
    figureValue: {
      fontFamily: fontFamily.display,
      fontWeight: '600',
      fontSize: px(SHAPE.figureSize),
      lineHeight: px(SHAPE.figureLineHeight),
      color: colors.heading,
      textAlign: 'center',
    },
    figureLabel: {
      fontSize: px(SHAPE.figureLabelSize),
      lineHeight: px(SHAPE.figureLabelLineHeight),
      color: colors.muted,
      textAlign: 'center',
    },
    dua: {
      fontFamily: fontFamily.quranTitle,
      marginTop: px(SHAPE.gapFiguresToDua),
      fontSize: px(SHAPE.duaSize),
      lineHeight: px(SHAPE.duaLineHeight),
      color: colors.ornament,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    footer: {
      position: 'absolute',
      bottom: px(SHAPE.footerBottom),
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: px(SHAPE.footerGap),
    },
    icon: {
      width: px(SHAPE.appIconSize),
      height: px(SHAPE.appIconSize),
      borderRadius: px(SHAPE.appIconSize * SHAPE.appIconRadiusShare),
    },
    appName: {
      fontFamily: fontFamily.display,
      fontWeight: '600',
      fontSize: px(SHAPE.appNameSize),
      lineHeight: px(SHAPE.appNameLineHeight),
      color: colors.heading,
    },
  });
}
