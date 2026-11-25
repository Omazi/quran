import { useTranslation } from 'react-i18next';

import { ListRow, ListSection } from '@/ui';

import { formatLongDate } from './format-date';
import type { HomeReadyModel } from './home-model';

export interface TodaySectionProps {
  model: HomeReadyModel;
}

/**
 * "Aujourd'hui": the pages read out of the goal the person chose and the day the khatma would end at
 * that pace (the page to read now is on the button, `HomeScreen`). Text in rows of the system's grouped list
 * (lists-and-tables.md › Best practices), short enough to scan (› Content). The rows are not
 * buttons: the one action of the screen is "Lire et arroser". Place it in a `GroupedList`.
 */
export function TodaySection({ model }: TodaySectionProps) {
  const { t, i18n } = useTranslation('home');
  const { today, reading } = model;
  const { estimatedFinishDate } = reading;
  // After a completed khatma, the page to read and the estimate are those of the next one.
  const isAboutNextKhatma = model.notice === 'complete';
  return (
    <ListSection
      title={t('today.title')}
      footer={
        estimatedFinishDate === null ? undefined : t('today.footer', { count: today.goalPages })
      }
    >
      <ListRow
        label={t('today.pages.label')}
        value={t(today.goalReached ? 'today.pages.valueReached' : 'today.pages.value', {
          read: today.pagesRead,
          goal: today.goalPages,
        })}
        testID="home-today-pages"
      />
      {estimatedFinishDate === null ? null : (
        <ListRow
          label={t(isAboutNextKhatma ? 'today.finish.labelNext' : 'today.finish.label')}
          value={
            reading.finishesToday
              ? t('today.finish.today')
              : formatLongDate(estimatedFinishDate, i18n.language)
          }
          testID="home-finish"
        />
      )}
    </ListSection>
  );
}
