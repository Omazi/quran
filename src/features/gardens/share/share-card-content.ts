import type { TFunction } from 'i18next';

import type { GardenStyleId } from '@/domain/levels';
import { HIZB_COUNT, PAGE_COUNT } from '@/domain/quran';
import type { LocalDate } from '@/domain/shared/local-date';

import { formatBadgeDate } from '../format';

/** What a shared badge is made of: the badge, and the khatma that earned it. */
export interface ShareCardInput {
  readonly khatm: number;
  readonly styleId: GardenStyleId;
  readonly completedOn: LocalDate;
  /** Calendar days the khatma took, both ends included (`CompletedKhatma.daysTaken`). */
  readonly days: number;
}

export interface ShareCardFigure {
  readonly value: string;
  readonly label: string;
}

/** Every word and number of the card, in the language of the app. Nothing is drawn from here. */
export interface ShareCardContent {
  readonly khatm: number;
  readonly styleId: GardenStyleId;
  readonly completedOn: LocalDate;
  readonly appName: string;
  /** "Khatma n°3 terminée". */
  readonly title: string;
  readonly garden: string;
  readonly date: string;
  /** The person's name, only when they chose to put it on the image. */
  readonly name: string | null;
  /** 60 hizb, 604 pages, the days it took. */
  readonly figures: readonly ShareCardFigure[];
  /** The invocation of the celebration; null leaves it out of the card. */
  readonly dua: string | null;
  /** What VoiceOver says of the picture, where it is shown. */
  readonly label: string;
}

export interface ShareCardOptions {
  readonly t: TFunction<'gardens'>;
  readonly appName: string;
  readonly language: string;
  /** Null, empty or blank: the image carries no name (privacy: the default is none). */
  readonly name: string | null;
  /** Defaults to true. */
  readonly withDua?: boolean;
}

/**
 * The card's words and numbers, from the same strings as the celebration screen so that the two
 * never say different things. Digits are Western in every language, as elsewhere in the app
 * (deviation 25 of docs/design/SKILLS.md).
 */
export function buildShareCardContent(
  input: ShareCardInput,
  { t, appName, language, name, withDua = true }: ShareCardOptions,
): ShareCardContent {
  if (!Number.isInteger(input.khatm) || input.khatm < 1) {
    throw new RangeError(
      `buildShareCardContent: khatm must be a whole number from 1, got ${input.khatm}`,
    );
  }
  if (!Number.isInteger(input.days) || input.days < 1) {
    throw new RangeError(
      `buildShareCardContent: days must be a whole number from 1, got ${input.days}`,
    );
  }
  const number = new Intl.NumberFormat(`${language}-u-nu-latn`);
  const trimmedName = name?.trim() ?? '';
  return {
    khatm: input.khatm,
    styleId: input.styleId,
    completedOn: input.completedOn,
    appName,
    title: t('share.title', { khatm: input.khatm }),
    garden: t(`styles.${input.styleId}`),
    date: formatBadgeDate(input.completedOn, language),
    name: trimmedName === '' ? null : trimmedName,
    figures: [
      { value: number.format(HIZB_COUNT), label: t('celebration.hizb') },
      { value: number.format(PAGE_COUNT), label: t('celebration.pages') },
      { value: number.format(input.days), label: t('celebration.days', { count: input.days }) },
    ],
    dua: withDua ? t('celebration.dua') : null,
    label: t('share.cardLabel', { khatm: input.khatm }),
  };
}
