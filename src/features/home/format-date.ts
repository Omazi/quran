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

/**
 * The day above the title of the home screen: weekday, day and month, "Lundi 23 novembre",
 * "Monday, November 23". The first letter is a capital, as at the start of a sentence: French
 * writes weekdays in lower case inside a sentence.
 */
export function formatHeaderDate(date: LocalDate, language: string): string {
  const text = new Intl.DateTimeFormat(`${language}-u-nu-latn`, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  const [first = '', ...rest] = Array.from(text);
  return first.toLocaleUpperCase(language) + rest.join('');
}
