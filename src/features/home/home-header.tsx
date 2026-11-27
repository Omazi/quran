import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocalDate } from '@/domain/shared/local-date';
import {
  AppText,
  Avatar,
  GlassSurface,
  Icon,
  Pill,
  layout,
  pieceSizes,
  spacing,
  stateOpacity,
} from '@/ui';

import { HOME_SYMBOLS } from './config';
import { formatHeaderDate } from './format-date';

export interface HomeHeaderProps {
  today: LocalDate;
  streakDays: number;
  /** The initial of the signed-in person; null shows a symbol instead. */
  avatarInitial: string | null;
  onOpenProfile: () => void;
  /**
   * Over the home garden's sky (maquette-wow): the streak on glass, the date in the title's colour
   * (`dateLabel` was made for the peach gradient). Absent: the gradient layouts (dead, complete).
   */
  glass?: { readonly appearance: 'light' | 'dark'; readonly veil: number };
  /**
   * Test builds only: a long-press on the date opens the preview of the garden's states. Absent
   * in a published build, where the date is plain text.
   */
  datePreview?: { readonly onOpen: () => void; readonly hint: string };
}

/**
 * The top of the home screen (accueil.png): the day, the serif title, the streak in its pill and
 * the person's avatar, which opens the profile. The title is the screen's heading for VoiceOver;
 * the date and title stack over the pill and avatar when the text is too large to share the row.
 */
export function HomeHeader({
  today,
  streakDays,
  avatarInitial,
  onOpenProfile,
  glass,
  datePreview,
}: HomeHeaderProps) {
  const { t, i18n } = useTranslation('home');
  const streakSymbol = streakDays > 0 ? HOME_SYMBOLS.flame : HOME_SYMBOLS.flameOff;
  const streakLabel = t('streak', { count: streakDays });
  const dateText = (
    <AppText variant="subhead" color={glass === undefined ? 'dateLabel' : 'heading'}>
      {formatHeaderDate(today, i18n.language)}
    </AppText>
  );
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        {datePreview === undefined ? (
          dateText
        ) : (
          <Pressable
            onLongPress={datePreview.onOpen}
            accessibilityRole="text"
            accessibilityHint={datePreview.hint}
            hitSlop={spacing.sm}
            testID="home-date"
          >
            {dateText}
          </Pressable>
        )}
        <AppText variant="largeTitle" color="heading">
          {t('title')}
        </AppText>
      </View>
      <View style={styles.trailing}>
        {glass === undefined ? (
          <Pill
            symbol={streakSymbol}
            symbolColor={streakDays > 0 ? 'flame' : 'muted'}
            label={String(streakDays)}
            accessibilityLabel={streakLabel}
            testID="home-streak"
          />
        ) : (
          <GlassSurface
            appearance={glass.appearance}
            shape="capsule"
            veil={glass.veil}
            accessible
            accessibilityLabel={streakLabel}
            style={styles.streakChip}
            testID="home-streak"
          >
            <Icon
              symbol={streakSymbol}
              textStyle="headline"
              color={streakDays > 0 ? 'flame' : 'muted'}
            />
            <AppText variant="title3">{String(streakDays)}</AppText>
          </GlassSurface>
        )}
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
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    minHeight: pieceSizes.actionHeight,
    paddingHorizontal: spacing.md,
  },
  trailing: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm },
  avatarButton: {
    minWidth: layout.touchTarget,
    minHeight: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: stateOpacity.pressed },
});
