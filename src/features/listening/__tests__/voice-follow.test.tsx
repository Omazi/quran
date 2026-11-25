/**
 * What is left of the voice-following trial screen (voix.png) now that the reader follows the
 * recitation itself (D41, spec reader 3b): the address `/voice-follow` it still understands, and
 * the rule that its parts (the bar, the buttons) write no colour of their own. The following is
 * tested in the reader (src/features/reader/__tests__/reader-follow.test.tsx).
 */

import { parseFollowParams } from '../follow/follow-params';

describe('the address of the voice-following trial', () => {
  it('follows 18:10 on its page when it names nothing', () => {
    expect(parseFollowParams(undefined, undefined)).toEqual({
      page: 294,
      from: { surah: 18, verse: 10 },
    });
  });

  it('reads a page and a verse, and refuses a page outside the mushaf', () => {
    expect(parseFollowParams('1', '1:1')).toEqual({ page: 1, from: { surah: 1, verse: 1 } });
    expect(parseFollowParams('12', 'nope')).toEqual({ page: 12, from: undefined });
    expect(parseFollowParams('605', undefined)).toBeNull();
    expect(parseFollowParams('x', undefined)).toBeNull();
  });
});

describe('the files of the voice-following view', () => {
  // The project compiles without Node's type definitions: the functions needed are typed here.
  const { readdirSync, readFileSync } = jest.requireActual<{
    readdirSync: (path: string) => string[];
    readFileSync: (path: string, encoding: 'utf8') => string;
  }>('node:fs');
  const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>(
    'node:path',
  );
  const folder = resolve(expect.getState().testPath ?? '', '../../follow');
  const files = readdirSync(folder).filter((name) => name.endsWith('.tsx'));

  it.each(files)('%s writes no colour of its own', (name) => {
    const source = readFileSync(resolve(folder, name), 'utf8');
    expect(source).not.toMatch(/['"]#[0-9A-Fa-f]{3,8}['"]/);
    expect(source).not.toMatch(/rgba?\(/);
  });
});
