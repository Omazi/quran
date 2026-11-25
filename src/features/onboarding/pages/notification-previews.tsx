import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { TimeOfDay } from '@/domain/reminders';
import type { RemindersModel } from '@/features/settings';
import { AppText, layout, spacing, storyLayout, useColors, useElevation } from '@/ui';

/** The app's own icon, as the system shows it in a notification. */
const APP_ICON = require('../../../../assets/images/icon.png') as number;

/**
 * Below this window height (in points) the previews give their room to the settings, as the
 * prototype does on short screens (`@media (max-height: 740px)`).
 */
const SHORT_WINDOW = 740;

type Reminder = 'daily' | 'thirsty' | 'friday';

export interface NotificationPreviewsProps {
  reminders: RemindersModel;
  /** The pages of the day's goal: the daily reminder says how many are left. */
  dailyGoalPages: number;
}

/**
 * The notifications the reminders will send, drawn as the system shows them (the prototype's
 * `.notif`): the app's icon, a title, the time, one line. Each one appears or goes as its switch is
 * turned, so the person sees what a reminder is before choosing it (onboarding.md › Best
 * practices: teach through interactivity). Examples only: screen readers skip them, the switches
 * say everything. They are left out at the largest text sizes and on short screens, where the
 * settings need the room (layout.md › Adaptability).
 */
export function NotificationPreviews({ reminders, dailyGoalPages }: NotificationPreviewsProps) {
  const { t, i18n } = useTranslation('onboarding');
  const { height, fontScale } = useWindowDimensions();
  const [cardHeight, setCardHeight] = useState(0);
  if (height < SHORT_WINDOW || fontScale > layout.sideBySideMaxFontScale) return null;
  // Western digits in every language, as everywhere in the app (SKILLS.md, deviation 25).
  const time = (value: TimeOfDay) =>
    new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(2026, 0, 1, value.hour, value.minute));
  const shown: { id: Reminder; title: string; body: string; when: string }[] = [];
  if (reminders.dailyEnabled) {
    shown.push({
      id: 'daily',
      title: t('notifications.daily.title'),
      body: t('notifications.daily.body', { count: dailyGoalPages }),
      when: time(reminders.dailyTime),
    });
  }
  if (reminders.thirstyGardenEnabled) {
    shown.push({
      id: 'thirsty',
      title: t('notifications.thirsty.title'),
      body: t('notifications.thirsty.body'),
      when: time(reminders.dailyTime),
    });
  }
  if (reminders.fridayKahfEnabled) {
    shown.push({
      id: 'friday',
      title: t('notifications.friday.title'),
      body: t('notifications.friday.body'),
      when: time(reminders.fridayTime),
    });
  }
  // Room for the three, so the words under them do not move when a switch is turned.
  const room = cardHeight === 0 ? 0 : cardHeight * 3 + storyLayout.notificationGap * 2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stack, { minHeight: room }]}
      testID="onboarding-notifications"
    >
      {shown.map((notification) => (
        <Animated.View
          key={notification.id}
          entering={FadeIn}
          exiting={FadeOut}
          layout={LinearTransition}
          onLayout={(event: LayoutChangeEvent) =>
            setCardHeight((known) => Math.max(known, event.nativeEvent.layout.height))
          }
        >
          <Notification {...notification} />
        </Animated.View>
      ))}
    </View>
  );
}

function Notification({ title, body, when }: { title: string; body: string; when: string }) {
  const colors = useColors();
  const shadow = useElevation('card');
  return (
    <View
      style={[
        styles.notification,
        {
          backgroundColor: colors.notificationSurface,
          borderColor: colors.notificationEdge,
          boxShadow: shadow,
        },
      ]}
      testID="onboarding-notification"
    >
      <Image source={APP_ICON} style={styles.icon} accessible={false} />
      <View style={styles.body}>
        <View style={styles.top}>
          <AppText variant="subheadEmphasized" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          <AppText variant="footnote" color="muted">
            {when}
          </AppText>
        </View>
        <AppText variant="subhead" numberOfLines={1}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    justifyContent: 'flex-end',
    gap: storyLayout.notificationGap,
    marginBottom: spacing.lg,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
    padding: spacing.sm,
    borderRadius: storyLayout.notificationRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: storyLayout.notificationIcon,
    height: storyLayout.notificationIcon,
    borderRadius: storyLayout.notificationIconRadius,
  },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.sm },
  title: { flex: 1 },
});
