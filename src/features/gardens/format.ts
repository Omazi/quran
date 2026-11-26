import type { LocalDate } from '@/domain/shared/local-date';

/**
 * "19 mars 2026": the day a badge was earned, in the language of the interface with Western digits,
 * as the rest of the app writes numbers (deviation 25 of docs/design/SKILLS.md). A `LocalDate`
 * has no time zone: it is read and written in UTC so that no zone can shift it.
 */
export function formatBadgeDate(date: LocalDate, language: string): string {
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
