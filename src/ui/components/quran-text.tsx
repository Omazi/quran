import { StyleSheet, Text, View } from 'react-native';

import { quranTextStyles, type QuranTextStyleName } from '../tokens';
import { useColors } from '../use-colors';

/** One run of a Quran text: words, or a verse mark, which the mushaf draws in its ornament. */
export interface QuranTextRun {
  readonly text: string;
  readonly isVerseMark?: boolean;
}

export interface QuranTextProps {
  /** The text exactly as the data layer gives it, cut only between whole runs. */
  runs: readonly QuranTextRun[];
  variant: QuranTextStyleName;
  /** `center` for a verse read on its own; `start` (the right edge) for a line in a row. */
  align?: 'center' | 'start';
  /** What a screen reader says; defaults to the runs joined by spaces. */
  accessibilityLabel?: string;
  /** A title of the screen: screen readers can move to it (voiceover.md › Navigation). */
  isHeading?: boolean;
  testID?: string;
}

/**
 * Quran text outside the mushaf page: the bundled font, ink, and a verse mark in the ornament
 * colour, as the reader draws them. The text is never changed: runs are joined by a space, the
 * separator of the data. It always reads right to left, whatever the language of the interface
 * (right-to-left.md › Text alignment: a paragraph aligns according to its own language), and
 * screen readers read it in Arabic.
 *
 * Show it only once the Quran font is loaded (`useQuranFont`): never in another font.
 */
export function QuranText({
  runs,
  variant,
  align = 'center',
  accessibilityLabel,
  isHeading = false,
  testID,
}: QuranTextProps) {
  const colors = useColors();
  const { fontFamily, fontSize, lineHeight, ramp } = quranTextStyles[variant];
  return (
    <View style={styles.rightToLeft}>
      <Text
        accessibilityLanguage="ar"
        accessibilityRole={isHeading ? 'header' : undefined}
        accessibilityLabel={accessibilityLabel ?? runs.map((run) => run.text).join(' ')}
        dynamicTypeRamp={ramp}
        testID={testID}
        style={[
          styles.text,
          { fontFamily, fontSize, lineHeight, color: colors.ink },
          align === 'center' ? styles.centre : styles.start,
        ]}
      >
        {runs.map((run, index) => (
          <Text key={index} style={run.isVerseMark ? { color: colors.ornament } : undefined}>
            {index === 0 ? run.text : ` ${run.text}`}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The block is laid out right to left, so `start` is its right edge in every interface.
  rightToLeft: { direction: 'rtl' },
  text: { writingDirection: 'rtl' },
  centre: { textAlign: 'center' },
  start: { textAlign: 'auto' },
});
