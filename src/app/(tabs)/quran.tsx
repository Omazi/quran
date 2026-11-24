import { useTranslation } from 'react-i18next';

import { ContentUnavailable, Screen, type IconSymbol } from '@/ui';

const QURAN_SYMBOL: IconSymbol = { ios: 'book', android: 'menu_book' };

/**
 * The Quran tab before the reader exists. The tab stays in the bar and says why it is empty
 * (tab-bars.md › Best practices), with the system's empty state.
 */
export default function QuranRoute() {
  const { t } = useTranslation('common');
  return (
    <Screen testID="quran">
      <ContentUnavailable
        title={t('quran.unavailable.title')}
        description={t('quran.unavailable.description')}
        symbol={QURAN_SYMBOL}
      />
    </Screen>
  );
}
