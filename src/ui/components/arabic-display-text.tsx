import { StyleSheet, Text, View } from 'react-native';

import { quranTextStyles } from '../tokens';
import { useColors } from '../use-colors';

export interface ArabicDisplayTextProps {
  /** Arabic words as the data layer or the locale files give them: a surah's name, a blessing. */
  text: string;
  /** `start` (the right edge) beside a name in a card; `center` under a title. */
  align?: 'start' | 'center';
  testID?: string;
}

/**
 * An Arabic name or phrase set large in the calligraphic font of surah names, in gold
 * (accueil.png: "الكهف" in the card to resume; khatm.png: "تقبّل الله منك"). Not for verses, which
 * `QuranText` sets in the Hafs font. It always reads right to left and is heard in Arabic. Gold is
 * the ornament colour, which keeps 3:1 for large text on the cream and sunrise surfaces it sits on
 * (accessibility.md › Vision).
 */
export function ArabicDisplayText({ text, align = 'start', testID }: ArabicDisplayTextProps) {
  const colors = useColors();
  const { fontFamily, fontSize, lineHeight, ramp } = quranTextStyles.surahName;
  return (
    <View style={styles.rightToLeft}>
      <Text
        accessibilityLanguage="ar"
        dynamicTypeRamp={ramp}
        testID={testID}
        style={[
          styles.text,
          { fontFamily, fontSize, lineHeight, color: colors.ornament },
          align === 'center' ? styles.centre : styles.start,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rightToLeft: { direction: 'rtl' },
  text: { writingDirection: 'rtl' },
  centre: { textAlign: 'center' },
  start: { textAlign: 'auto' },
});
