import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/domain/shared/local-date';
import { AppText, Avatar, Pill, layout, spacing, stateOpacity } from '@/ui';

import { HOME_SYMBOLS } from './config';
import { formatHeaderDate } from './format-date';

export interface HomeHeaderProps {
  today: LocalDate;
  streakDays: number;
  /** The initial of the signed-in person; null shows a symbol instead. */
  avatarInitial: string | null;
  onOpenProfile: () => void;
}

/**
 * The top of the home screen (accueil.png): the day, the serif title, the streak in its pill and
 * the person's avatar, which opens the profile. The title is the screen's heading for VoiceOver;
 * the date and title stack over the pill and avatar when the text is too large to share the row.
 */
export function HomeHeader({ today, streakDays, avatarInitial, onOpenProfile }: HomeHeaderProps) {
  const { t, i18n } = useTranslation('home');
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <AppText variant="subhead" color="dateLabel">
          {formatHeaderDate(today, i18n.language)}
        </AppText>
        <AppText variant="largeTitle" color="heading">
          {t('title')}
        </AppText>
      </View>
      <View style={styles.trailing}>
        <Pill
          symbol={streakDays > 0 ? HOME_SYMBOLS.flame : HOME_SYMBOLS.flameOff}
          symbolColor={streakDays > 0 ? 'flame' : 'muted'}
          label={String(streakDays)}
          accessibilityLabel={t('streak', { count: streakDays })}
          testID="home-streak"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile')}
          onPress={onOpenProfile}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          testID="home-profile"
        >
          <Avatar
            content={
              avatarInitial === null ? { symbol: HOME_SYMBOLS.person } : { initial: avatarInitial }
            }
            color="self"
            size="medium"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    paddingHorizontal: layout.screenMargin + spacing.xs,
    paddingTop: layout.controlGap,
  },
  titles: { flexShrink: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm },
  avatarButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: stateOpacity.pressed },
});
