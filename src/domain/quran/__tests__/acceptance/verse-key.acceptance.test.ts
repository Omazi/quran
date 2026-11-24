/**
 * Acceptance tests — verse keys.
 * Spec (docs/specs/quran.md, livrable 3): "lecture et validation des clés de verset ("18:10")
 * avec erreurs explicites". CONTRIBUTING: invalid input throws RangeError or TypeError and is
 * never silently corrected.
 */
import { formatVerseKey, parseVerseKey, type VerseRef } from '@/domain/quran';

import { allVerseKeys } from './mushaf-anchors';

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectExplicitError(action: () => unknown): void {
  const error = thrownBy(action);
  expect(error instanceof RangeError || error instanceof TypeError).toBe(true);
  // as: narrowed by the line above; an explicit error says what is wrong.
  expect((error as Error).message.length).toBeGreaterThan(0);
}

describe('Clés de verset — lecture', () => {
  it('reads "18:10" as surah 18, verse 10', () => {
    expect(parseVerseKey('18:10')).toEqual({ surah: 18, verse: 10 });
  });

  it('reads the bounds: first and last surah, verse 1', () => {
    expect(parseVerseKey('1:1')).toEqual({ surah: 1, verse: 1 });
    expect(parseVerseKey('114:6')).toEqual({ surah: 114, verse: 6 });
    expect(parseVerseKey('2:286')).toEqual({ surah: 2, verse: 286 });
  });

  it('reads every verse key of the Quran and writes it back unchanged (6236 keys)', () => {
    for (const key of allVerseKeys()) {
      expect(formatVerseKey(parseVerseKey(key))).toBe(key);
    }
  });
});

describe('Clés de verset — entrées invalides : erreur explicite', () => {
  it.each(['0:1', '115:1', '999:1'])('surah out of 1..114 in "%s": RangeError', (key) => {
    expect(() => parseVerseKey(key)).toThrow(RangeError);
  });

  it('verse 0: RangeError', () => {
    expect(() => parseVerseKey('1:0')).toThrow(RangeError);
  });

  it.each([
    '',
    ' ',
    '18',
    '18:',
    ':10',
    ':',
    '18:10:1',
    '18-10',
    '18.10',
    '18;10',
    'a:b',
    '18:x',
    'x:10',
    'NaN:1',
    'Infinity:1',
    '1:Infinity',
  ])('malformed key "%s": TypeError', (key) => {
    expect(() => parseVerseKey(key)).toThrow(TypeError);
  });

  it.each([' 18:10', '18:10 ', '18 :10', '18: 10', '18:10\n', '\t18:10', '18:10\u00A0'])(
    'white space is not trimmed in %j',
    (key) => {
      expectExplicitError(() => parseVerseKey(key));
    },
  );

  it.each(['-1:1', '1:-1', '+1:1', '1:+1', '1.5:1', '1:1.5', '1.0:1', '1e1:1', '1:1e1', '0x1:1'])(
    'only plain decimal digits are accepted, not "%s"',
    (key) => {
      expectExplicitError(() => parseVerseKey(key));
    },
  );

  it.each(['١٨:١٠', '۱۸:۱۰', '１８:１０'])(
    'digits of another script are not read as numbers: "%s"',
    (key) => {
      expectExplicitError(() => parseVerseKey(key));
    },
  );

  it.each(['018:10', '18:010', '0018:0010', '00:1', '1:00'])(
    'a key with leading zeros is not silently corrected: "%s"',
    (key) => {
      // Two spellings of one verse would break every map keyed by VerseKey.
      expectExplicitError(() => parseVerseKey(key));
    },
  );

  it.each(['1:9007199254740993', '1:99999999999999999999999', '1:' + '9'.repeat(400)])(
    'a number too large to be exact is refused, not rounded: "%s"',
    (key) => {
      expectExplicitError(() => parseVerseKey(key));
    },
  );

  it('whatever is accepted is written back identically (no second spelling of a verse)', () => {
    const candidates = [
      '18:10',
      '018:10',
      '18:010',
      '18:10 ',
      ' 18:10',
      '1:9007199254740993',
      '1:1e1',
      '+1:1',
      '1.0:1',
      '١٨:١٠',
      '114:6',
      '1:9007199254740991',
    ];
    const rewritten: string[] = [];
    for (const key of candidates) {
      let ref: VerseRef;
      try {
        ref = parseVerseKey(key);
      } catch {
        continue;
      }
      if (formatVerseKey(ref) !== key) {
        rewritten.push(`${JSON.stringify(key)} -> ${JSON.stringify(formatVerseKey(ref))}`);
      }
    }
    expect(rewritten).toEqual([]);
  });

  it.each<unknown>([
    undefined,
    null,
    1810,
    18.1,
    true,
    { surah: 18, verse: 10 },
    ['18:10'],
    ['18', '10'],
  ])('a value that is not a string (%p): explicit error', (value) => {
    // as: simulates an untyped caller (navigation parameter, stored JSON).
    expectExplicitError(() => parseVerseKey(value as string));
  });

  it('never answers for the verse of another surah when the surah is unknown', () => {
    // "115:1" must not be read as 114:1 or 1:1.
    expect(thrownBy(() => parseVerseKey('115:1'))).toBeInstanceOf(RangeError);
  });
});

describe('Clés de verset — écriture', () => {
  it('writes { surah: 18, verse: 10 } as "18:10"', () => {
    expect(formatVerseKey({ surah: 18, verse: 10 })).toBe('18:10');
  });

  it('ignores nothing: the key holds exactly the two numbers', () => {
    expect(formatVerseKey({ surah: 114, verse: 6 })).toBe('114:6');
    expect(formatVerseKey({ surah: 2, verse: 286 })).toBe('2:286');
  });

  it.each([
    { surah: 0, verse: 1 },
    { surah: 115, verse: 1 },
    { surah: -1, verse: 1 },
    { surah: 1, verse: 0 },
    { surah: 1, verse: -3 },
    { surah: 1.5, verse: 1 },
    { surah: 1, verse: 1.5 },
    { surah: Number.NaN, verse: 1 },
    { surah: 1, verse: Number.NaN },
    { surah: 1, verse: Number.POSITIVE_INFINITY },
  ])('refuses to write a key for the invalid reference %p', (ref) => {
    expectExplicitError(() => formatVerseKey(ref));
  });

  it('does not change the reference it is given', () => {
    const ref = Object.freeze({ surah: 18, verse: 10 });
    expect(formatVerseKey(ref)).toBe('18:10');
    expect(ref).toEqual({ surah: 18, verse: 10 });
  });
});
