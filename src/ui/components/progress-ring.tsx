import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { pieceSizes, type GardenPaletteRole } from '../tokens';
import { useColors } from '../use-colors';

export interface ProgressRingProps {
  /** From 0 to 1; values outside are refused. */
  progress: number;
  /** `large`: the ring of the day's watering. `small`: the ring of the label over the garden. */
  size: 'large' | 'small';
  /** `water`: teal on a pale teal track. `growth`: green on a pale green track. */
  tone: 'water' | 'growth';
  /** What the ring measures, for screen readers: "Arrosage du jour". */
  accessibilityLabel: string;
  /** The value in words: "5 pages sur 8". Screen readers say it instead of a percentage. */
  accessibilityValue: string;
  /** A symbol in the middle. */
  children?: ReactNode;
  testID?: string;
}

const TONES: Readonly<
  Record<ProgressRingProps['tone'], { fill: GardenPaletteRole; track: GardenPaletteRole }>
> = {
  water: { fill: 'waterFill', track: 'waterTrack' },
  growth: { fill: 'actionTint', track: 'actionTonal' },
};

/**
 * A determinate circular progress, as in the validated mockups (accueil.png): a track that fills
 * clockwise from the top (progress-indicators.md: circular progress indicators fill clockwise).
 * It is a picture of a value always written beside it in words, never the only way to know it
 * (color.md › Inclusive color). Screen readers hear it as one progress element.
 */
export function ProgressRing({
  progress,
  size,
  tone,
  accessibilityLabel,
  accessibilityValue,
  children,
  testID,
}: ProgressRingProps) {
  if (!(progress >= 0 && progress <= 1)) {
    throw new RangeError(`ProgressRing: progress must be between 0 and 1, got ${progress}`);
  }
  const colors = useColors();
  const diameter = size === 'large' ? pieceSizes.ringLarge : pieceSizes.ringSmall;
  const stroke = size === 'large' ? pieceSizes.ringLargeStroke : pieceSizes.ringSmallStroke;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = diameter / 2;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValue }}
      style={[styles.ring, { width: diameter, height: diameter }]}
      testID={testID}
    >
      <Svg width={diameter} height={diameter} style={StyleSheet.absoluteFill}>
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={colors[TONES[tone].track]}
          strokeWidth={stroke}
          fill="none"
        />
        {progress > 0 ? (
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={colors[TONES[tone].fill]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            fill="none"
            // From the top, clockwise.
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
});
