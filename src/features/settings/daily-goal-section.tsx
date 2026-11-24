import { useTranslation } from 'react-i18next';

import { ListSection, StepperRow } from '@/ui';

import type { DailyGoalModel } from './daily-goal';

export interface DailyGoalSectionProps {
  model: DailyGoalModel;
  onChange: (pages: number) => void;
  /** Header of the section. Left out where the screen already names it. */
  title?: string;
}

/**
 * The daily goal: one row with the number of pages and the stepper that changes it, and under it
 * a note that says what this pace means, which changes as the person steps
 * (steppers.md › Best practices: the value a stepper affects is obvious). Place it in a
 * `GroupedList`.
 */
export function DailyGoalSection({ model, onChange, title }: DailyGoalSectionProps) {
  const { t } = useTranslation('settings');
  const pace = t('goal.pace', { count: model.pages });
  const duration = t('goal.duration', { count: model.khatmaDays });
  const note =
    model.landmark === null
      ? t('goal.note', { pace, duration })
      : t('goal.noteWithLandmark', {
          pace,
          duration,
          landmark: t(`goal.landmark.${model.landmark}`),
        });
  return (
    <ListSection title={title} footer={note}>
      <StepperRow
        label={t('goal.pagesPerDay')}
        value={model.pages}
        valueLabel={t('goal.value', { pages: model.pages })}
        min={model.min}
        max={model.max}
        onChange={onChange}
        testID="daily-goal"
      />
    </ListSection>
  );
}
