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
  const languageOptions = model.language.options.map((language) => ({
    value: language,
    label: t(`language.options.${language}`),
  }));
  return (
    <Screen background="groupedBackground" testID="settings">
      <AppText variant="largeTitle" style={styles.title}>
        {t('title')}
      </AppText>
      <GroupedList testID="settings-list">
        <ListSection footer={model.language.needsRestart ? t('language.restartNote') : undefined}>
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
