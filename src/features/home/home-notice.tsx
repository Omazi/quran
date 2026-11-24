import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Icon,
  radius,
  spacing,
  useColors,
  type IconColorRole,
  type IconSymbol,
} from '@/ui';

import type { HomeNotice } from './home-model';

interface NoticeIcon {
  readonly symbol: IconSymbol;
  readonly color: IconColorRole;
}

/** The garden: an outline symbol, which sits well beside text (sf-symbols.md › Design variants). */
const GARDEN_SYMBOL: IconSymbol = { ios: 'leaf', android: 'eco' };
const COMPLETE_SYMBOL: IconSymbol = { ios: 'checkmark.seal', android: 'verified' };

/**
 * The symbol of each message. Orange is thirst and only colours the symbol; green is a garden
 * that is well. The words always say what the colour says (charter, section 3;
 * accessibility.md › Vision).
 */
const NOTICE_ICONS: Readonly<Record<HomeNotice, NoticeIcon>> = {
  bare: { symbol: GARDEN_SYMBOL, color: 'secondaryLabel' },
  thirsty: { symbol: GARDEN_SYMBOL, color: 'warning' },
  wilting: { symbol: GARDEN_SYMBOL, color: 'warning' },
  dying: { symbol: GARDEN_SYMBOL, color: 'warning' },
  dead: { symbol: GARDEN_SYMBOL, color: 'warning' },
  recovering: { symbol: GARDEN_SYMBOL, color: 'growth' },
  complete: { symbol: COMPLETE_SYMBOL, color: 'growth' },
};

export interface HomeNoticeBannerProps {
  notice: HomeNotice;
}

/**
 * The message of the day about the garden: a symbol, a short title and one sentence that says
 * what a page will do. Status shown where it applies, in the interface, never as an alert
 * (feedback.md › Best practices). It never blames (writing.md › Best practices; charter, voice).
 * One element for screen readers: the symbol is decorative, the words say it all.
 */
export function HomeNoticeBanner({ notice }: HomeNoticeBannerProps) {
  const { t } = useTranslation('home');
  const colors = useColors();
  const { symbol, color } = NOTICE_ICONS[notice];
  return (
    <View
      accessible
      style={[styles.banner, { backgroundColor: colors.secondaryGroupedBackground }]}
      testID={`home-notice-${notice}`}
    >
      <Icon symbol={symbol} textStyle="headline" color={color} />
      <View style={styles.words}>
        <AppText variant="headline">{t(`notice.${notice}.title`)}</AppText>
        <AppText>{t(`notice.${notice}.text`)}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  // The words take the width left by the symbol and wrap at large text sizes.
  words: { flexGrow: 1, flexShrink: 1, gap: spacing.xs },
});
