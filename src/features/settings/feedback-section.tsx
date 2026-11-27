import { useTranslation } from 'react-i18next';

import { ListSection, SwitchRow } from '@/ui';

import type { FeedbackSettingsModel } from './use-settings';

export interface FeedbackSectionProps {
  model: FeedbackSettingsModel;
  onSoundsChange: (enabled: boolean) => void;
  onHapticsChange: (enabled: boolean) => void;
  /** Header of the section. Left out where the screen already names it. */
  title?: string;
}

/**
 * "Sons et vibrations": two switches in list rows (toggles.md › Mobile), and under them what the
 * person cannot guess: the sounds follow the phone's silent switch and stay quiet while the app
 * listens to the recitation. Place it in a `GroupedList`.
 */
export function FeedbackSection({
  model,
  onSoundsChange,
  onHapticsChange,
  title,
}: FeedbackSectionProps) {
  const { t } = useTranslation('settings');
  return (
    <ListSection title={title} footer={t('feedback.note')}>
      <SwitchRow
        label={t('feedback.sounds')}
        value={model.soundsEnabled}
        onChange={onSoundsChange}
        testID="feedback-sounds"
      />
      <SwitchRow
        label={t('feedback.haptics')}
        value={model.hapticsEnabled}
        onChange={onHapticsChange}
        testID="feedback-haptics"
      />
    </ListSection>
  );
}
