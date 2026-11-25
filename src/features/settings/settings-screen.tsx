import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import {
  AppText,
  Button,
  ChoiceRow,
  GroupedList,
  ListRow,
  ListSection,
  Screen,
  layout,
} from '@/ui';

import { DailyGoalSection } from './daily-goal-section';
import { RemindersSection } from './reminders-section';
import type { SettingsActions, SettingsModel } from './use-settings';

export interface SettingsScreenProps {
  model: SettingsModel;
  actions: SettingsActions;
}

/**
 * The settings: a grouped list of the few things the system does not already decide
 * (settings.md › Best practices) — the language, the daily goal, the reminders
 * (managing-notifications.md › Best practices) — and the way back to the introduction
 * (onboarding.md › Best practices).
 */
export function SettingsScreen({ model, actions }: SettingsScreenProps) {
  const { t } = useTranslation('settings');
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
    <Screen background="groupedBackground" testID="settings">
      <AppText variant="largeTitle" style={styles.title}>
        {t('title')}
      </AppText>
      <GroupedList testID="settings-list">
        {/* Said in the interface, not in an alert at launch (alerts.md › Best practices), and
            only until the person has read it. */}
        {model.dataResetNotice === null ? null : (
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
        )}
        <ListSection footer={languageNote}>
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
        <ListSection>
          <ListRow
            label={t('introduction.replay')}
            onPress={actions.replayIntroduction}
            testID="replay-introduction"
          />
        </ListSection>
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: layout.screenMargin,
  },
});
