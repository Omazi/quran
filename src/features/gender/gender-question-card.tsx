import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAppStore } from '@/store';
import { ActionButton, AppText, Card, layout, spacing } from '@/ui';

import { genderOfChoice, type GenderChoice } from './gender-choice';

/** The answers in the order of the card: the two that name a gender side by side, then the way out. */
const ANSWERS = [
  { choice: 'male', variant: 'tonal' },
  { choice: 'female', variant: 'tonal' },
] as const satisfies readonly { choice: GenderChoice; variant: 'tonal' }[];

/**
 * The question asked once on the Profile tab (owner decision of 26 November 2026, "on demandera
 * le genre"): "Pour s'adresser à toi correctement". Light and optional (alerts.md › Best
 * practices: nothing modal for a question that blocks nothing): a card among the others, three
 * answers, each one the end of it, the same words as the settings row that changes it later.
 * "Préférer ne pas dire" is an answer: it is asked no more, and the texts keep their neutral
 * wording. Hidden once answered, here or on another phone (`genderAsked` travels with the account).
 */
export function GenderQuestionCard() {
  const { t } = useTranslation('profile');
  const isAsked = useAppStore((state) => state.settings.genderAsked);
  const setGender = useAppStore((state) => state.setGender);
  const { fontScale } = useWindowDimensions();
  if (isAsked) return null;
  const isSideBySide = fontScale <= layout.sideBySideMaxFontScale;
  return (
    <Card contentGap="md" accessibilityLabel={t('genderQuestion.title')} testID="gender-question">
      <View style={styles.words}>
        <AppText variant="headline" accessibilityRole="header">
          {t('genderQuestion.title')}
        </AppText>
        <AppText variant="subhead" color="muted">
          {t('genderQuestion.text')}
        </AppText>
      </View>
      <View style={isSideBySide ? styles.row : styles.column}>
        {ANSWERS.map(({ choice, variant }) => (
          <ActionButton
            key={choice}
            variant={variant}
            label={t(`genderQuestion.${choice}`)}
            onPress={() => setGender(genderOfChoice(choice))}
            grows
            testID={`gender-question-${choice}`}
          />
        ))}
      </View>
      <ActionButton
        variant="plain"
        label={t('genderQuestion.unspecified')}
        onPress={() => setGender(null)}
        testID="gender-question-unspecified"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  words: { rowGap: spacing.xs },
  row: { flexDirection: 'row', gap: layout.controlGap },
  column: { flexDirection: 'column', gap: layout.controlGap },
});
