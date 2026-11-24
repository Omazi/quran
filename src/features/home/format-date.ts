import type { LocalDate } from '@/domain/shared/local-date';

/**
 * A calendar day written out for people, month in words: "12 mars 2027", "March 12, 2027". The
 * platform writes it in the language of the interface (writing.md › Best practices: write for
 * everyone); the digits stay the ones the rest of the interface uses.
 */
export function formatLongDate(date: LocalDate, language: string): string {
  // A LocalDate has no time zone: it is read and written in UTC so that no zone can shift it.
  return new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
