import { parseDisplayName, SocialRuleError } from '../index';
import { expectRefusal } from '../test-support/social-test-kit';

const LINE_SEPARATOR = '\u2028';
const PARAGRAPH_SEPARATOR = '\u2029';
const NO_BREAK_SPACE = '\u00A0';
const RIGHT_TO_LEFT_OVERRIDE = '\u202E';
const FIRST_STRONG_ISOLATE = '\u2068';
const HALF_OF_A_CHARACTER_PAIR = '\uD83C';
const MOON = '\u{1F319}';

describe('Rule 1 — display name (nom affiché)', () => {
  it.each(['Omar', 'Mostapha', 'Sarah', 'Taghread', 'تغريد', 'Omar B.'])(
    'accepts "%s" and returns it unchanged',
    (name) => {
      expect(parseDisplayName(name)).toBe(name);
    },
  );

  it('accepts 1 character, the shortest name', () => {
    expect(parseDisplayName('O')).toBe('O');
  });

  it('accepts 30 characters, the longest name', () => {
    const longest = 'a'.repeat(30);

    expect(parseDisplayName(longest)).toBe(longest);
  });

  it('refuses 31 characters', () => {
    expectRefusal(() => parseDisplayName('a'.repeat(31)), 'name-too-long');
  });

  it('refuses an empty name', () => {
    expectRefusal(() => parseDisplayName(''), 'name-empty');
  });

  it('refuses a name made of spaces only', () => {
    expectRefusal(() => parseDisplayName('   '), 'name-empty');
    expectRefusal(() => parseDisplayName(NO_BREAK_SPACE), 'name-empty');
  });

  it('removes the spaces at both ends, as the rule says, and keeps those inside', () => {
    expect(parseDisplayName('  Omar B.  ')).toBe('Omar B.');
    expect(parseDisplayName(`${NO_BREAK_SPACE}Sarah${NO_BREAK_SPACE}`)).toBe('Sarah');
  });

  it.each([
    ['space', ' '],
    ['no-break space', ' '],
    ['ogham space mark', ' '],
    ['en quad', ' '],
    ['hair space', ' '],
    ['narrow no-break space', ' '],
    ['medium mathematical space', ' '],
    ['ideographic space', '　'],
    ['zero-width no-break space', '﻿'],
  ])('removes the edge space the server also removes: %s', (_label, space) => {
    expect(parseDisplayName(`${space}Sarah${space}`)).toBe('Sarah');
  });

  it('removes only the listed spaces: a zero-width space is a character of the name', () => {
    const ZERO_WIDTH_SPACE = '​';

    expect(parseDisplayName(`Sarah${ZERO_WIDTH_SPACE}`)).toBe(`Sarah${ZERO_WIDTH_SPACE}`);
  });

  it('counts the characters once the spaces at the ends are removed', () => {
    const longest = 'a'.repeat(30);

    expect(parseDisplayName(`  ${longest}  `)).toBe(longest);
    expectRefusal(() => parseDisplayName(` ${'a'.repeat(31)} `), 'name-too-long');
  });

  it('counts characters, not the two halves an emoji is stored in', () => {
    expect(parseDisplayName(MOON.repeat(30))).toBe(MOON.repeat(30));
    expectRefusal(() => parseDisplayName(MOON.repeat(31)), 'name-too-long');
  });

  it.each([
    ['line feed', 'Omar\nB.'],
    ['carriage return', 'Omar\rB.'],
    ['line separator', `Omar${LINE_SEPARATOR}B.`],
    ['paragraph separator', `Omar${PARAGRAPH_SEPARATOR}B.`],
  ])('refuses a line break: %s', (_label, name) => {
    expectRefusal(() => parseDisplayName(name), 'name-forbidden-character');
  });

  it('refuses a line break at the end instead of removing it in silence', () => {
    expectRefusal(() => parseDisplayName('Omar\n'), 'name-forbidden-character');
    expectRefusal(() => parseDisplayName('\r\nOmar'), 'name-forbidden-character');
  });

  it.each([
    ['null character', 'Om\u0000ar'],
    ['tab', 'Omar\tB.'],
    ['escape', 'Om\u001Bar'],
    ['delete', 'Om\u007Far'],
    ['next line (C1)', 'Om\u0085ar'],
    ['last C1 control', 'Om\u009Far'],
  ])('refuses a control character: %s', (_label, name) => {
    expectRefusal(() => parseDisplayName(name), 'name-forbidden-character');
  });

  it('refuses the characters that reverse or isolate the reading direction', () => {
    expectRefusal(
      () => parseDisplayName(`${RIGHT_TO_LEFT_OVERRIDE}ramO`),
      'name-forbidden-character',
    );
    expectRefusal(
      () => parseDisplayName(`Omar${FIRST_STRONG_ISOLATE}`),
      'name-forbidden-character',
    );
  });

  it('refuses half of a character pair, which no server could store', () => {
    expectRefusal(
      () => parseDisplayName(`Omar${HALF_OF_A_CHARACTER_PAIR}`),
      'name-forbidden-character',
    );
  });

  it('accepts the characters next to the forbidden ranges', () => {
    // Space (U+0020) follows the C0 controls; tilde (U+007E) precedes delete; U+00A1 follows C1.
    expect(parseDisplayName('O ~¡')).toBe('O ~¡');
  });

  it('a refused name gives an explicit error that is also a RangeError', () => {
    expect(() => parseDisplayName('')).toThrow(SocialRuleError);
    expect(() => parseDisplayName('')).toThrow(RangeError);
  });

  it.each([[null], [undefined], [42], [['Omar']], [{ name: 'Omar' }]])(
    'a value that is not text is a TypeError: %p',
    (value) => {
      // The cast is the point: a name comes from a form or from the server, and its type is
      // not guaranteed at run time.
      expect(() => parseDisplayName(value as unknown as string)).toThrow(TypeError);
    },
  );
});
