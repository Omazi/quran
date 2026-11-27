import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { GOAL_KINDS, READING_MOMENTS, type ReadingMoment } from '@/domain/goal-plan';
import type { LocalDate } from '@/domain/shared/local-date';
import {
  ActionButton,
  AppText,
  useColors,
  useElevation,
  voiceStoryLayout as L,
  type IconSymbol,
} from '@/ui';

import { copyLook } from '../story-math';
import { SceneDescription } from './page-copy';
import type { PageProps } from './page-props';
import { ChoiceButton, ChoiceGrid, RollingText, SettingsCard, SwitchLine } from './settings-parts';

/** The app's icon, as the notification shows it. */
const APP_ICON: number = require('../../../../assets/images/icon.png');

/** The moments' symbols (SF Symbols): sunrise, noon sun, sunset, moon (`data-mom`). */
const MOMENT_SYMBOLS: Readonly<Record<ReadingMoment, IconSymbol>> = {
  'after-fajr': { ios: 'sunrise', android: 'wb_twilight' },
  midday: { ios: 'sun.max', android: 'light_mode' },
  evening: { ios: 'sunset', android: 'wb_twilight' },
  'before-sleep': { ios: 'moon', android: 'dark_mode' },
};

/** A day written out: "25 février", with the year only when it is not this year's. */
export function formatKhatmaDate(date: LocalDate, today: LocalDate, language: string): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The settings pages slide with the finger like the words, and take touches once in place. */
function usePanelStyle({
  position,
  index,
  reducedMotion,
}: Pick<PageProps, 'position' | 'index' | 'reducedMotion'>) {
  return useAnimatedStyle(() => {
    const look = copyLook(position.get(), index, L.copyTravel, reducedMotion);
    return { opacity: look.opacity, transform: [{ translateY: look.translateY }] };
  });
}

/**
 * The goal (`#p14`): four goals as toggle buttons, and what the chosen one means, live — the
 * pages to read each day and the day the khatma ends, from the goal-plan domain — rolling as they
 * change; the garden above shows where a month at this pace leads (the stage).
 */
export function GoalPage(props: PageProps) {
  const { page, layout, model, actions, reducedMotion, sceneLabel } = props;
  const { t, i18n } = useTranslation('onboarding');
  const style = usePanelStyle(props);
  const colors = useColors();
  const { plan } = model;
  // Which way the figures roll: up when the pages grow (adjusting state as the plan changes).
  const [rolled, setRolled] = useState<{ pages: number; direction: 1 | -1 }>({
    pages: plan.pagesPerDay,
    direction: 1,
  });
  if (rolled.pages !== plan.pagesPerDay) {
    setRolled({ pages: plan.pagesPerDay, direction: plan.pagesPerDay >= rolled.pages ? 1 : -1 });
  }
  const { direction } = rolled;
  const isOwnPace = plan.kind === 'own-pace';
  const end = isOwnPace
    ? t('goal.whenever')
    : formatKhatmaDate(plan.endDate, model.today, i18n.language);
  return (
    <>
      <SceneDescription layout={layout} label={sceneLabel} />
      <Animated.View
        style={[styles.panel, { top: layout.goalTop }, style]}
        testID="onboarding-goal"
      >
        <AppText variant="title1" color="heading" accessibilityRole="header">
          {t(page.title)}
        </AppText>
        <AppText variant="body" color="muted" style={styles.lead}>
          {t(page.text)}
        </AppText>
        <View style={styles.block}>
          <ChoiceGrid label={t('goal.label')}>
            {GOAL_KINDS.map((goal) => (
              <ChoiceButton
                key={goal}
                label={t(`goal.options.${goal}`)}
                isSelected={model.goal === goal}
                onPress={() => actions.chooseGoal(goal)}
                testID={`onboarding-goal-${goal}`}
              />
            ))}
          </ChoiceGrid>
        </View>
        <View
          style={styles.block}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${t('goal.perDay')} ${plan.pagesPerDay} ${t('goal.pagesUnit', { count: plan.pagesPerDay })}, ${t('goal.end')} ${end}`}
        >
          <SettingsCard isRow>
            <View style={styles.result}>
              <AppText variant="footnote" color="muted">
                {t('goal.perDay')}
              </AppText>
              <RollingText
                text={String(plan.pagesPerDay)}
                direction={direction}
                reducedMotion={reducedMotion}
              >
                <AppText variant="title3" color="heading">
                  {plan.pagesPerDay}
                </AppText>
                <AppText variant="subheadEmphasized" color="muted">
                  {t('goal.pagesUnit', { count: plan.pagesPerDay })}
                </AppText>
              </RollingText>
            </View>
            <View style={[styles.result, styles.resultEnd, { borderStartColor: colors.separator }]}>
              <AppText variant="footnote" color="muted">
                {t('goal.end')}
              </AppText>
              <RollingText text={end} direction={direction} reducedMotion={reducedMotion}>
                <AppText variant="title3" color="heading" numberOfLines={1}>
                  {end}
                </AppText>
              </RollingText>
            </View>
          </SettingsCard>
        </View>
      </Animated.View>
    </>
  );
}

/**
 * The reminders (`#p15`): the moment of the daily reading as toggle buttons, the notification it
 * will bring (its words follow the goal and the moment), two switches, and the one button of the
 * flow, "Créer mon jardin". When the system's alert follows it, VoiceOver hears so in its hint
 * (privacy.md › Requesting permission); the prototype has no sentence for it on screen.
 */
export function RemindersPage(props: PageProps) {
  const { page, layout, model, actions, sceneLabel } = props;
  const { t, i18n } = useTranslation('onboarding');
  const style = usePanelStyle(props);
  const colors = useColors();
  const shadow = useElevation('floating');
  const { plan } = model;
  const moment = t(`reminders.inSentence.${model.moment}`);
  const body =
    plan.kind === 'own-pace'
      ? t('reminders.bodyOwnPace', { moment })
      : t('reminders.body', {
          count: plan.pagesPerDay,
          moment,
          date: formatKhatmaDate(plan.endDate, model.today, i18n.language),
        });
  return (
    <>
      <SceneDescription layout={layout} label={sceneLabel} />
      <Animated.View
        style={[styles.panel, { top: layout.remindersTop }, style]}
        testID="onboarding-reminders"
      >
        <AppText variant="title1" color="heading" accessibilityRole="header">
          {t(page.title)}
        </AppText>
        <AppText variant="body" color="muted" style={styles.lead}>
          {t(page.text)}
        </AppText>
        <View style={styles.block}>
          <ChoiceGrid label={t('reminders.momentLabel')}>
            {READING_MOMENTS.map((item) => (
              <ChoiceButton
                key={item}
                label={t(`reminders.moments.${item}`)}
                symbol={MOMENT_SYMBOLS[item]}
                isSelected={model.moment === item}
                onPress={() => actions.chooseMoment(item)}
                isSmall
                testID={`onboarding-moment-${item}`}
              />
            ))}
          </ChoiceGrid>
        </View>
        <View
          style={[
            styles.notification,
            {
              backgroundColor: colors.notificationSurface,
              borderColor: colors.notificationEdge,
              boxShadow: shadow,
            },
          ]}
          accessible
          accessibilityLabel={`${t('reminders.previewLabel')}. ${t('reminders.notificationTitle')}. ${body}`}
          testID="onboarding-notification"
        >
          <Image source={APP_ICON} style={styles.icon} accessible={false} />
          <View style={styles.notificationText}>
            <View style={styles.notificationTop}>
              <AppText
                variant="subheadEmphasized"
                color="heading"
                numberOfLines={1}
                style={styles.flex}
              >
                {t('reminders.notificationTitle')}
              </AppText>
              <AppText variant="footnote" color="muted">
                {t('reminders.now')}
              </AppText>
            </View>
            <AppText variant="subhead" color="heading">
              {body}
            </AppText>
          </View>
        </View>
        <View style={styles.block}>
          <SettingsCard>
            <SwitchLine
              label={t('reminders.fridayKahf')}
              value={model.fridayKahf}
              onChange={actions.setFridayKahf}
              isFirst
              testID="onboarding-friday"
            />
            <SwitchLine
              label={t('reminders.thirsty')}
              value={model.thirstyGarden}
              onChange={actions.setThirstyGarden}
              isFirst={false}
              testID="onboarding-thirsty"
            />
          </SettingsCard>
        </View>
        <View style={styles.finish}>
          <ActionButton
            label={t(model.isReplay ? 'finish.done' : 'finish.start')}
            accessibilityHint={model.isReplay ? undefined : t('permissionHint')}
            onPress={actions.finish}
            disabled={model.isFinishing}
            testID="onboarding-finish"
          />
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', start: L.margin, end: L.margin },
  lead: { marginTop: L.leadGap },
  block: { marginTop: L.panelGap },
  result: { flex: 1, minWidth: 0 },
  resultEnd: {
    flex: 1.45,
    borderStartWidth: StyleSheet.hairlineWidth,
    paddingStart: L.cardPadding,
    marginStart: L.cardPadding,
  },
  notification: {
    marginTop: L.panelGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: L.notificationGap,
    padding: L.notificationPadding,
    borderRadius: L.notificationRadius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: L.notificationIcon,
    height: L.notificationIcon,
    borderRadius: L.notificationIconRadius,
  },
  notificationText: { flex: 1, minWidth: 0 },
  notificationTop: { flexDirection: 'row', alignItems: 'baseline', gap: L.choiceIconGap },
  flex: { flex: 1 },
  finish: { marginTop: L.finishGap },
});
