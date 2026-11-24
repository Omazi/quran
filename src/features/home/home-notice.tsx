import { useTranslation } from 'react-i18next';

import type { GardenState } from '@/domain/garden';
import { WATER_SYMBOLS } from '@/features/garden';
import { LabelRow, type IconSymbol, type LabelRowTone } from '@/ui';

import type { HomeNotice } from './home-model';

/** Outline symbols, which sit well beside text (sf-symbols.md › Design variants). */
const BARE_EARTH_SYMBOL: IconSymbol = { ios: 'leaf', android: 'eco' };
const COMPLETE_SYMBOL: IconSymbol = { ios: 'checkmark.seal', android: 'verified' };

/**
 * The colour of the symbol of each message, and of the symbol only (charter, section 3). Orange
 * is thirst; the accent is water that flows; green is what has grown. The words always say what
 * the colour says (color.md › Inclusive color).
 */
const NOTICE_TONES: Readonly<Record<HomeNotice, LabelRowTone>> = {
  bare: 'secondaryLabel',
  thirsty: 'warning',
  wilting: 'warning',
  dying: 'warning',
  dead: 'warning',
  recovering: 'accent',
  complete: 'growth',
};

/**
 * A message about water carries the symbol of the water as it is, so that the shape still tells
 * its state while the water row gives its place to the message.
 */
function noticeSymbol(notice: HomeNotice, garden: GardenState): IconSymbol {
  if (notice === 'bare') return BARE_EARTH_SYMBOL;
  if (notice === 'complete') return COMPLETE_SYMBOL;
  return WATER_SYMBOLS[garden.water];
}

export interface HomeNoticeRowProps {
  notice: HomeNotice;
  garden: GardenState;
}

/**
 * The message of the day about the garden, as a row of the list: a symbol, the name of the
 * state, and one sentence that says what a page will do (lists-and-tables.md › Style). Status
 * shown where it applies, never as an alert (feedback.md › Best practices), and it never blames
 * (writing.md › Best practices; charter, voice). Place it in a `GroupedList`.
 */
export function HomeNoticeRow({ notice, garden }: HomeNoticeRowProps) {
  const { t } = useTranslation('home');
  return (
    <LabelRow
      label={t(`notice.${notice}.title`)}
      detail={t(`notice.${notice}.text`)}
      symbol={noticeSymbol(notice, garden)}
      tone={NOTICE_TONES[notice]}
      testID={`home-notice-${notice}`}
    />
  );
}
