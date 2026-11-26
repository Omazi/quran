import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

// The mark alone, not the listening module: that module reaches the reader, and the reader it.
import { RosetteMark, StarHalo } from '@/features/listening/rosette/rosette-mark';
import {
  ActionButton,
  AppText,
  GradientBackdrop,
  layout,
  pieceSizes,
  radius,
  spacing,
  useElevation,
  type IconSymbol,
} from '@/ui';

const MIC_SYMBOL: IconSymbol = { ios: 'mic.fill', android: 'mic' };

export interface RecognizeCardProps {
  onRecognize: () => void;
}

/**
 * "Quel est ce passage ?" at the top of the Quran tab (maquettes 2026-11-26, 3A, chosen by the
 * owner with the "Reconnaître" button of the home screen): the green of the listening page, its
 * rosette, one sentence that says what happens, and a white capsule that starts it. The card
 * explains the feature before the tap, where a symbol alone would need a tip
 * (buttons.md › Content: text when a short label communicates more clearly than an icon).
 *
 * The title is a header for VoiceOver; the rosette and the faint stars behind it are decoration
 * and are skipped. The words keep the leading side and the rosette the trailing one, so they
 * trade places in Arabic (right-to-left.md › Controls); the drawing itself is symmetric.
 */
export function RecognizeCard({ onRecognize }: RecognizeCardProps) {
  const { t } = useTranslation('reader');
  const shadow = useElevation('floating');
  return (
    <View style={[styles.card, { boxShadow: shadow }]} testID="contents-recognize-card">
      <GradientBackdrop name="listening" style={StyleSheet.absoluteFill} />
      <View style={styles.halo}>
        <StarHalo size={pieceSizes.recognizeHalo} />
      </View>
      <View style={styles.row}>
        <View style={styles.words}>
          <AppText variant="title2" color="onAction" accessibilityRole="header">
            {t('contents.recognizeCard.title')}
          </AppText>
          <AppText variant="subhead" color="onActionSecondary">
            {t('contents.recognizeCard.text')}
          </AppText>
          <View style={styles.action}>
            <ActionButton
              variant="onAction"
              isCompact
              fullWidth={false}
              symbol={MIC_SYMBOL}
              label={t('contents.recognizeCard.action')}
              accessibilityLabel={t('contents.recognize')}
              onPress={onRecognize}
              testID="contents-recognize-card-button"
            />
          </View>
        </View>
        <RosetteMark size={pieceSizes.recognizeRosette} tone="onAction" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  // Half off the card's top trailing corner, as in the mockup: the card's corner cuts it.
  halo: {
    position: 'absolute',
    top: pieceSizes.recognizeHaloTop,
    end: pieceSizes.recognizeHaloEnd,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md + spacing.xs,
  },
  words: { flex: 1, gap: spacing.xs },
  action: { marginTop: layout.controlGap, alignItems: 'flex-start' },
});
