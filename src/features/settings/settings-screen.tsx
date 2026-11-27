import { useTranslation } from 'react-i18next';
import {
  useGenderedTranslation,
  choiceOfGender,
  GENDER_CHOICES,
  genderOfChoice,
} from '@/features/gender';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ChoiceRow,
  GroupedList,
  Icon,
  ListRow,
  ListSection,
  Screen,
  spacing,
  type IconSymbol,
} from '@/ui';

import { DiagnosticsSection } from '@/features/diagnostics';
import { SyncStatusSection } from '@/features/sync';

import { DailyGoalSection } from './daily-goal-section';
import { FeedbackSection } from './feedback-section';
import { RemindersSection } from './reminders-section';
import type { SettingsActions, SettingsModel } from './use-settings';
import { VersionSection } from './voice-diagnostics-section';

export interface SettingsScreenProps {
  model: SettingsModel;
  actions: SettingsActions;
}

const NOTICE_SYMBOL: IconSymbol = { ios: 'info.circle', android: 'info' };

/**
 * The settings: a grouped list of the few things the system does not already decide
 * (settings.md › Best practices) — the language, what the person says they are ("Je suis"), the
 * daily goal, the reminders
 * (managing-notifications.md › Best practices) — and the way back to the introduction
 * (onboarding.md › Best practices). A page opened from the last card of the profile: its title is
 * in the system navigation bar, which the route gives it.
 *
 * The rows and controls stay the system's (switches, stepper, time pickers, pop-up menu); the list
 * takes the garden appearance, the warm canvas of the validated mockups with its groups on white
 * cards, so the page belongs to the same app as the profile that opens it.
 */
export function SettingsScreen({ model, actions }: SettingsScreenProps) {
  return (
    <Screen background="canvas" hasScrollingList testID="settings">
      <GroupedList appearance="garden" testID="settings-list">
        <DataResetNoticeSection model={model} actions={actions} />
        <SettingsSections model={model} actions={actions} />
        {/* The backup of the progress, on the phone and in the account (docs/specs/sync.md). */}
        <SyncStatusSection />
        {/* The last closure the app noted, when there is one (src/features/diagnostics). */}
        <DiagnosticsSection />
        {/* The version; a long press on it shows the voice diagnostics (hidden). */}
        <VersionSection />
      </GroupedList>
    </Screen>
  );
}

/**
 * Stored data that could not be read back, said in the interface, not in an alert at launch
 * (alerts.md › Best practices), and only until the person has read it. Nothing otherwise.
 */
export function DataResetNoticeSection({ model, actions }: SettingsScreenProps) {
  const { t } = useTranslation('settings');
  if (model.dataResetNotice === null) return null;
  return (
    <ListSection
      title={t('dataResetNotice.title')}
      footer={t(`dataResetNotice.${model.dataResetNotice}`)}
    >
      <Button
        label={t('dataResetNotice.dismiss')}
        variant="plain"
        onPress={actions.dismissDataResetNotice}
        testID="dismiss-data-reset-notice"
      />
    </ListSection>
  );
}

/**
 * The same notice as a card of the mockups, for a screen built of cards (the profile), where a
 * section of a list cannot sit: a symbol and a title, what happened, and the button that says it
 * was read (alerts.md › Best practices: in the interface, not in an alert).
 */
export function DataResetNoticeCard({ model, actions }: SettingsScreenProps) {
  const { t } = useTranslation('settings');
  if (model.dataResetNotice === null) return null;
  return (
    <Card tone="inset" testID="data-reset-notice">
      <View style={styles.notice}>
        <View style={styles.noticeTitle}>
          <Icon symbol={NOTICE_SYMBOL} textStyle="headline" color="actionTint" />
          <AppText variant="headline" accessibilityRole="header" style={styles.noticeTitleText}>
            {t('dataResetNotice.title')}
          </AppText>
        </View>
        <AppText variant="subhead">{t(`dataResetNotice.${model.dataResetNotice}`)}</AppText>
        <Button
          label={t('dataResetNotice.dismiss')}
          variant="plain"
          onPress={actions.dismissDataResetNotice}
          testID="dismiss-data-reset-notice"
        />
      </View>
    </Card>
  );
}

export interface SettingsSectionsProps extends SettingsScreenProps {
  /** Header of the first section, to name the settings where other content comes before them. */
  title?: string;
}

/** The sections of the settings, to place in a `GroupedList`. */
export function SettingsSections({ model, actions, title }: SettingsSectionsProps) {
  const { t } = useGenderedTranslation('settings');
  const languageOptions = model.language.options.map((choice) => ({
    value: choice,
    label: t(`language.options.${choice}`),
  }));
  // One note at a time, under the choice (pop-up-buttons.md › Best practices: explanatory text
  // below the list). The restart comes first: it is what the person can act on now.
  const languageNote = model.language.needsRestart
    ? t('language.restartNote')
    : model.language.isDeviceLanguageMissing
      ? t('language.deviceLanguageMissing')
      : undefined;
  return (
    <>
      <ListSection title={title} footer={languageNote}>
        <ChoiceRow
          label={t('language.label')}
          options={languageOptions}
          value={model.language.selected}
          onChange={actions.selectLanguage}
          testID="language"
        />
        {model.language.needsRestart ? (
          <Button
            label={t('language.restart')}
            variant="plain"
            onPress={actions.restartApp}
            testID="restart-app"
          />
        ) : null}
      </ListSection>
      {/* "Je suis": so that the words that speak to the person, and of them, agree. */}
      <ListSection footer={t('gender.note')}>
        <ChoiceRow
          label={t('gender.label')}
          options={GENDER_CHOICES.map((choice) => ({
            value: choice,
            label: t(`gender.options.${choice}`),
          }))}
          value={choiceOfGender(model.gender)}
          onChange={(choice) => actions.setGender(genderOfChoice(choice))}
          testID="gender"
        />
      </ListSection>
      <DailyGoalSection
        title={t('goal.title')}
        model={model.dailyGoal}
        onChange={actions.setDailyGoalPages}
      />
      <RemindersSection
        title={t('reminders.title')}
        model={model.reminders}
        onChange={actions.changeReminders}
        onOpenSystemSettings={actions.openSystemSettings}
        onRequestPermission={actions.requestNotificationPermission}
      />
      <FeedbackSection
        title={t('feedback.title')}
        model={model.feedback}
        onSoundsChange={actions.setSoundsEnabled}
        onHapticsChange={actions.setHapticsEnabled}
      />
      <ListSection>
        <ListRow
          label={t('introduction.replay')}
          onPress={actions.replayIntroduction}
          testID="replay-introduction"
        />
      </ListSection>
    </>
  );
}

const styles = StyleSheet.create({
  notice: { rowGap: spacing.sm, alignItems: 'flex-start' },
  noticeTitle: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.sm },
  noticeTitleText: { flexShrink: 1 },
});
